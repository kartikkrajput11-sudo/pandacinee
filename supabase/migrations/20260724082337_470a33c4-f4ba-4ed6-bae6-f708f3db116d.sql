
-- Restrict daily_questions read to signed-in users
DROP POLICY IF EXISTS "questions public read" ON public.daily_questions;
CREATE POLICY "Authenticated users can read daily questions"
  ON public.daily_questions FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.daily_questions FROM anon;

-- Restrict site_flags read to signed-in users
DROP POLICY IF EXISTS "Anyone can read site flags" ON public.site_flags;
CREATE POLICY "Authenticated users can read site flags"
  ON public.site_flags FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.site_flags FROM anon;

-- Remove fragile string-parsing clause from watch_sync_members SELECT policy
DROP POLICY IF EXISTS "watch sync participants read room" ON public.watch_sync_members;
CREATE POLICY "watch sync participants read own row"
  ON public.watch_sync_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR partner_id = auth.uid());
