DROP POLICY IF EXISTS "Addressee updates" ON public.friendships;

CREATE POLICY "Only addressee accepts requests"
ON public.friendships
FOR UPDATE
TO authenticated
USING (addressee_id = auth.uid())
WITH CHECK (addressee_id = auth.uid());