
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, option_id)
);

CREATE INDEX poll_votes_message_idx ON public.poll_votes(message_id);
CREATE INDEX poll_votes_user_idx ON public.poll_votes(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Read: any group member of the poll's group can see votes
CREATE POLICY "Group members read poll votes"
ON public.poll_votes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = poll_votes.message_id
      AND m.group_id IS NOT NULL
      AND public.is_group_member(m.group_id, auth.uid())
  )
);

-- Insert own vote, only in a poll from a group you belong to
CREATE POLICY "Members cast own vote"
ON public.poll_votes FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = poll_votes.message_id
      AND m.type = 'poll'
      AND m.group_id IS NOT NULL
      AND public.is_group_member(m.group_id, auth.uid())
  )
);

-- Update own vote
CREATE POLICY "Update own vote"
ON public.poll_votes FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Delete own vote
CREATE POLICY "Delete own vote"
ON public.poll_votes FOR DELETE
TO authenticated
USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
