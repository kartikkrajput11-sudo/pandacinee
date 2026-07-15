ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.profile_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_key text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag_key)
);

GRANT SELECT, INSERT, DELETE ON public.profile_achievements TO authenticated;
GRANT ALL ON public.profile_achievements TO service_role;

ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view achievements"
  ON public.profile_achievements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users manage their own achievements"
  ON public.profile_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own achievements"
  ON public.profile_achievements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS profile_achievements_user_idx ON public.profile_achievements (user_id);