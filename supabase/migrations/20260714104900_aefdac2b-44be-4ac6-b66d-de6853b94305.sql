CREATE TABLE public.custom_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_id UUID NOT NULL REFERENCES public.custom_movies(id) ON DELETE CASCADE,
  season INTEGER NOT NULL CHECK (season >= 0),
  episode INTEGER NOT NULL CHECK (episode >= 0),
  title TEXT,
  overview TEXT,
  still_url TEXT,
  runtime INTEGER,
  video_url TEXT,
  video_storage_path TEXT,
  use_vidking BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(movie_id, season, episode)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_episodes TO authenticated;
GRANT ALL ON public.custom_episodes TO service_role;

ALTER TABLE public.custom_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view episodes"
  ON public.custom_episodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert episodes"
  ON public.custom_episodes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update episodes"
  ON public.custom_episodes FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete episodes"
  ON public.custom_episodes FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER touch_custom_episodes_updated_at
  BEFORE UPDATE ON public.custom_episodes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_custom_episodes_movie ON public.custom_episodes(movie_id, season, episode);