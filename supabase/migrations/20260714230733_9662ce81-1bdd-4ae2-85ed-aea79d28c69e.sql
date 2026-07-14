
CREATE TABLE public.scribble_stats (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wins INT NOT NULL DEFAULT 0,
  correct_guesses INT NOT NULL DEFAULT 0,
  games_played INT NOT NULL DEFAULT 0,
  rounds_drawn INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scribble_stats TO authenticated;
GRANT ALL ON public.scribble_stats TO service_role;

ALTER TABLE public.scribble_stats ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read stats (needed to render partner's totals on the leaderboard).
CREATE POLICY "Signed-in users can read scribble stats"
  ON public.scribble_stats
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can only write their own row.
CREATE POLICY "Users can insert their own scribble stats"
  ON public.scribble_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scribble stats"
  ON public.scribble_stats
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER scribble_stats_touch_updated_at
  BEFORE UPDATE ON public.scribble_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
