-- Include distinct discovered events in the authoritative career profile.
create or replace function public.get_verified_game_profile(p_puid text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_progress jsonb; v_earned integer; v_profile jsonb; v_discovered jsonb; v_events jsonb;
begin
  select progress into v_progress from verified_game_progress where puid=p_puid;
  select score into v_earned from leaderboard_entries where puid=p_puid and board='legend' and verified;
  select coalesce(jsonb_agg(distinct found.player), '[]'::jsonb) into v_discovered from leaderboard_runs r,
    lateral jsonb_array_elements(coalesce(r.state->'collectedPlayers','[]'::jsonb)) as found(player)
    where r.puid=p_puid and r.proof_version=3 and r.finished;
  select coalesce(jsonb_agg(distinct found.event), '[]'::jsonb) into v_events from leaderboard_runs r,
    lateral jsonb_array_elements(coalesce(r.state->'eventState'->'seen','[]'::jsonb)) as found(event)
    where r.puid=p_puid and r.proof_version=3 and r.finished;
  select jsonb_build_object('runs',count(*),'wins',coalesce(sum(wins),0),
    'clears',count(*) filter (where cleared_stage>=10),'bestStage',coalesce(max(cleared_stage),0),
    'bestEndless',coalesce(max(case when (state->>'endless')::boolean then (state->>'stage')::integer else 0 end),0),
    'discovered',v_discovered,'discoveredEvents',v_events)
    into v_profile from leaderboard_runs where puid=p_puid and proof_version=3 and finished;
  return jsonb_build_object('progress',coalesce(v_progress,'{}'::jsonb),'earned',coalesce(v_earned,0),'profile',v_profile);
end;
$$;
revoke all on function public.get_verified_game_profile(text) from public,anon,authenticated;
grant execute on function public.get_verified_game_profile(text) to service_role;
