
CREATE TABLE public.bucket_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  category TEXT,
  photo_url TEXT,
  target_date DATE,
  priority INT NOT NULL DEFAULT 2,
  completed_at TIMESTAMPTZ,
  completed_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bucket_list_items TO authenticated;
GRANT ALL ON public.bucket_list_items TO service_role;

ALTER TABLE public.bucket_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair can view bucket items"
  ON public.bucket_list_items FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = partner_id);

CREATE POLICY "Owner can insert bucket items"
  ON public.bucket_list_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Pair can update bucket items"
  ON public.bucket_list_items FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = partner_id)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = partner_id);

CREATE POLICY "Owner can delete bucket items"
  ON public.bucket_list_items FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER bucket_list_items_touch
  BEFORE UPDATE ON public.bucket_list_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX bucket_list_items_owner_idx ON public.bucket_list_items(owner_id);
CREATE INDEX bucket_list_items_partner_idx ON public.bucket_list_items(partner_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.bucket_list_items;
