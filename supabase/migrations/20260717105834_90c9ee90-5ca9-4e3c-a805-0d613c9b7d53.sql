DROP TABLE IF EXISTS public.watch_sync_members CASCADE;

CREATE TABLE public.watch_sync_members (
  room_key text NOT NULL,
  user_id uuid NOT NULL,
  partner_id uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ready boolean NOT NULL DEFAULT false,
  source_kind text NOT NULL DEFAULT 'unknown' CHECK (source_kind IN ('pandacine', 'iframe', 'unknown')),
  current_seconds double precision NOT NULL DEFAULT 0,
  duration_seconds double precision NOT NULL DEFAULT 0,
  playback_rate double precision NOT NULL DEFAULT 1,
  source_idx integer NOT NULL DEFAULT 0,
  season integer,
  episode integer,
  event text,
  event_at timestamptz,
  is_host boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_key, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_sync_members TO authenticated;
GRANT ALL ON public.watch_sync_members TO service_role;

ALTER TABLE public.watch_sync_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watch sync participants read room"
ON public.watch_sync_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR partner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.watch_sync_members mine
    WHERE mine.room_key = watch_sync_members.room_key
      AND mine.user_id = auth.uid()
  )
);

CREATE POLICY "watch sync users insert own row"
ON public.watch_sync_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    partner_id IS NULL
    OR partner_id = (SELECT p.partner_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_accepted_friend(partner_id)
  )
);

CREATE POLICY "watch sync users update own row"
ON public.watch_sync_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    partner_id IS NULL
    OR partner_id = (SELECT p.partner_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_accepted_friend(partner_id)
  )
);

CREATE POLICY "watch sync users delete own row"
ON public.watch_sync_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX watch_sync_members_room_seen_idx
  ON public.watch_sync_members (room_key, last_seen_at DESC);

CREATE TRIGGER watch_sync_members_touch
  BEFORE UPDATE ON public.watch_sync_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.watch_sync_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_sync_members;