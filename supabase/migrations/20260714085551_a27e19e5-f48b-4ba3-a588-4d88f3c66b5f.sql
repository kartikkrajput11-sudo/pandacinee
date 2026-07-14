ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx ON public.profiles(last_seen_at);