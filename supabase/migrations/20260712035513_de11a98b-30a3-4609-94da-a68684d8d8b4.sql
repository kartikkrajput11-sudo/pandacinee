-- Admin flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_visible BOOLEAN NOT NULL DEFAULT true;

-- Admin helper (SECURITY DEFINER, avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _user_id), false);
$$;

-- Custom movies table
CREATE TABLE IF NOT EXISTS public.custom_movies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  year INT,
  overview TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  runtime INT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  video_storage_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.custom_movies TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.custom_movies TO authenticated;
GRANT ALL ON public.custom_movies TO service_role;

ALTER TABLE public.custom_movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view custom movies"
  ON public.custom_movies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert custom movies"
  ON public.custom_movies FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update custom movies"
  ON public.custom_movies FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete custom movies"
  ON public.custom_movies FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_custom_movies_updated_at
  BEFORE UPDATE ON public.custom_movies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Bootstrap: any signed-in user can claim admin (used by PIN gate).
-- The PIN is verified client-side; this fn requires an authenticated caller
-- and simply flips the flag on their own profile.
CREATE OR REPLACE FUNCTION public.claim_admin(_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin <> '1804' THEN RETURN false; END IF;
  UPDATE public.profiles SET is_admin = true WHERE id = auth.uid();
  RETURN true;
END;
$$;

-- Unpair helper: clears both sides atomically
CREATE OR REPLACE FUNCTION public.unpair_partner()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me_id UUID := auth.uid();
DECLARE p_id UUID;
BEGIN
  IF me_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT partner_id INTO p_id FROM public.profiles WHERE id = me_id;
  IF p_id IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET partner_id = NULL, paired_at = NULL WHERE id IN (me_id, p_id);
END;
$$;