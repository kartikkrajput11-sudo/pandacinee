
-- 1. Extend enums
ALTER TYPE punishment_type ADD VALUE IF NOT EXISTS 'card';
ALTER TYPE punishment_type ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE punishment_type ADD VALUE IF NOT EXISTS 'activity';
ALTER TYPE punishment_type ADD VALUE IF NOT EXISTS 'creative';

-- 2. Extend punishment_locks with verification state
ALTER TABLE public.punishment_locks
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verification_feedback text;

-- 3. Add per-category opt-ins to profiles (all default true; user opts out per category)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pl_cat_writing  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pl_cat_card     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pl_cat_video    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pl_cat_voice    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pl_cat_photo    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pl_cat_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pl_cat_creative boolean NOT NULL DEFAULT true;

-- 4. Verification chat messages
CREATE TABLE IF NOT EXISTS public.punishment_verification_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id uuid NOT NULL REFERENCES public.punishment_locks(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text', -- text | image | video | voice | card | drawing
  content text,
  media_url text,
  media_meta jsonb,
  submission boolean NOT NULL DEFAULT false, -- true when this is a formal submission awaiting approval
  approved boolean, -- null until reviewed; true = approved; false = retry
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pvm_lock_idx ON public.punishment_verification_messages(lock_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.punishment_verification_messages TO authenticated;
GRANT ALL ON public.punishment_verification_messages TO service_role;

ALTER TABLE public.punishment_verification_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pvm participants select"
  ON public.punishment_verification_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.punishment_locks l
      WHERE l.id = lock_id
        AND (auth.uid() = l.locker_id OR auth.uid() = l.target_id)
    )
  );

CREATE POLICY "pvm participants insert"
  ON public.punishment_verification_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.punishment_locks l
      WHERE l.id = lock_id
        AND (auth.uid() = l.locker_id OR auth.uid() = l.target_id)
    )
  );

CREATE POLICY "pvm participants update"
  ON public.punishment_verification_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.punishment_locks l
      WHERE l.id = lock_id
        AND (auth.uid() = l.locker_id OR auth.uid() = l.target_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.punishment_locks l
      WHERE l.id = lock_id
        AND (auth.uid() = l.locker_id OR auth.uid() = l.target_id)
    )
  );

CREATE POLICY "pvm participants delete"
  ON public.punishment_verification_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.punishment_locks l
      WHERE l.id = lock_id
        AND (auth.uid() = l.locker_id OR auth.uid() = l.target_id)
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.punishment_verification_messages;
