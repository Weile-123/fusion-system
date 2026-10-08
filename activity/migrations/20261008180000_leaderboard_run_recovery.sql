-- Keep battle submissions, revival and editor rewards idempotent.
alter table public.leaderboard_runs
  add column if not exists revive_used boolean not null default false,
  add column if not exists share_rewarded boolean not null default false,
  add column if not exists last_won boolean;
create table public.leaderboard_battles (
  run_id uuid not null references public.leaderboard_runs(id),
  battle_index integer not null,
  stage integer not null,
  won boolean not null,
  rating integer not null,
  primary key (run_id, battle_index)
);
revoke all on table public.leaderboard_battles from public, anon, authenticated;
grant select, insert on table public.leaderboard_battles to service_role;

create or replace function public.record_game_leaderboard_battle(
  p_puid text, p_run_id uuid, p_seed bigint, p_battle_index integer,
  p_stage integer, p_wins_before integer, p_losses_before integer,
  p_won boolean, p_rating integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.leaderboard_runs; v_battle public.leaderboard_battles;
begin
  select * into v_run from public.leaderboard_runs where id = p_run_id and puid = p_puid for update;
  if not found or v_run.seed <> p_seed then raise exception 'INVALID_RUN'; end if;
  select * into v_battle from public.leaderboard_battles where run_id = p_run_id and battle_index = p_battle_index;
  if found then
    if (v_battle.stage, v_battle.won, v_battle.rating) is distinct from (p_stage, p_won, p_rating) then
      raise exception 'INVALID_BATTLE';
    end if;
    return jsonb_build_object('battleCount', p_battle_index, 'rating', p_rating, 'alreadyRecorded', true);
  end if;
  if v_run.finished or p_battle_index <> v_run.battle_count + 1 or p_battle_index > 1000000
    or p_stage <> v_run.next_stage or p_wins_before <> v_run.wins
    or p_losses_before <> v_run.losses or p_rating < 0 then raise exception 'INVALID_BATTLE'; end if;
  insert into public.leaderboard_battles values (p_run_id, p_battle_index, p_stage, p_won, p_rating);
  update public.leaderboard_runs set
    battle_count = p_battle_index, last_won = p_won,
    wins = wins + case when p_won then 1 else 0 end,
    losses = losses + case when p_won then 0 else 1 end,
    next_stage = case when p_won then p_stage + 1 else p_stage end,
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

create or replace function public.resume_game_leaderboard_run(p_puid text, p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.leaderboard_runs; v_points integer;
begin
  select * into v_run from public.leaderboard_runs where id = p_run_id and puid = p_puid for update;
  if not found then raise exception 'INVALID_RUN'; end if;
  if v_run.revive_used then return jsonb_build_object('alreadyResumed', true); end if;
  if v_run.last_won is distinct from false and not (v_run.last_won is null and v_run.losses > 0) then
    raise exception 'INVALID_REVIVE';
  end if;
  v_points := case v_run.cleared_stage
    when 5 then 50 when 6 then 60 when 7 then 70 when 8 then 80 when 9 then 90 when 10 then 200 else 0 end
    + v_run.endless_wins * 50;
  if v_run.finished and v_points > 0 then
    update public.leaderboard_entries set score = greatest(0, score - v_points), updated_at = now()
      where puid = p_puid and board = 'legend';
  end if;
  update public.leaderboard_runs set finished = false, revive_used = true, updated_at = now() where id = p_run_id;
  return jsonb_build_object('alreadyResumed', false);
end;
$$;

create or replace function public.reward_game_leaderboard_share(p_puid text, p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.leaderboard_runs;
begin
  select * into v_run from public.leaderboard_runs where id = p_run_id and puid = p_puid for update;
  if not found or not v_run.finished then raise exception 'INVALID_RUN'; end if;
  if v_run.share_rewarded then return jsonb_build_object('alreadyRewarded', true, 'points', 0); end if;
  update public.leaderboard_runs set share_rewarded = true, updated_at = now() where id = p_run_id;
  insert into public.leaderboard_entries (puid, board, score, display_name, updated_at)
  values (p_puid, 'legend', 100, v_run.display_name, now())
  on conflict (puid, board) do update set score = public.leaderboard_entries.score + 100,
    display_name = excluded.display_name, updated_at = now();
  return jsonb_build_object('alreadyRewarded', false, 'points', 100);
end;
$$;
revoke all on function public.resume_game_leaderboard_run(text, uuid) from public, anon, authenticated;
revoke all on function public.reward_game_leaderboard_share(text, uuid) from public, anon, authenticated;
grant execute on function public.resume_game_leaderboard_run(text, uuid) to service_role;
grant execute on function public.reward_game_leaderboard_share(text, uuid) to service_role;
