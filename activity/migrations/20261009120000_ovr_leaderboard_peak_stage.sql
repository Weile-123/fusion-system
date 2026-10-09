-- Match the score to an actual battle; never substitute a run's final stage.
create or replace function public.get_ovr_leaderboard_page(p_limit integer default 50)
returns jsonb language sql stable security definer set search_path=public as $$
  with ranked as (
    select id,puid,display_name,score,updated_at,
      row_number() over(order by score desc,updated_at asc,id asc) as rank
    from public.leaderboard_entries where board='ovr' and verified
    order by score desc,updated_at asc,id asc
    limit greatest(1,least(50,coalesce(p_limit,50)))
  ), entries as (
    select t.rank,t.display_name,t.score,b.stage
    from ranked t left join lateral (
      select b.stage from public.leaderboard_runs r
      join public.leaderboard_battles b on b.run_id=r.id
      where r.puid=t.puid and r.proof_version=3 and b.rating=t.score
      order by r.created_at asc,b.battle_index asc limit 1
    ) b on true
  )
  select jsonb_build_object('entries',coalesce(jsonb_agg(
    jsonb_build_object('rank',rank,'displayName',display_name,'score',score,'stage',stage)
    order by rank),'[]'::jsonb)) from entries;
$$;
revoke all on function public.get_ovr_leaderboard_page(integer) from public,anon,authenticated;
grant execute on function public.get_ovr_leaderboard_page(integer) to service_role;
