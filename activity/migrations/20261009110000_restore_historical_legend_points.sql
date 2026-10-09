-- Credit only pre-verification cloud totals backed by finished server run records.
-- Local balances and client-declared scores are not imported.
create table public.leaderboard_legacy_credit (
  puid text primary key,
  points integer not null check (points > 0),
  credited_at timestamptz not null default now()
);
revoke all on table public.leaderboard_legacy_credit from public,anon,authenticated;
grant select on table public.leaderboard_legacy_credit to service_role;

do $restore$
declare old_record record; new_score integer;
begin
  for old_record in
    select old.puid,old.display_name,old.score
    from public.leaderboard_entries_before_verification old
    join (
      select puid,sum(case cleared_stage
        when 5 then 50 when 6 then 60 when 7 then 70 when 8 then 80
        when 9 then 90 when 10 then 200 else 0 end + endless_wins*50) as points
      from public.leaderboard_runs where proof_version=0 and finished group by puid
    ) settled on settled.puid=old.puid and settled.points=old.score
    where old.board='legend' and old.score>0
  loop
    perform pg_advisory_xact_lock(hashtextextended(old_record.puid,0));
    if exists(select 1 from public.leaderboard_legacy_credit where puid=old_record.puid) then continue; end if;
    select case when verified then score else 0 end into new_score
      from public.leaderboard_entries where puid=old_record.puid and board='legend' for update;
    insert into public.leaderboard_legacy_credit(puid,points) values(old_record.puid,old_record.score);
    insert into public.leaderboard_entries(puid,board,score,display_name,updated_at,verified)
      values(old_record.puid,'legend',old_record.score+coalesce(new_score,0),old_record.display_name,now(),true)
      on conflict(puid,board) do update set score=excluded.score,verified=true,updated_at=excluded.updated_at;
  end loop;
end;
$restore$;
