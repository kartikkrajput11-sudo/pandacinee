
-- Fix infinite recursion in profiles SELECT policy and allow viewing friend profiles
DROP POLICY IF EXISTS "Profiles viewable by self or partner" ON public.profiles;

CREATE OR REPLACE FUNCTION public.is_accepted_friend(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND addressee_id = _other)
        OR (addressee_id = auth.uid() AND requester_id = _other))
  );
$$;

CREATE POLICY "Profiles viewable by self, partner, or friend"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR partner_id = auth.uid()
  OR public.is_accepted_friend(id)
);
