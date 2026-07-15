
-- 1. Wishlist: validate partner_id
DROP POLICY IF EXISTS wishlist_insert ON public.wishlist_items;
CREATE POLICY wishlist_insert ON public.wishlist_items
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    partner_id IS NULL
    OR partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  )
);

DROP POLICY IF EXISTS wishlist_update ON public.wishlist_items;
CREATE POLICY wishlist_update ON public.wishlist_items
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR partner_id = auth.uid())
WITH CHECK (
  owner_id = auth.uid()
  AND (
    partner_id IS NULL
    OR partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- 2. Memory Jar: validate partner_id
DROP POLICY IF EXISTS memory_insert ON public.memory_jar;
CREATE POLICY memory_insert ON public.memory_jar
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    partner_id IS NULL
    OR partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  )
);

DROP POLICY IF EXISTS memory_update ON public.memory_jar;
CREATE POLICY memory_update ON public.memory_jar
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR partner_id = auth.uid())
WITH CHECK (
  author_id = auth.uid()
  AND (
    partner_id IS NULL
    OR partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- 3. Call signals: to_user must be a real participant of the same call
DROP POLICY IF EXISTS "signals insert by participant" ON public.call_signals;
CREATE POLICY "signals insert by participant" ON public.call_signals
FOR INSERT TO authenticated
WITH CHECK (
  from_user = auth.uid()
  AND public.is_call_participant(call_id, auth.uid())
  AND public.is_call_participant(call_id, to_user)
);

-- 4. Game sessions: partner_id must be caller's real partner or an accepted friend
DROP POLICY IF EXISTS "Host creates" ON public.game_sessions;
CREATE POLICY "Host creates" ON public.game_sessions
FOR INSERT TO authenticated
WITH CHECK (
  host_id = auth.uid()
  AND (
    partner_id IS NULL
    OR partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_accepted_friend(partner_id)
  )
);

-- 5. Remove PIN-based admin escalation. Only existing admins can grant admin now.
CREATE OR REPLACE FUNCTION public.claim_admin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- PIN parameter is ignored; kept for backward compatibility with the client signature.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- Only an existing admin can promote themselves (no-op) or bootstrap flow.
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

-- Update revoke_admin: drop PIN check, keep caller-is-admin guard
CREATE OR REPLACE FUNCTION public.revoke_admin(_target uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  -- PIN parameter is ignored; kept for backward compatibility with the client signature.
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_admin INTO caller_is_admin FROM public.profiles WHERE id = caller;
  IF NOT COALESCE(caller_is_admin, false) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target IS NULL THEN RAISE EXCEPTION 'Target required'; END IF;
  UPDATE public.profiles SET is_admin = false WHERE id = _target;
  RETURN true;
END;
$$;

-- 6. Add search_path to email queue helper functions (Supabase linter 0011)
ALTER FUNCTION public.delete_email(text, bigint)  SET search_path = 'public';
ALTER FUNCTION public.enqueue_email(text, jsonb)  SET search_path = 'public';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = 'public';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = 'public';
