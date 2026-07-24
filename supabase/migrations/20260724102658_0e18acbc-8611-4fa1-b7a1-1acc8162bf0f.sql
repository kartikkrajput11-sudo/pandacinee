
-- Wishlist voting: store per-user vote (1 love, 0 neutral, -1 pass)
ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS votes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Post-movie reflection prompts
CREATE TABLE IF NOT EXISTS public.post_movie_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id uuid NOT NULL,
  user_id uuid NOT NULL,
  partner_id uuid,
  rating int CHECK (rating BETWEEN 1 AND 5),
  favorite_moment text,
  mood text,
  would_rewatch boolean DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (movie_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_movie_prompts TO authenticated;
GRANT ALL ON public.post_movie_prompts TO service_role;

ALTER TABLE public.post_movie_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own or partner reflections"
  ON public.post_movie_prompts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = partner_id);

CREATE POLICY "Users insert own reflections"
  ON public.post_movie_prompts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reflections"
  ON public.post_movie_prompts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own reflections"
  ON public.post_movie_prompts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_post_movie_prompts_updated ON public.post_movie_prompts;
CREATE TRIGGER trg_post_movie_prompts_updated
  BEFORE UPDATE ON public.post_movie_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.post_movie_prompts;
