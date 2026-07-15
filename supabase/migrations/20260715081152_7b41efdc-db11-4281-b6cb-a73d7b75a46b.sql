CREATE INDEX IF NOT EXISTS messages_direct_sender_receiver_created_idx
ON public.messages (sender_id, receiver_id, created_at DESC)
WHERE group_id IS NULL;

CREATE INDEX IF NOT EXISTS messages_direct_receiver_sender_created_idx
ON public.messages (receiver_id, sender_id, created_at DESC)
WHERE group_id IS NULL;

CREATE INDEX IF NOT EXISTS messages_group_created_idx
ON public.messages (group_id, created_at DESC)
WHERE group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.chat_messages_between(_peer uuid, _before timestamptz DEFAULT NULL, _limit integer DEFAULT 500)
RETURNS SETOF public.messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
  FROM public.messages m
  WHERE auth.uid() IS NOT NULL
    AND _peer IS NOT NULL
    AND _peer <> auth.uid()
    AND (
      _peer = (SELECT p.partner_id FROM public.profiles p WHERE p.id = auth.uid())
      OR public.is_accepted_friend(_peer)
    )
    AND m.group_id IS NULL
    AND (
      (m.sender_id = auth.uid() AND m.receiver_id = _peer)
      OR (m.sender_id = _peer AND m.receiver_id = auth.uid())
    )
    AND (_before IS NULL OR m.created_at < _before)
    AND (m.expires_at IS NULL OR m.expires_at > now())
  ORDER BY m.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 500), 1), 500);
$$;

CREATE OR REPLACE FUNCTION public.chat_group_messages(_group_id uuid, _before timestamptz DEFAULT NULL, _limit integer DEFAULT 500)
RETURNS SETOF public.messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
  FROM public.messages m
  WHERE auth.uid() IS NOT NULL
    AND _group_id IS NOT NULL
    AND public.is_group_member(_group_id, auth.uid())
    AND m.group_id = _group_id
    AND (_before IS NULL OR m.created_at < _before)
    AND (m.expires_at IS NULL OR m.expires_at > now())
  ORDER BY m.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 500), 1), 500);
$$;

GRANT EXECUTE ON FUNCTION public.chat_messages_between(uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_group_messages(uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_messages_between(uuid, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_group_messages(uuid, timestamptz, integer) TO service_role;