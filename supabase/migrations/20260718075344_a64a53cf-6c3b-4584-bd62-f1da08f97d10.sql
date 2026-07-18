CREATE TABLE public.site_flags (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_flags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_flags TO authenticated;
GRANT ALL ON public.site_flags TO service_role;

ALTER TABLE public.site_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site flags"
  ON public.site_flags FOR SELECT
  USING (true);

CREATE POLICY "Only admins can write site flags"
  ON public.site_flags FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

INSERT INTO public.site_flags(key, value) VALUES
  ('founders_monthiversary_hidden', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.site_flags;