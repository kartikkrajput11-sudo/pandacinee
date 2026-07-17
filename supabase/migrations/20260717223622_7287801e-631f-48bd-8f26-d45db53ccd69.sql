
ALTER TABLE public.chat_groups ADD COLUMN IF NOT EXISTS background_url TEXT;

CREATE POLICY "Group members can view group backgrounds"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'group-backgrounds');

CREATE POLICY "Group admins can upload group backgrounds"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'group-backgrounds'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE m.group_id::text = (storage.foldername(name))[1]
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
  )
);

CREATE POLICY "Group admins can update group backgrounds"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'group-backgrounds'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE m.group_id::text = (storage.foldername(name))[1]
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
  )
);

CREATE POLICY "Group admins can delete group backgrounds"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'group-backgrounds'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE m.group_id::text = (storage.foldername(name))[1]
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
  )
);
