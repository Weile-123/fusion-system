-- One-time launch-week correction, explicitly requested by the owner.
-- Not a recurring migration/job. Refuse execution after the first week ends.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $$
declare
  v_start timestamptz:='2026-10-05T00:00:00+08:00';
  v_end timestamptz:='2026-10-12T00:00:00+08:00';
  v_enabled timestamptz;
  v_closed timestamptz;
begin
  select enabled_at into v_enabled from public.weekly_ovr_settings where id;
  if v_enabled is null or v_enabled<v_start or v_enabled>=v_end
    or public.weekly_ovr_now()<v_enabled or public.weekly_ovr_now()>=v_end then
    raise exception 'FIRST_WEEK_BACKFILL_NOT_ALLOWED';
  end if;

  -- Acquire pre-activation run locks BEFORE the period lock. Live battle writes
  -- lock their run first; preserve that ordering to avoid a lock cycle.
  perform id from public.leaderboard_runs
    where proof_version=3 and weekly_ovr_start is null
      and created_at>=v_start and created_at<v_enabled
    order by id for update;
  update public.leaderboard_runs set weekly_ovr_start=v_start
    where proof_version=3 and weekly_ovr_start is null
      and created_at>=v_start and created_at<v_enabled;

  insert into public.weekly_ovr_periods(starts_at,ends_at) values(v_start,v_end)
    on conflict do nothing;
  select closed_at into v_closed from public.weekly_ovr_periods
    where starts_at=v_start for update;
  if v_closed is not null or public.weekly_ovr_now()>=v_end then
    raise exception 'FIRST_WEEK_ALREADY_CLOSED';
  end if;

  -- All public cumulative peaks were audited as belonging to this launch week.
  -- Select the same actual peak battle/stage as the legacy OVR page. Preserve
  -- its original peak timestamp rather than making all histories "achieved now".
  insert into public.weekly_ovr_entries
    (starts_at,puid,score,stage,display_name,reached_at,run_id,battle_index)
  select v_start,puid,score,stage,display_name,reached_at,run_id,battle_index
  from (
    select distinct on(e.puid) e.puid,e.score,b.stage,e.display_name,
      e.updated_at as reached_at,r.id as run_id,b.battle_index
    from public.leaderboard_entries e
    join public.leaderboard_runs r on r.puid=e.puid and r.proof_version=3
    join public.leaderboard_battles b on b.run_id=r.id and b.rating=e.score
    where e.board='ovr' and e.verified and r.created_at>=v_start and r.created_at<v_end
    order by e.puid,r.created_at,b.battle_index
  ) peaks
  on conflict(starts_at,puid) do update set
    score=excluded.score,stage=excluded.stage,display_name=excluded.display_name,
    reached_at=excluded.reached_at,run_id=excluded.run_id,battle_index=excluded.battle_index
  where weekly_ovr_entries.score<excluded.score
    or (weekly_ovr_entries.score=excluded.score and weekly_ovr_entries.reached_at>excluded.reached_at);
end;
$$;
commit;
