
-- =========== GROUP EVENTS (plans / RSVPs) ===========
CREATE TABLE IF NOT EXISTS public.group_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_events TO authenticated;
GRANT ALL ON public.group_events TO service_role;
ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members can read events"
  ON public.group_events FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "group members can create events"
  ON public.group_events FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "creator or admin can update events"
  ON public.group_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "creator or admin can delete events"
  ON public.group_events FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.group_event_rsvps (
  event_id UUID NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes','no','maybe')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_rsvps TO authenticated;
GRANT ALL ON public.group_event_rsvps TO service_role;
ALTER TABLE public.group_event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read rsvps"
  ON public.group_event_rsvps FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_events e
    WHERE e.id = event_id AND public.is_group_member(e.group_id, auth.uid())
  ));
CREATE POLICY "self rsvp insert"
  ON public.group_event_rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.group_events e
    WHERE e.id = event_id AND public.is_group_member(e.group_id, auth.uid())
  ));
CREATE POLICY "self rsvp update"
  ON public.group_event_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "self rsvp delete"
  ON public.group_event_rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =========== GROUP MATCHES (duel + observers) ===========
CREATE TABLE IF NOT EXISTS public.group_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  game TEXT NOT NULL,           -- 'chess' | 'knowme' | 'hideseek' etc.
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_players INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','live','ended')),
  external_ref TEXT,            -- e.g. chess_games.id when the match is running
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_matches TO authenticated;
GRANT ALL ON public.group_matches TO service_role;
ALTER TABLE public.group_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read matches"
  ON public.group_matches FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members create matches"
  ON public.group_matches FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "creator or admin update matches"
  ON public.group_matches FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.group_match_participants (
  match_id UUID NOT NULL REFERENCES public.group_matches(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('player','observer')),
  seat INT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_match_participants TO authenticated;
GRANT ALL ON public.group_match_participants TO service_role;
ALTER TABLE public.group_match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members read participants"
  ON public.group_match_participants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_matches gm
    WHERE gm.id = match_id AND public.is_group_member(gm.group_id, auth.uid())
  ));
CREATE POLICY "self join match"
  ON public.group_match_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.group_matches gm
    WHERE gm.id = match_id AND public.is_group_member(gm.group_id, auth.uid())
  ));
CREATE POLICY "self leave match"
  ON public.group_match_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =========== OBSERVER MESSAGES ===========
CREATE TABLE IF NOT EXISTS public.observer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.group_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.observer_messages TO authenticated;
GRANT ALL ON public.observer_messages TO service_role;
ALTER TABLE public.observer_messages ENABLE ROW LEVEL SECURITY;

-- Only observers of the match can read/write observer chat; players cannot see it.
CREATE OR REPLACE FUNCTION public.is_match_observer(_match_id UUID, _uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_match_participants
    WHERE match_id = _match_id AND user_id = _uid AND role = 'observer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_match_player(_match_id UUID, _uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_match_participants
    WHERE match_id = _match_id AND user_id = _uid AND role = 'player'
  );
$$;

CREATE POLICY "observers read observer chat"
  ON public.observer_messages FOR SELECT TO authenticated
  USING (public.is_match_observer(match_id, auth.uid()));
CREATE POLICY "observers write observer chat"
  ON public.observer_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_match_observer(match_id, auth.uid()));
CREATE POLICY "self delete observer chat"
  ON public.observer_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- =========== PLAYER CHAT (visible to players AND observers) ===========
CREATE TABLE IF NOT EXISTS public.match_player_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.group_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.match_player_messages TO authenticated;
GRANT ALL ON public.match_player_messages TO service_role;
ALTER TABLE public.match_player_messages ENABLE ROW LEVEL SECURITY;

-- Players write; players + observers read (observers spectate the convo).
CREATE POLICY "players and observers read player chat"
  ON public.match_player_messages FOR SELECT TO authenticated
  USING (
    public.is_match_player(match_id, auth.uid())
    OR public.is_match_observer(match_id, auth.uid())
  );
CREATE POLICY "players write player chat"
  ON public.match_player_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_match_player(match_id, auth.uid()));
CREATE POLICY "self delete player chat"
  ON public.match_player_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- =========== Realtime ===========
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_event_rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_match_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.observer_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_player_messages;

-- Convenience: seat the creator as player when a match is created.
CREATE OR REPLACE FUNCTION public.create_group_match(_group_id UUID, _game TEXT, _max_players INT DEFAULT 2)
RETURNS public.group_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid(); m public.group_matches;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_group_member(_group_id, me) THEN RAISE EXCEPTION 'Not a group member'; END IF;
  INSERT INTO public.group_matches (group_id, game, created_by, max_players)
    VALUES (_group_id, _game, me, GREATEST(2, LEAST(_max_players, 8))) RETURNING * INTO m;
  INSERT INTO public.group_match_participants (match_id, user_id, role, seat)
    VALUES (m.id, me, 'player', 1);
  RETURN m;
END $$;

-- Join: seats you as player if seats open, else observer.
CREATE OR REPLACE FUNCTION public.join_group_match(_match_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  m public.group_matches;
  player_count INT;
  existing_role TEXT;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.group_matches WHERE id = _match_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF NOT public.is_group_member(m.group_id, me) THEN RAISE EXCEPTION 'Not a group member'; END IF;

  SELECT role INTO existing_role FROM public.group_match_participants
    WHERE match_id = _match_id AND user_id = me;
  IF existing_role IS NOT NULL THEN RETURN existing_role; END IF;

  SELECT COUNT(*) INTO player_count FROM public.group_match_participants
    WHERE match_id = _match_id AND role = 'player';

  IF player_count < m.max_players AND m.status = 'lobby' THEN
    INSERT INTO public.group_match_participants (match_id, user_id, role, seat)
      VALUES (_match_id, me, 'player', player_count + 1);
    RETURN 'player';
  ELSE
    INSERT INTO public.group_match_participants (match_id, user_id, role)
      VALUES (_match_id, me, 'observer');
    RETURN 'observer';
  END IF;
END $$;
