
CREATE TABLE public.paint_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_key TEXT NOT NULL,
  by_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strokes JSONB NOT NULL,
  background TEXT,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX paint_gallery_pair_idx ON public.paint_gallery (pair_key, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paint_gallery TO authenticated;
GRANT ALL ON public.paint_gallery TO service_role;

ALTER TABLE public.paint_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair members can read gallery"
  ON public.paint_gallery FOR SELECT
  TO authenticated
  USING (pair_key LIKE '%' || auth.uid()::text || '%');

CREATE POLICY "Pair members can insert into gallery"
  ON public.paint_gallery FOR INSERT
  TO authenticated
  WITH CHECK (by_user = auth.uid() AND pair_key LIKE '%' || auth.uid()::text || '%');

CREATE POLICY "Pair members can delete from gallery"
  ON public.paint_gallery FOR DELETE
  TO authenticated
  USING (pair_key LIKE '%' || auth.uid()::text || '%');
