create or replace function public.get_game_leaderboard_rank(p_puid text, p_board text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry public.leaderboard_entries; v_rank bigint;
begin
  if p_board not in ('legend', 'ovr') then raise exception 'INVALID_BOARD'; end if;
  select * into v_entry from public.leaderboard_entries where puid = p_puid and board = p_board;
  if not found then return null; end if;
  select count(*) + 1 into v_rank from public.leaderboard_entries
    where board = p_board and (
      score > v_entry.score or
      (score = v_entry.score and (updated_at, id) < (v_entry.updated_at, v_entry.id))
    );
  return jsonb_build_object('rank', v_rank, 'score', v_entry.score);
end;
$$;
revoke all on function public.get_game_leaderboard_rank(text, text) from public, anon, authenticated;
grant execute on function public.get_game_leaderboard_rank(text, text) to service_role;
