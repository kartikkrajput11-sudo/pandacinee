
DROP POLICY IF EXISTS "Send to partner only" ON public.messages;
CREATE POLICY "Send to partner or friend" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      receiver_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
      OR public.is_accepted_friend(receiver_id)
    )
  );
