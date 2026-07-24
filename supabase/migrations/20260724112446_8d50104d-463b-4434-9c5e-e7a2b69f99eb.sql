
CREATE TABLE public.sticker_admin (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hide','custom')),
  sticker_id text not null,
  label text,
  category text,
  image_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, sticker_id)
);

GRANT SELECT ON public.sticker_admin TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.sticker_admin TO authenticated;
GRANT ALL ON public.sticker_admin TO service_role;

ALTER TABLE public.sticker_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sticker overrides"
  ON public.sticker_admin FOR SELECT USING (true);

CREATE POLICY "Admins can insert sticker overrides"
  ON public.sticker_admin FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update sticker overrides"
  ON public.sticker_admin FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete sticker overrides"
  ON public.sticker_admin FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Signed-in users read sticker files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stickers');

CREATE POLICY "Admins upload sticker files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stickers' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete sticker files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stickers' AND public.is_admin(auth.uid()));
