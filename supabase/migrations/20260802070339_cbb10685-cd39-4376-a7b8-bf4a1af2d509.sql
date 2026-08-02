ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday date;

CREATE TABLE public.important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  emoji text,
  note text,
  date date NOT NULL,
  yearly boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.important_dates TO authenticated;
GRANT ALL ON public.important_dates TO service_role;

ALTER TABLE public.important_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own dates readable"
  ON public.important_dates FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR owner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "insert own dates"
  ON public.important_dates FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "update own dates"
  ON public.important_dates FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "delete own dates"
  ON public.important_dates FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER important_dates_touch
  BEFORE UPDATE ON public.important_dates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX important_dates_owner_idx ON public.important_dates(owner_id);