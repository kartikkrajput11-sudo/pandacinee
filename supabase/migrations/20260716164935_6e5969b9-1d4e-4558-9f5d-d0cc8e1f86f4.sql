
-- 1. Extend messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_preview jsonb;

-- 2. Group theme
ALTER TABLE public.chat_groups
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'aurora';

-- 3. Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- users can see reactions on messages they can read (any message they can select)
CREATE POLICY "read reactions on visible messages" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id)
  );

CREATE POLICY "insert own reactions" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND (
        m.group_id IS NULL AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
        OR (m.group_id IS NOT NULL AND public.is_group_member(m.group_id, auth.uid()))
      )
    )
  );

CREATE POLICY "delete own reactions" ON public.message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4. Allow group admins & senders to update pin/deleted on messages
-- Add policy for admins to update messages in their group (pin/delete)
DROP POLICY IF EXISTS "group admins can pin or soft-delete group messages" ON public.messages;
CREATE POLICY "group admins can pin or soft-delete group messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    group_id IS NOT NULL AND public.is_group_admin(group_id, auth.uid())
  )
  WITH CHECK (
    group_id IS NOT NULL AND public.is_group_admin(group_id, auth.uid())
  );

-- 5. Allow admins to update group fields (name/avatar/theme) and demote/promote members
DROP POLICY IF EXISTS "group admins can update group" ON public.chat_groups;
CREATE POLICY "group admins can update group" ON public.chat_groups
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(id, auth.uid()))
  WITH CHECK (public.is_group_admin(id, auth.uid()));

DROP POLICY IF EXISTS "group admins can change member roles" ON public.chat_group_members;
CREATE POLICY "group admins can change member roles" ON public.chat_group_members
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));

DROP POLICY IF EXISTS "group admins can remove members" ON public.chat_group_members;
CREATE POLICY "group admins can remove members" ON public.chat_group_members
  FOR DELETE TO authenticated
  USING (
    public.is_group_admin(group_id, auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "group admins can add members" ON public.chat_group_members;
CREATE POLICY "group admins can add members" ON public.chat_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_admin(group_id, auth.uid())
    OR (
      -- group creator seeding themselves during creation
      user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.chat_groups g WHERE g.id = group_id AND g.created_by = auth.uid())
    )
  );

-- 6. Realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- 7. Index for pinned lookups
CREATE INDEX IF NOT EXISTS idx_messages_group_pinned ON public.messages (group_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions (message_id);
