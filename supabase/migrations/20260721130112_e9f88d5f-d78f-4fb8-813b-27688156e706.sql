-- Fix message_reactions SELECT: enforce same visibility as messages
DROP POLICY IF EXISTS "read reactions on visible messages" ON public.message_reactions;
CREATE POLICY "read reactions on visible messages"
ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_reactions.message_id
      AND (
        (m.group_id IS NULL AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid()))
        OR (m.group_id IS NOT NULL AND public.is_group_member(m.group_id, auth.uid()))
      )
  )
);

-- Fix watch_sync_members SELECT: exact UUID match on the pair segment of room_key
DROP POLICY IF EXISTS "watch sync participants read room" ON public.watch_sync_members;
CREATE POLICY "watch sync participants read room"
ON public.watch_sync_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR partner_id = auth.uid()
  OR (
    room_key LIKE 'watchsync:%'
    AND (auth.uid())::text = ANY (
      string_to_array(split_part(room_key, ':', 2), '~')
    )
  )
);