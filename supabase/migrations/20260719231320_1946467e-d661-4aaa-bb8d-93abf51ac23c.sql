
CREATE OR REPLACE FUNCTION public.start_group_match(_match_id uuid)
RETURNS public.group_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  m public.group_matches;
  player_count int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.group_matches WHERE id = _match_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m.created_by <> me THEN RAISE EXCEPTION 'Only the host can start this match'; END IF;
  IF m.status <> 'lobby' THEN RETURN m; END IF;
  SELECT COUNT(*) INTO player_count FROM public.group_match_participants
    WHERE match_id = _match_id AND role = 'player';
  IF player_count < 2 THEN RAISE EXCEPTION 'Need at least 2 seated players'; END IF;
  UPDATE public.group_matches
    SET status = 'live', started_at = now()
    WHERE id = _match_id
    RETURNING * INTO m;
  RETURN m;
END;
$function$;
