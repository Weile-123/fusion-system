-- Additive migration. Existing cumulative ranks and RPC signatures are untouched.
-- Weekly scoring stays disabled until enabled_at is explicitly set at deployment.
begin;

create table if not exists public.weekly_ovr_settings (
  id boolean primary key default true check(id),
  enabled_at timestamptz
);
insert into public.weekly_ovr_settings(id) values(true) on conflict do nothing;

create table if not exists public.weekly_ovr_periods (
  starts_at timestamptz primary key,
  ends_at timestamptz not null,
  closed_at timestamptz,
  check(ends_at=starts_at+interval '168 hours')
);
create table if not exists public.weekly_ovr_entries (
  starts_at timestamptz not null references public.weekly_ovr_periods(starts_at),
  puid text not null,
  score integer not null check(score>=0),
  stage integer not null check(stage>0),
  display_name text not null,
  reached_at timestamptz not null,
  run_id uuid not null references public.leaderboard_runs(id),
  battle_index integer not null,
  primary key(starts_at,puid),
  foreign key(run_id,battle_index) references public.leaderboard_battles(run_id,battle_index)
);
create index if not exists weekly_ovr_order_idx on public.weekly_ovr_entries
  (starts_at,score desc,reached_at asc,puid collate "C" asc);
create table if not exists public.weekly_ovr_snapshots (
  starts_at timestamptz not null references public.weekly_ovr_periods(starts_at),
  rank integer not null check(rank between 1 and 50),
  puid text not null,
  score integer not null,
  stage integer not null,
  display_name text not null,
  reached_at timestamptz not null,
  run_id uuid not null,
  battle_index integer not null,
  primary key(starts_at,rank),unique(starts_at,puid)
);
alter table public.leaderboard_runs add column if not exists weekly_ovr_start timestamptz;

create or replace function public.weekly_ovr_now()
returns timestamptz language sql volatile set search_path=public as $$
  select clock_timestamp();
$$;

create or replace function public.weekly_ovr_week(p_time timestamptz)
returns timestamptz language sql immutable strict set search_path=public as $$
  select date_trunc('week',p_time at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai';
$$;

create or replace function public.assign_weekly_ovr_run()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_enabled timestamptz; v_now timestamptz:=weekly_ovr_now();
begin
  select enabled_at into v_enabled from weekly_ovr_settings where id;
  -- Never trust a caller-provided week. Old runs are intentionally not backfilled.
  new.weekly_ovr_start:=case when v_enabled is not null and v_now>=v_enabled
    then weekly_ovr_week(v_now) else null end;
  return new;
end;
$$;
drop trigger if exists assign_weekly_ovr_run on public.leaderboard_runs;
create trigger assign_weekly_ovr_run before insert on public.leaderboard_runs
  for each row execute function public.assign_weekly_ovr_run();

create or replace function public.close_weekly_ovr_period(p_start timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare v_period public.weekly_ovr_periods;
begin
  insert into weekly_ovr_periods(starts_at,ends_at) values(p_start,p_start+interval '168 hours')
    on conflict do nothing;
  -- Writers take exactly this same row lock. Snapshot and closing are atomic.
  select * into v_period from weekly_ovr_periods where starts_at=p_start for update;
  if v_period.closed_at is not null or weekly_ovr_now()<v_period.ends_at then return; end if;
  insert into weekly_ovr_snapshots(starts_at,rank,puid,score,stage,display_name,reached_at,run_id,battle_index)
    select p_start,row_number() over(order by score desc,reached_at asc,puid collate "C" asc),
      puid,score,stage,display_name,reached_at,run_id,battle_index
    from weekly_ovr_entries where starts_at=p_start
    order by score desc,reached_at asc,puid collate "C" asc limit 50;
  update weekly_ovr_periods set closed_at=weekly_ovr_now() where starts_at=p_start;
end;
$$;

create or replace function public.record_weekly_ovr_battle()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_run public.leaderboard_runs; v_period public.weekly_ovr_periods; v_now timestamptz;
begin
  select * into v_run from leaderboard_runs where id=new.run_id;
  if v_run.proof_version<>3 or v_run.weekly_ovr_start is null then return new; end if;
  insert into weekly_ovr_periods(starts_at,ends_at)
    values(v_run.weekly_ovr_start,v_run.weekly_ovr_start+interval '168 hours') on conflict do nothing;
  select * into v_period from weekly_ovr_periods where starts_at=v_run.weekly_ovr_start for update;
  -- Evaluate the wall clock AFTER acquiring the lock, not transaction-start now().
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
drop trigger if exists record_weekly_ovr_battle on public.leaderboard_battles;
create trigger record_weekly_ovr_battle after insert on public.leaderboard_battles
  for each row execute function public.record_weekly_ovr_battle();

create or replace function public.get_weekly_ovr_page(p_period text default 'current',p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_enabled timestamptz; v_now timestamptz; v_current timestamptz; v_start timestamptz;
  v_old record; v_entries jsonb; v_limit integer:=greatest(1,least(50,coalesce(p_limit,50)));
begin
  if p_period is null or p_period not in ('current','previous') then raise exception 'INVALID_PERIOD'; end if;
  select enabled_at into v_enabled from weekly_ovr_settings where id;
  v_now:=weekly_ovr_now();
  if v_enabled is null or v_now<v_enabled then return jsonb_build_object('enabled',false); end if;
  v_current:=weekly_ovr_week(v_now);
  -- Recover missing archives even after weeks of inactivity. No scheduler required.
  for v_old in select starts_at from weekly_ovr_periods
    where starts_at<v_current and closed_at is null order by starts_at loop
    perform close_weekly_ovr_period(v_old.starts_at);
  end loop;
  v_now:=weekly_ovr_now();v_current:=weekly_ovr_week(v_now);
  v_start:=case when p_period='previous' then v_current-interval '168 hours' else v_current end;
  insert into weekly_ovr_periods(starts_at,ends_at) values(v_start,v_start+interval '168 hours') on conflict do nothing;
  if p_period='previous' then
    perform close_weekly_ovr_period(v_start);
    select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'displayName',display_name,'score',score,'stage',stage) order by rank),'[]'::jsonb)
      into v_entries from (select * from weekly_ovr_snapshots where starts_at=v_start order by rank limit v_limit) t;
  else
    select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'displayName',display_name,'score',score,'stage',stage) order by rank),'[]'::jsonb)
      into v_entries from (select row_number() over(order by score desc,reached_at asc,puid collate "C" asc) rank,
        display_name,score,stage from weekly_ovr_entries where starts_at=v_start
        order by score desc,reached_at asc,puid collate "C" asc limit v_limit) t;
  end if;
  return jsonb_build_object('enabled',true,'scope','weekly','period',p_period,
    'weekId',to_char(v_start at time zone 'Asia/Shanghai','YYYY-MM-DD'),
    'startsAt',v_start,'endsAt',v_start+interval '168 hours','serverTime',v_now,'entries',v_entries);
end;
$$;

create or replace function public.get_weekly_ovr_rank(p_puid text,p_period text default 'current',p_week_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_enabled timestamptz; v_now timestamptz:=weekly_ovr_now();v_start timestamptz;v_current timestamptz;
  v_entry jsonb;v_week_date date;
begin
  if p_puid is null or p_period is null or p_period not in ('current','previous') then raise exception 'INVALID_REQUEST'; end if;
  select enabled_at into v_enabled from weekly_ovr_settings where id;
  if v_enabled is null or v_now<v_enabled then return jsonb_build_object('enabled',false); end if;
  v_current:=weekly_ovr_week(v_now);
  if p_week_id is not null then
    if p_week_id!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_WEEK'; end if;
    v_week_date:=p_week_id::date;
    v_start:=v_week_date::timestamp at time zone 'Asia/Shanghai';
    -- A request started just before rollover may legitimately pin the former week.
    if weekly_ovr_week(v_start)<>v_start or v_start>v_current
      or v_start<v_current-interval '336 hours'
      or (p_period='previous' and v_start=v_current)
      or (p_period='current' and v_start<v_current-interval '168 hours')
      then raise exception 'INVALID_WEEK'; end if;
  else v_start:=case when p_period='previous' then v_current-interval '168 hours' else v_current end;
  end if;
  if v_start<v_current then
    perform close_weekly_ovr_period(v_start);
    select jsonb_build_object('rank',rank,'score',score,'stage',stage) into v_entry
      from weekly_ovr_snapshots where starts_at=v_start and puid=p_puid;
  else
    select jsonb_build_object('rank',rank,'score',score,'stage',stage) into v_entry from (
      select puid,score,stage,row_number() over(order by score desc,reached_at asc,puid collate "C" asc) rank
      from weekly_ovr_entries where starts_at=v_start) t where puid=p_puid;
  end if;
  return jsonb_build_object('enabled',true,'scope','weekly',
    'weekId',to_char(v_start at time zone 'Asia/Shanghai','YYYY-MM-DD'),'entry',v_entry);
end;
$$;

-- No client can write weekly records or change the activation time.
revoke all on public.weekly_ovr_settings,public.weekly_ovr_periods,public.weekly_ovr_entries,public.weekly_ovr_snapshots from public,anon,authenticated;
grant select on public.weekly_ovr_settings,public.weekly_ovr_periods,public.weekly_ovr_entries,public.weekly_ovr_snapshots to service_role;
revoke all on function public.weekly_ovr_now(),public.weekly_ovr_week(timestamptz),public.assign_weekly_ovr_run(),public.close_weekly_ovr_period(timestamptz),public.record_weekly_ovr_battle(),public.get_weekly_ovr_page(text,integer),public.get_weekly_ovr_rank(text,text,text) from public,anon,authenticated;
grant execute on function public.get_weekly_ovr_page(text,integer),public.get_weekly_ovr_rank(text,text,text) to service_role;
commit;
