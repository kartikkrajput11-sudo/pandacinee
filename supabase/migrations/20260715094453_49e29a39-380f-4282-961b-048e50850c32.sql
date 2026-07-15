
-- ============== watch_parties ==============
CREATE TABLE public.watch_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_kind text NOT NULL CHECK (media_kind IN ('movie','tv','custom')),
  media_id text NOT NULL,
  media_title text,
  media_poster text,
  season int,
  episode int,
  source_idx int NOT NULL DEFAULT 0,
  position_seconds double precision NOT NULL DEFAULT 0,
  is_playing boolean NOT NULL DEFAULT false,
  last_actor_id uuid,
  last_event text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_parties TO authenticated;
GRANT ALL ON public.watch_parties TO service_role;

ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;

-- ============== watch_party_members ==============
CREATE TABLE public.watch_party_members (
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_party_members TO authenticated;
GRANT ALL ON public.watch_party_members TO service_role;

ALTER TABLE public.watch_party_members ENABLE ROW LEVEL SECURITY;

-- ============== watch_party_messages ==============
CREATE TABLE public.watch_party_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_party_messages TO authenticated;
GRANT ALL ON public.watch_party_messages TO service_role;

ALTER TABLE public.watch_party_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX watch_party_messages_party_created_idx
  ON public.watch_party_messages (party_id, created_at DESC);

-- ============== Helper: is_watch_party_member ==============
CREATE OR REPLACE FUNCTION public.is_watch_party_member(_pid uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.watch_party_members
    WHERE party_id = _pid AND user_id = _uid
  );
$$;

-- ============== Policies: watch_parties ==============
CREATE POLICY "Members can view their party"
  ON public.watch_parties FOR SELECT TO authenticated
  USING (public.is_watch_party_member(id, auth.uid()) OR host_id = auth.uid());

CREATE POLICY "Users create parties as host"
  ON public.watch_parties FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Members update party state"
  ON public.watch_parties FOR UPDATE TO authenticated
  USING (public.is_watch_party_member(id, auth.uid()))
  WITH CHECK (public.is_watch_party_member(id, auth.uid()));

CREATE POLICY "Host can delete party"
  ON public.watch_parties FOR DELETE TO authenticated
  USING (host_id = auth.uid());

-- ============== Policies: watch_party_members ==============
CREATE POLICY "Members can see co-members"
  ON public.watch_party_members FOR SELECT TO authenticated
  USING (public.is_watch_party_member(party_id, auth.uid()));

CREATE POLICY "Users can add themselves"
  ON public.watch_party_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own membership"
  ON public.watch_party_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can leave"
  ON public.watch_party_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============== Policies: watch_party_messages ==============
CREATE POLICY "Members can read party chat"
  ON public.watch_party_messages FOR SELECT TO authenticated
  USING (public.is_watch_party_member(party_id, auth.uid()));

CREATE POLICY "Members can send in party chat"
  ON public.watch_party_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_watch_party_member(party_id, auth.uid())
  );

CREATE POLICY "Sender can delete own message"
  ON public.watch_party_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- ============== Join by code (SECURITY DEFINER) ==============
CREATE OR REPLACE FUNCTION public.join_watch_party(_code text)
RETURNS public.watch_parties
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  p public.watch_parties;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO p FROM public.watch_parties
    WHERE code = upper(trim(_code))
    LIMIT 1;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Party not found'; END IF;
  INSERT INTO public.watch_party_members (party_id, user_id)
    VALUES (p.id, me)
    ON CONFLICT (party_id, user_id) DO UPDATE
    SET last_seen_at = now();
  RETURN p;
END;
$$;

-- ============== updated_at trigger ==============
CREATE TRIGGER watch_parties_touch
  BEFORE UPDATE ON public.watch_parties
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== Realtime ==============
ALTER TABLE public.watch_parties REPLICA IDENTITY FULL;
ALTER TABLE public.watch_party_members REPLICA IDENTITY FULL;
ALTER TABLE public.watch_party_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_messages;
