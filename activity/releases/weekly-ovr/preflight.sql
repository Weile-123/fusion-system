-- READ ONLY. Use after migration; save the result with the deployment record.
select version() as database_version;
select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='leaderboard_runs'
  and column_name in ('proof_version','state','weekly_ovr_start');
select tgname,tgenabled from pg_trigger where not tgisinternal
  and tgname in ('assign_weekly_ovr_run','record_weekly_ovr_battle');
select proname,prosecdef from pg_proc where oid in (
  to_regprocedure('public.get_weekly_ovr_page(text,integer)'),
  to_regprocedure('public.get_weekly_ovr_rank(text,text,text)'));
select enabled_at from public.weekly_ovr_settings where id;
select count(*) as cumulative_rows from public.leaderboard_entries;
select count(*) as weekly_rows from public.weekly_ovr_entries;
select starts_at,ends_at,closed_at from public.weekly_ovr_periods order by starts_at desc limit 4;
select has_table_privilege('authenticated','public.weekly_ovr_settings','UPDATE') as client_can_activate,
  has_table_privilege('authenticated','public.weekly_ovr_entries','INSERT') as client_can_write,
  has_function_privilege('service_role','public.get_weekly_ovr_page(text,integer)','EXECUTE') as service_can_read;
