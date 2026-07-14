
-- 1. chat_groups
CREATE TABLE public.chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_groups TO authenticated;
GRANT ALL ON public.chat_groups TO service_role;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER chat_groups_touch
BEFORE UPDATE ON public.chat_groups
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. chat_group_members
CREATE TABLE public.chat_group_members (
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_group_members TO authenticated;
GRANT ALL ON public.chat_group_members TO service_role;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX chat_group_members_user_idx ON public.chat_group_members(user_id);

-- 3. Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_gid uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = _gid AND user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_gid uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = _gid AND user_id = _uid AND role = 'admin'
  );
$$;

-- 4. Policies: chat_groups
CREATE POLICY "Members view group"
  ON public.chat_groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));

CREATE POLICY "Any authed can create group"
  ON public.chat_groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins update group"
  ON public.chat_groups FOR UPDATE TO authenticated
  USING (public.is_group_admin(id, auth.uid()))
  WITH CHECK (public.is_group_admin(id, auth.uid()));

CREATE POLICY "Admins delete group"
  ON public.chat_groups FOR DELETE TO authenticated
  USING (public.is_group_admin(id, auth.uid()));

-- 5. Policies: chat_group_members
CREATE POLICY "Members view membership"
  ON public.chat_group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

-- Insert: creator can seed themselves (as admin) OR existing admin adds someone
CREATE POLICY "Insert members"
  ON public.chat_group_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.chat_groups g
      WHERE g.id = group_id AND g.created_by = auth.uid()
    ))
    OR public.is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "Leave or admin remove"
  ON public.chat_group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

-- 6. Extend messages
ALTER TABLE public.messages ADD COLUMN group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE;
ALTER TABLE public.messages ALTER COLUMN receiver_id DROP NOT NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_target_check
  CHECK ((receiver_id IS NOT NULL AND group_id IS NULL) OR (receiver_id IS NULL AND group_id IS NOT NULL));
CREATE INDEX messages_group_idx ON public.messages(group_id, created_at DESC);

-- Group message policies (add to existing DM policies)
CREATE POLICY "Group members read group messages"
  ON public.messages FOR SELECT TO authenticated
  USING (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group members send group messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    group_id IS NOT NULL
    AND sender_id = auth.uid()
    AND public.is_group_member(group_id, auth.uid())
  );

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_members;
