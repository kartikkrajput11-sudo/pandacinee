ALTER TABLE public.custom_movies
  ADD COLUMN IF NOT EXISTS tmdb_id integer,
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'movie',
  ADD COLUMN IF NOT EXISTS use_vidking boolean NOT NULL DEFAULT false;