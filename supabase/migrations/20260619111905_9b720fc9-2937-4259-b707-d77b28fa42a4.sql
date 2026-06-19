
-- Extend messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_meta jsonb,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS messages_pair_idx ON public.messages (sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS messages_pinned_idx ON public.messages (receiver_id, sender_id) WHERE pinned;
CREATE INDEX IF NOT EXISTS messages_expires_idx ON public.messages (expires_at) WHERE expires_at IS NOT NULL;

-- Allow participants to update (reactions, read_at, pinned) and sender to delete
DROP POLICY IF EXISTS "Participants update" ON public.messages;
CREATE POLICY "Participants update" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Sender deletes" ON public.messages;
CREATE POLICY "Sender deletes" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Extend profiles with mood
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mood text,
  ADD COLUMN IF NOT EXISTS mood_emoji text,
  ADD COLUMN IF NOT EXISTS mood_updated_at timestamptz;

-- Cleanup function for expired (disappearing) messages
CREATE OR REPLACE FUNCTION public.purge_expired_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.messages WHERE expires_at IS NOT NULL AND expires_at < now();
$$;

GRANT EXECUTE ON FUNCTION public.purge_expired_messages() TO authenticated;

-- Storage policies for chat-media bucket (bucket created via tool)
-- Will be added after bucket exists.
