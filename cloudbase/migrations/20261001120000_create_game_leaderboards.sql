-- Reuse the platform's activity table for both game leaderboards.
alter table public.demo_items rename to leaderboard_entries;
alter table public.leaderboard_entries
  add column board text not null default 'legend',
  add column score integer not null default 0,
  add column display_name text not null default '玩家',
  add column updated_at timestamptz not null default now();
alter table public.leaderboard_entries
  add constraint leaderboard_board_check check (board in ('legend', 'ovr'));
create unique index leaderboard_entries_user_board_uidx on public.leaderboard_entries (puid, board);
create index leaderboard_entries_rank_idx on public.leaderboard_entries (board, score desc, updated_at asc, id asc);

create table public.leaderboard_runs (
  id uuid primary key default gen_random_uuid(),
  puid text not null,
  talent text not null,
  seed bigint not null,
  display_name text not null default '玩家',
  next_stage integer not null default 1,
  battle_count integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  cleared_stage integer not null default 0,
  endless_wins integer not null default 0,
  best_ovr integer not null default 0,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leaderboard_runs_user_idx on public.leaderboard_runs (puid, created_at desc);
alter table public.leaderboard_entries disable row level security;
alter table public.leaderboard_runs disable row level security;

create or replace function public.start_game_leaderboard_run(p_puid text, p_talent text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_seed bigint;
begin
  if p_puid is null or length(p_puid) > 128 or p_talent is null or length(p_talent) > 80 then
    raise exception 'INVALID_RUN';
  end if;
  if (select count(*) from public.leaderboard_runs where puid = p_puid and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'RATE_LIMITED';
  end if;
  v_seed := floor(random() * 4294967295)::bigint;
  insert into public.leaderboard_runs (puid, talent, seed, display_name)
  values (p_puid, p_talent, v_seed, left(coalesce(nullif(trim(p_display_name), ''), '玩家'), 40))
  returning id into v_id;
  return jsonb_build_object('runId', v_id, 'seed', v_seed);
end;
$$;

create or replace function public.record_game_leaderboard_battle(
  p_puid text, p_run_id uuid, p_seed bigint, p_battle_index integer,
  p_stage integer, p_wins_before integer, p_losses_before integer,
  p_won boolean, p_rating integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.leaderboard_runs; v_next_stage integer;
begin
  select * into v_run from public.leaderboard_runs where id = p_run_id and puid = p_puid for update;
  if not found or v_run.finished or v_run.seed <> p_seed then raise exception 'INVALID_RUN'; end if;
  if p_battle_index <> v_run.battle_count + 1 or p_battle_index > 300
    or p_stage <> v_run.next_stage or p_wins_before <> v_run.wins
    or p_losses_before <> v_run.losses or p_rating < 0 or p_rating > 500 then
    raise exception 'INVALID_BATTLE';
  end if;
  v_next_stage := case when p_won then p_stage + 1 else p_stage end;
  update public.leaderboard_runs set
    battle_count = p_battle_index,
    wins = wins + case when p_won then 1 else 0 end,
    losses = losses + case when p_won then 0 else 1 end,
    next_stage = v_next_stage,
    cleared_stage = greatest(cleared_stage, case when p_won then least(p_stage, 10) else 0 end),
    endless_wins = endless_wins + case when p_won and p_stage > 10 then 1 else 0 end,
    best_ovr = greatest(best_ovr, p_rating), updated_at = now()
  where id = p_run_id;
  insert into public.leaderboard_entries (puid, board, score, display_name, updated_at)
  values (p_puid, 'ovr', p_rating, v_run.display_name, now())
  on conflict (puid, board) do update set score = excluded.score,
    display_name = excluded.display_name, updated_at = now()
  where public.leaderboard_entries.score < excluded.score;
  return jsonb_build_object('battleCount', p_battle_index, 'rating', p_rating);
end;
$$;

create or replace function public.finish_game_leaderboard_run(p_puid text, p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.leaderboard_runs; v_points integer;
begin
  select * into v_run from public.leaderboard_runs where id = p_run_id and puid = p_puid for update;
  if not found then raise exception 'INVALID_RUN'; end if;
  if v_run.finished then return jsonb_build_object('points', 0, 'alreadyFinished', true); end if;
  v_points := case v_run.cleared_stage
    when 5 then 50 when 6 then 60 when 7 then 70 when 8 then 80 when 9 then 90 when 10 then 200 else 0 end
    + v_run.endless_wins * 50;
  update public.leaderboard_runs set finished = true, updated_at = now() where id = p_run_id;
  if v_points > 0 then
    insert into public.leaderboard_entries (puid, board, score, display_name, updated_at)
    values (p_puid, 'legend', v_points, v_run.display_name, now())
    on conflict (puid, board) do update set score = public.leaderboard_entries.score + excluded.score,
      display_name = excluded.display_name, updated_at = now();
  end if;
  return jsonb_build_object('points', v_points, 'alreadyFinished', false);
end;
$$;

revoke all on table public.leaderboard_entries from public, anon, authenticated;
revoke all on table public.leaderboard_runs from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update on table public.leaderboard_entries to service_role;
grant select, insert, update on table public.leaderboard_runs to service_role;
revoke all on function public.start_game_leaderboard_run(text, text, text) from public, anon, authenticated;
revoke all on function public.record_game_leaderboard_battle(text, uuid, bigint, integer, integer, integer, integer, boolean, integer) from public, anon, authenticated;
revoke all on function public.finish_game_leaderboard_run(text, uuid) from public, anon, authenticated;
grant execute on function public.start_game_leaderboard_run(text, text, text) to service_role;
grant execute on function public.record_game_leaderboard_battle(text, uuid, bigint, integer, integer, integer, integer, boolean, integer) to service_role;
grant execute on function public.finish_game_leaderboard_run(text, uuid) to service_role;
