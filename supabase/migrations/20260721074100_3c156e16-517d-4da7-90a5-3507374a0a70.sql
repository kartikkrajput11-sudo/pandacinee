CREATE TABLE public.group_message_reads (
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_message_reads TO authenticated;
GRANT ALL ON public.group_message_reads TO service_role;

ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view read receipts"
  ON public.group_message_reads
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can upsert their own read receipt"
  ON public.group_message_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can update their own read receipt"
  ON public.group_message_reads
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX group_message_reads_group_idx ON public.group_message_reads(group_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_reads;