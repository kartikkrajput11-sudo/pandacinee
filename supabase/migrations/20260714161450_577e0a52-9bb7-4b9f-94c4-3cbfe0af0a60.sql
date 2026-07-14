
CREATE TABLE public.paint_strokes (
  id UUID NOT NULL PRIMARY KEY,
  pair_key TEXT NOT NULL,
  by_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stroke JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX paint_strokes_pair_idx ON public.paint_strokes (pair_key, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paint_strokes TO authenticated;
GRANT ALL ON public.paint_strokes TO service_role;

ALTER TABLE public.paint_strokes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated whose id appears in the pair_key can read
CREATE POLICY "Members of pair can read strokes"
  ON public.paint_strokes FOR SELECT
  TO authenticated
  USING (pair_key LIKE '%' || auth.uid()::text || '%');

CREATE POLICY "User can insert own strokes for their pair"
  ON public.paint_strokes FOR INSERT
  TO authenticated
  WITH CHECK (by_user = auth.uid() AND pair_key LIKE '%' || auth.uid()::text || '%');

CREATE POLICY "User can delete own strokes"
  ON public.paint_strokes FOR DELETE
  TO authenticated
  USING (by_user = auth.uid());
