-- Preserve historical scores; only verifiable new runs participate in public ranks.
create table public.leaderboard_entries_before_verification as select * from public.leaderboard_entries;
revoke all on table public.leaderboard_entries_before_verification from public, anon, authenticated;
grant select on table public.leaderboard_entries_before_verification to service_role;
alter table public.leaderboard_entries add column verified boolean not null default false;
alter table public.leaderboard_entries alter column verified set default true;
create index leaderboard_verified_rank_idx on public.leaderboard_entries (board, score desc, updated_at asc, id asc) where verified;
alter table public.leaderboard_runs add column proof_version integer not null default 0,
  add column state jsonb, add column verification_sequence integer not null default 0,
  add column verification_digest text;
create table public.verified_game_progress (
  puid text primary key, progress jsonb not null default '{}'::jsonb,
  spent integer not null default 0 check (spent >= 0), updated_at timestamptz not null default now()
);
revoke all on table public.verified_game_progress from public, anon, authenticated;
grant select, insert, update on table public.verified_game_progress to service_role;
create table public.verified_jersey_purchases (
  puid text not null, request_id uuid not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(puid,request_id)
);
revoke all on table public.verified_jersey_purchases from public,anon,authenticated;
grant select,insert on table public.verified_jersey_purchases to service_role;

create or replace function public.get_verified_game_profile(p_puid text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_progress jsonb; v_earned integer; v_profile jsonb; v_discovered jsonb;
begin
  select progress into v_progress from verified_game_progress where puid=p_puid;
  select score into v_earned from leaderboard_entries where puid=p_puid and board='legend' and verified;
  select coalesce(jsonb_agg(distinct found.player), '[]'::jsonb) into v_discovered from leaderboard_runs r,
    lateral jsonb_array_elements(coalesce(r.state->'collectedPlayers','[]'::jsonb)) as found(player)
    where r.puid=p_puid and r.proof_version=3 and r.finished;
  select jsonb_build_object('runs',count(*),'wins',coalesce(sum(wins),0),
    'clears',count(*) filter (where cleared_stage>=10),'bestStage',coalesce(max(cleared_stage),0),
    'bestEndless',coalesce(max(case when (state->>'endless')::boolean then (state->>'stage')::integer else 0 end),0),'discovered',v_discovered)
    into v_profile from leaderboard_runs where puid=p_puid and proof_version=3 and finished;
  return jsonb_build_object('progress',coalesce(v_progress,'{}'::jsonb),'earned',coalesce(v_earned,0),'profile',v_profile);
end;
$$;

create or replace function public.start_verified_game_run(p_puid text,p_run_id uuid,p_talent text,p_display_name text,
  p_seed bigint,p_state jsonb,p_progress jsonb,p_cost integer,p_previous jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_progress public.verified_game_progress; v_earned integer; v_run public.leaderboard_runs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_puid,0));
  select * into v_run from leaderboard_runs where id=p_run_id;
  if found then
    if v_run.puid<>p_puid or v_run.seed<>p_seed or v_run.talent<>p_talent then raise exception 'RUN_CONFLICT'; end if;
    return jsonb_build_object('runId',v_run.id,'seed',v_run.seed,'proofVersion',v_run.proof_version);
  end if;
  insert into verified_game_progress(puid) values(p_puid) on conflict do nothing;
  select * into v_progress from verified_game_progress where puid=p_puid for update;
  if v_progress.progress is distinct from p_previous or p_cost<v_progress.spent then raise exception 'PROGRESS_CONFLICT'; end if;
  select score into v_earned from leaderboard_entries where puid=p_puid and board='legend' and verified;
  if p_cost>coalesce(v_earned,0) then raise exception 'INSUFFICIENT_VERIFIED_POINTS'; end if;
  if (select count(*) from leaderboard_runs where puid=p_puid and created_at>now()-interval '1 minute')>=6 then raise exception 'RATE_LIMITED'; end if;
  update verified_game_progress set progress=p_progress,spent=p_cost,updated_at=now() where puid=p_puid;
  insert into leaderboard_runs(id,puid,talent,seed,display_name,proof_version,state)
    values(p_run_id,p_puid,p_talent,p_seed,left(p_display_name,40),3,p_state) returning id into v_id;
  return jsonb_build_object('runId',v_id,'seed',p_seed,'proofVersion',3,'sequence',0);
end;
$$;

create or replace function public.commit_verified_game_transition(p_puid text,p_run_id uuid,p_sequence integer,
  p_digest text,p_terminal text,p_state jsonb,p_report jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.leaderboard_runs; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_puid,0));
  select * into v_run from leaderboard_runs where id=p_run_id and puid=p_puid for update;
  if not found or v_run.proof_version<>3 then raise exception 'UNVERIFIED_RUN'; end if;
  if v_run.verification_sequence=p_sequence+1 and v_run.verification_digest=p_digest then
    return jsonb_build_object('sequence',v_run.verification_sequence,'alreadyRecorded',true);
  end if;
  if v_run.verification_sequence<>p_sequence then raise exception 'STATE_CONFLICT'; end if;
  -- Historical unverified totals cannot contaminate a new verified score.
  update leaderboard_entries set score=0 where puid=p_puid and not verified;
  if p_terminal='battle' then
    v_result:=record_game_leaderboard_battle(p_puid,p_run_id,v_run.seed,v_run.battle_count+1,
      (p_report->>'stage')::integer,(v_run.state->>'wins')::integer,(v_run.state->>'losses')::integer,
      (p_report->>'won')::boolean,(p_report->>'rating')::integer);
    update leaderboard_entries set verified=true where puid=p_puid and board='ovr';
  elsif p_terminal='finish' then
    v_result:=finish_game_leaderboard_run(p_puid,p_run_id);
    update leaderboard_entries set verified=true where puid=p_puid and board='legend';
  elsif p_terminal='resume' then
    v_result:=resume_game_leaderboard_run(p_puid,p_run_id);
  else raise exception 'INVALID_TRANSITION'; end if;
  update leaderboard_runs set state=p_state,verification_sequence=p_sequence+1,verification_digest=p_digest,updated_at=now() where id=p_run_id;
  return jsonb_build_object('sequence',p_sequence+1,'result',v_result);
end;
$$;

create or replace function public.get_game_leaderboard_rank(p_puid text,p_board text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_entry public.leaderboard_entries; v_rank bigint;
begin
  if p_board not in ('legend','ovr') then raise exception 'INVALID_BOARD'; end if;
  select * into v_entry from leaderboard_entries where puid=p_puid and board=p_board and verified;
  if not found then return null; end if;
  select count(*)+1 into v_rank from leaderboard_entries where board=p_board and verified and
    (score>v_entry.score or (score=v_entry.score and (updated_at,id)<(v_entry.updated_at,v_entry.id)));
  return jsonb_build_object('rank',v_rank,'score',v_entry.score);
end;
$$;
revoke all on function public.get_verified_game_profile(text) from public,anon,authenticated;
revoke all on function public.start_verified_game_run(text,uuid,text,text,bigint,jsonb,jsonb,integer,jsonb) from public,anon,authenticated;
revoke all on function public.commit_verified_game_transition(text,uuid,integer,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.get_verified_game_profile(text) to service_role;
grant execute on function public.start_verified_game_run(text,uuid,text,text,bigint,jsonb,jsonb,integer,jsonb) to service_role;
grant execute on function public.commit_verified_game_transition(text,uuid,integer,text,text,jsonb,jsonb) to service_role;

create or replace function public.unlock_verified_game_jersey(p_puid text,p_request_id uuid,
  p_previous jsonb,p_progress jsonb,p_cost integer,p_item text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_progress public.verified_game_progress; v_earned integer; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_puid,0));
  select result into v_result from verified_jersey_purchases where puid=p_puid and request_id=p_request_id;
  if found then return v_result; end if;
  insert into verified_game_progress(puid) values(p_puid) on conflict do nothing;
  select * into v_progress from verified_game_progress where puid=p_puid for update;
  if v_progress.progress is distinct from p_previous or p_cost<v_progress.spent+500 then raise exception 'PROGRESS_CONFLICT'; end if;
  select score into v_earned from leaderboard_entries where puid=p_puid and board='legend' and verified;
  if p_cost>coalesce(v_earned,0) then raise exception 'INSUFFICIENT_VERIFIED_POINTS'; end if;
  v_result:=jsonb_build_object('item',p_item,'progress',p_progress);
  update verified_game_progress set progress=p_progress,spent=p_cost,updated_at=now() where puid=p_puid;
  insert into verified_jersey_purchases(puid,request_id,result) values(p_puid,p_request_id,v_result);
  return v_result;
end;
$$;
revoke all on function public.unlock_verified_game_jersey(text,uuid,jsonb,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.unlock_verified_game_jersey(text,uuid,jsonb,jsonb,integer,text) to service_role;

create or replace function public.reward_game_leaderboard_share(p_puid text,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_run public.leaderboard_runs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_puid,0));
  select * into v_run from leaderboard_runs where id=p_run_id and puid=p_puid for update;
  if not found or not v_run.finished or v_run.proof_version<>3 or v_run.battle_count<1 then raise exception 'INVALID_RUN'; end if;
  if v_run.share_rewarded then return jsonb_build_object('alreadyRewarded',true,'points',0); end if;
  update leaderboard_runs set share_rewarded=true,updated_at=now() where id=p_run_id;
  insert into leaderboard_entries(puid,board,score,display_name,updated_at,verified)
    values(p_puid,'legend',100,v_run.display_name,now(),true)
    on conflict(puid,board) do update set score=case when leaderboard_entries.verified then leaderboard_entries.score+100 else 100 end,
      display_name=excluded.display_name,updated_at=now(),verified=true;
  return jsonb_build_object('alreadyRewarded',false,'points',100);
end;
$$;
