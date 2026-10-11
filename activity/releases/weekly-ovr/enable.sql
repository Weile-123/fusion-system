-- Prepared only. Do NOT execute until the migration and compatible API have
-- passed deployment checks. This is a one-time activation, not a weekly task.
begin;
do $$
begin
  if to_regprocedure('public.get_weekly_ovr_page(text,integer)') is null
    or to_regprocedure('public.get_weekly_ovr_rank(text,text,text)') is null then
    raise exception 'WEEKLY_SCHEMA_NOT_READY';
  end if;
end;
$$;
-- Default: start immediately. The first week may be shorter than seven days.
-- To launch on a complete Monday, replace clock_timestamp() with the chosen
-- ISO timestamp INCLUDING timezone, e.g. '2026-10-12T00:00:00+08:00'::timestamptz.
-- Never move the timestamp after activation or reset old week/run attribution.
update public.weekly_ovr_settings set enabled_at=clock_timestamp()
where id and enabled_at is null;
select enabled_at from public.weekly_ovr_settings where id;
commit;
