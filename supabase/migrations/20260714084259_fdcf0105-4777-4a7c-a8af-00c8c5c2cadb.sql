CREATE OR REPLACE FUNCTION public.friend_profiles_for_me(_ids uuid[])
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(_ids)
    AND (
      p.id = auth.uid()
      OR p.partner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.friendships f
        WHERE (f.requester_id = auth.uid() AND f.addressee_id = p.id)
           OR (f.addressee_id = auth.uid() AND f.requester_id = p.id)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.friend_profiles_for_me(uuid[]) TO authenticated;