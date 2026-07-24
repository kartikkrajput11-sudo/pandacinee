
CREATE TABLE public.relationship_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_a uuid NOT NULL,
  partner_b uuid NOT NULL,
  author_id uuid NOT NULL,
  title text,
  body text NOT NULL,
  photo_url text,
  mood text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_pair_ordered CHECK (partner_a < partner_b)
);

CREATE INDEX rje_pair_idx ON public.relationship_journal_entries (partner_a, partner_b, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_journal_entries TO authenticated;
GRANT ALL ON public.relationship_journal_entries TO service_role;

ALTER TABLE public.relationship_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can read shared journal"
  ON public.relationship_journal_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = partner_a OR auth.uid() = partner_b);

CREATE POLICY "Author can insert into their pair"
  ON public.relationship_journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (auth.uid() = partner_a OR auth.uid() = partner_b)
    AND partner_a < partner_b
  );

CREATE POLICY "Author can update own entry"
  ON public.relationship_journal_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author can delete own entry"
  ON public.relationship_journal_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.rje_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER rje_touch_updated_at
  BEFORE UPDATE ON public.relationship_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.rje_touch_updated_at();
