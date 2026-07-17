DROP POLICY IF EXISTS "watch sync participants read room" ON public.watch_sync_members;

CREATE POLICY "watch sync participants read room"
ON public.watch_sync_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR partner_id = auth.uid()
  OR position(auth.uid()::text in room_key) > 0
);