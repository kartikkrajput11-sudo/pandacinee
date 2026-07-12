CREATE POLICY "Authenticated can read custom-movies"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'custom-movies');

CREATE POLICY "Admins can upload custom-movies"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'custom-movies' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update custom-movies"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'custom-movies' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete custom-movies"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'custom-movies' AND public.is_admin(auth.uid()));