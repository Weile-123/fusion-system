-- Apply the minimum rules version to weekly scores, preserving legacy gameplay.
begin;
-- Prevent a battle insertion from using the old trigger during the cleanup.
lock table public.leaderboard_battles in share row exclusive mode;

create or replace function public.record_weekly_ovr_battle()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_run public.leaderboard_runs; v_period public.weekly_ovr_periods; v_now timestamptz;
begin
  select * into v_run from leaderboard_runs where id=new.run_id;
  if v_run.proof_version<>3 or v_run.weekly_ovr_start is null then return new; end if;
  if (case when v_run.state->>'balanceRulesVersion' ~ '^[0-9]+$'
    then (v_run.state->>'balanceRulesVersion')::numeric else 0 end) <6 then return new; end if;
  insert into weekly_ovr_periods(starts_at,ends_at)
    values(v_run.weekly_ovr_start,v_run.weekly_ovr_start+interval '168 hours') on conflict do nothing;
  select * into v_period from weekly_ovr_periods where starts_at=v_run.weekly_ovr_start for update;
  v_now:=weekly_ovr_now();
  if v_period.closed_at is not null or v_now<v_period.starts_at or v_now>=v_period.ends_at then return new; end if;
  insert into weekly_ovr_entries(starts_at,puid,score,stage,display_name,reached_at,run_id,battle_index)
    values(v_period.starts_at,v_run.puid,new.rating,new.stage,v_run.display_name,v_now,new.run_id,new.battle_index)
    on conflict(starts_at,puid) do update set score=excluded.score,stage=excluded.stage,
      display_name=excluded.display_name,reached_at=excluded.reached_at,
      run_id=excluded.run_id,battle_index=excluded.battle_index
    where weekly_ovr_entries.score<excluded.score;
  return new;
end;
$$;

-- Only repair the open current week. Finished-week snapshots remain immutable.
delete from public.weekly_ovr_entries e using public.leaderboard_runs r
where e.run_id=r.id and e.starts_at=public.weekly_ovr_week(public.weekly_ovr_now())
  and case when r.state->>'balanceRulesVersion' ~ '^[0-9]+$'
    then (r.state->>'balanceRulesVersion')::numeric else 0 end <6;
commit;
