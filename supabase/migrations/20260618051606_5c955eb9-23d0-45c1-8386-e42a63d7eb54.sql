
-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_color text,
  ADD COLUMN IF NOT EXISTS favorite_emoji text,
  ADD COLUMN IF NOT EXISTS anniversary_date date,
  ADD COLUMN IF NOT EXISTS partner_nickname text,
  ADD COLUMN IF NOT EXISTS bio text;

CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (lower(username));

-- Time capsules
CREATE TABLE public.time_capsules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  title text,
  content text NOT NULL,
  unlock_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_capsules TO authenticated;
GRANT ALL ON public.time_capsules TO service_role;
ALTER TABLE public.time_capsules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sender can read own capsules" ON public.time_capsules FOR SELECT TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "Recipient reads after unlock" ON public.time_capsules FOR SELECT TO authenticated USING (recipient_id = auth.uid() AND unlock_at <= now());
CREATE POLICY "Sender inserts" ON public.time_capsules FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Sender deletes" ON public.time_capsules FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- Game sessions
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  partner_id uuid NOT NULL,
  game text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read" ON public.game_sessions FOR SELECT TO authenticated USING (host_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "Host creates" ON public.game_sessions FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "Players update" ON public.game_sessions FOR UPDATE TO authenticated USING (host_id = auth.uid() OR partner_id = auth.uid()) WITH CHECK (host_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "Players delete" ON public.game_sessions FOR DELETE TO authenticated USING (host_id = auth.uid() OR partner_id = auth.uid());
CREATE TRIGGER touch_game_sessions BEFORE UPDATE ON public.game_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Friendships
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read" ON public.friendships FOR SELECT TO authenticated USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "Requester inserts" ON public.friendships FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Addressee updates" ON public.friendships FOR UPDATE TO authenticated USING (addressee_id = auth.uid() OR requester_id = auth.uid()) WITH CHECK (addressee_id = auth.uid() OR requester_id = auth.uid());
CREATE POLICY "Participants delete" ON public.friendships FOR DELETE TO authenticated USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE TRIGGER touch_friendships BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Public profile search: allow viewing only username+display_name+avatar via a narrow function
CREATE OR REPLACE FUNCTION public.search_profiles(_q text)
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, username, display_name, avatar_url
  FROM public.profiles
  WHERE auth.uid() IS NOT NULL
    AND id <> auth.uid()
    AND (lower(username) LIKE lower(_q) || '%' OR lower(display_name) LIKE lower(_q) || '%')
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_profiles(text) TO authenticated;

-- Call signals (WebRTC signaling via realtime)
CREATE TABLE public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL,
  to_id uuid NOT NULL,
  kind text NOT NULL, -- 'invite' | 'accept' | 'decline' | 'offer' | 'answer' | 'ice' | 'hangup'
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.call_signals TO authenticated;
GRANT ALL ON public.call_signals TO service_role;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sender or recipient read" ON public.call_signals FOR SELECT TO authenticated USING (from_id = auth.uid() OR to_id = auth.uid());
CREATE POLICY "Sender inserts" ON public.call_signals FOR INSERT TO authenticated WITH CHECK (from_id = auth.uid());
CREATE POLICY "Participants delete" ON public.call_signals FOR DELETE TO authenticated USING (from_id = auth.uid() OR to_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
