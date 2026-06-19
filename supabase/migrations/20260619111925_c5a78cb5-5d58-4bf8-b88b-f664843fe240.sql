
-- chat-media bucket: file path layout is `{auth.uid()}/...`
DROP POLICY IF EXISTS "chat-media upload own" ON storage.objects;
CREATE POLICY "chat-media upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "chat-media read own or partner" ON storage.objects;
CREATE POLICY "chat-media read own or partner" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.partner_id::text = (storage.foldername(name))[1]
      )
      OR public.is_accepted_friend(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "chat-media delete own" ON storage.objects;
CREATE POLICY "chat-media delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
