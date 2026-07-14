-- Punishment Lock feature
CREATE TYPE public.punishment_type AS ENUM ('write','compliment','funny','draw','photo','voice','quiz');
CREATE TYPE public.punishment_status AS ENUM ('active','completed','cancelled','expired');

CREATE TABLE public.punishment_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  locker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.punishment_type NOT NULL,
  prompt TEXT NOT NULL,
  required_count INTEGER NOT NULL DEFAULT 1,
  progress INTEGER NOT NULL DEFAULT 0,
  status public.punishment_status NOT NULL DEFAULT 'active',
  max_duration_seconds INTEGER,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT punishment_no_self CHECK (locker_id <> target_id)
);

CREATE INDEX punishment_locks_pair_idx ON public.punishment_locks(locker_id, target_id, status);
CREATE INDEX punishment_locks_target_idx ON public.punishment_locks(target_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.punishment_locks TO authenticated;
GRANT ALL ON public.punishment_locks TO service_role;

ALTER TABLE public.punishment_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can select" ON public.punishment_locks
  FOR SELECT TO authenticated
  USING (auth.uid() = locker_id OR auth.uid() = target_id);

CREATE POLICY "locker inserts" ON public.punishment_locks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = locker_id);

CREATE POLICY "participants update" ON public.punishment_locks
  FOR UPDATE TO authenticated
  USING (auth.uid() = locker_id OR auth.uid() = target_id)
  WITH CHECK (auth.uid() = locker_id OR auth.uid() = target_id);

CREATE POLICY "locker deletes" ON public.punishment_locks
  FOR DELETE TO authenticated
  USING (auth.uid() = locker_id OR auth.uid() = target_id);

CREATE TRIGGER punishment_locks_touch
  BEFORE UPDATE ON public.punishment_locks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.punishment_locks;

-- Opt-out preference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS punishment_lock_enabled BOOLEAN NOT NULL DEFAULT true;
