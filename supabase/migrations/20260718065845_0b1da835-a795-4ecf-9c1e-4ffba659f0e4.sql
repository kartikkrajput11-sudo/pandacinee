
-- 1) Group backgrounds: restrict SELECT to authenticated group members
DROP POLICY IF EXISTS "Group members can view group backgrounds" ON storage.objects;
CREATE POLICY "Group members can view group backgrounds"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'group-backgrounds'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members m
    WHERE (m.group_id)::text = (storage.foldername(objects.name))[1]
      AND m.user_id = auth.uid()
  )
);

-- 2) Paint gallery / strokes: structured pair check
CREATE OR REPLACE FUNCTION public.is_paint_pair_member(_pair_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH parts AS (
    SELECT
      NULLIF(split_part(_pair_key, ':', 1), '') AS a,
      NULLIF(split_part(_pair_key, ':', 2), '') AS b
  )
  SELECT
    auth.uid() IS NOT NULL
    AND _pair_key IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM parts p
      WHERE auth.uid()::text IN (p.a, p.b)
        AND (
          -- solo pair_key (just my uuid)
          (p.b IS NULL AND p.a = auth.uid()::text)
          -- paired with partner
          OR (
            p.a IS NOT NULL AND p.b IS NOT NULL
            AND (
              (p.a = auth.uid()::text AND p.b::uuid = (SELECT partner_id FROM public.profiles WHERE id = auth.uid()))
              OR (p.b = auth.uid()::text AND p.a::uuid = (SELECT partner_id FROM public.profiles WHERE id = auth.uid()))
              OR (p.a = auth.uid()::text AND public.is_accepted_friend(p.b::uuid))
              OR (p.b = auth.uid()::text AND public.is_accepted_friend(p.a::uuid))
            )
          )
        )
    );
$$;

-- paint_strokes
DROP POLICY IF EXISTS "Members of pair can read strokes" ON public.paint_strokes;
DROP POLICY IF EXISTS "User can insert own strokes for their pair" ON public.paint_strokes;

CREATE POLICY "Members of pair can read strokes"
ON public.paint_strokes FOR SELECT TO authenticated
USING (public.is_paint_pair_member(pair_key));

CREATE POLICY "User can insert own strokes for their pair"
ON public.paint_strokes FOR INSERT TO authenticated
WITH CHECK (by_user = auth.uid() AND public.is_paint_pair_member(pair_key));

-- paint_gallery
DROP POLICY IF EXISTS "Pair members can read gallery" ON public.paint_gallery;
DROP POLICY IF EXISTS "Pair members can insert into gallery" ON public.paint_gallery;
DROP POLICY IF EXISTS "Pair members can delete from gallery" ON public.paint_gallery;

CREATE POLICY "Pair members can read gallery"
ON public.paint_gallery FOR SELECT TO authenticated
USING (public.is_paint_pair_member(pair_key));

CREATE POLICY "Pair members can insert into gallery"
ON public.paint_gallery FOR INSERT TO authenticated
WITH CHECK (by_user = auth.uid() AND public.is_paint_pair_member(pair_key));

CREATE POLICY "Pair members can delete from gallery"
ON public.paint_gallery FOR DELETE TO authenticated
USING (public.is_paint_pair_member(pair_key));
