-- Late offline registration still verifies cumulative results, but cannot
-- enter a fresh weekly ranking. Old clients and already registered runs retain
-- their existing eligibility. Only the server sets this state flag.
create or replace function public.assign_weekly_ovr_run()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_enabled timestamptz; v_now timestamptz:=weekly_ovr_now();
begin
  select enabled_at into v_enabled from weekly_ovr_settings where id;
  new.weekly_ovr_start:=case when v_enabled is not null and v_now>=v_enabled
    and coalesce(new.state->>'weeklyLeaderboardExcluded','false')<>'true'
    then weekly_ovr_week(v_now) else null end;
  return new;
end;
$$;
