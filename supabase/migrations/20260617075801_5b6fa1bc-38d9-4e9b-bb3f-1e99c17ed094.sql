
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT upper(substring(md5(random()::text), 1, 6)),
  partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Users can read their own profile and their partner's profile; partner discovery via invite_code lookup also allowed
CREATE POLICY "Profiles viewable by self or partner"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR partner_id = auth.uid() OR id IN (SELECT partner_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  IF base_username IS NULL OR base_username = '' THEN base_username := 'panda'; END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Pair partners by invite code (SECURITY DEFINER so the user can look up + write the partner's row)
CREATE OR REPLACE FUNCTION public.pair_with_invite_code(_code TEXT)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  partner public.profiles;
  my_profile public.profiles;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO my_profile FROM public.profiles WHERE id = me;
  IF my_profile.partner_id IS NOT NULL THEN RAISE EXCEPTION 'You are already paired'; END IF;
  SELECT * INTO partner FROM public.profiles WHERE invite_code = upper(trim(_code));
  IF partner IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  IF partner.id = me THEN RAISE EXCEPTION 'You cannot pair with yourself'; END IF;
  IF partner.partner_id IS NOT NULL THEN RAISE EXCEPTION 'That panda already has a partner'; END IF;
  UPDATE public.profiles SET partner_id = partner.id, paired_at = now() WHERE id = me;
  UPDATE public.profiles SET partner_id = me, paired_at = now() WHERE id = partner.id;
  SELECT * INTO partner FROM public.profiles WHERE id = partner.id;
  RETURN partner;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pair_with_invite_code(TEXT) TO authenticated;

-- Messages between paired partners
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_pair_idx ON public.messages (sender_id, receiver_id, created_at DESC);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own conversation"
  ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Send to partner only"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND receiver_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  );

-- Watch rooms: one per pair, holds sync state
CREATE TABLE public.watch_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT,
  video_title TEXT,
  position_seconds NUMERIC NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  last_event TEXT,
  last_actor_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pair_unique UNIQUE (host_id, partner_id)
);
GRANT SELECT, INSERT, UPDATE ON public.watch_rooms TO authenticated;
GRANT ALL ON public.watch_rooms TO service_role;
ALTER TABLE public.watch_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read room"
  ON public.watch_rooms FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "Members create room"
  ON public.watch_rooms FOR INSERT TO authenticated
  WITH CHECK (
    host_id = auth.uid()
    AND partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "Members update room"
  ON public.watch_rooms FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR partner_id = auth.uid())
  WITH CHECK (host_id = auth.uid() OR partner_id = auth.uid());
CREATE TRIGGER watch_rooms_touch_updated_at BEFORE UPDATE ON public.watch_rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
