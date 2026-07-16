
CREATE TABLE public.ai_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mood)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_stickers TO authenticated;
GRANT ALL ON public.ai_stickers TO service_role;

ALTER TABLE public.ai_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own, partner or friend"
  ON public.ai_stickers FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.partner_id = ai_stickers.user_id)
    OR public.is_accepted_friend(user_id)
  );

CREATE POLICY "insert own"
  ON public.ai_stickers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "update own"
  ON public.ai_stickers FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete own"
  ON public.ai_stickers FOR DELETE TO authenticated
  USING (user_id = auth.uid());
