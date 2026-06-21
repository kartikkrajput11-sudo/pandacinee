
CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  note TEXT,
  url TEXT,
  image_url TEXT,
  priority INT NOT NULL DEFAULT 0,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  got_it BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_select" ON public.wishlist_items FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "wishlist_insert" ON public.wishlist_items FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "wishlist_update" ON public.wishlist_items FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR partner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "wishlist_delete" ON public.wishlist_items FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
CREATE TRIGGER wishlist_touch BEFORE UPDATE ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.memory_jar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  photo_url TEXT,
  mood TEXT,
  happened_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_jar TO authenticated;
GRANT ALL ON public.memory_jar TO service_role;
ALTER TABLE public.memory_jar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory_select" ON public.memory_jar FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "memory_insert" ON public.memory_jar FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "memory_update" ON public.memory_jar FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR partner_id = auth.uid())
  WITH CHECK (author_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "memory_delete" ON public.memory_jar FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE TRIGGER memory_touch BEFORE UPDATE ON public.memory_jar
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.mood_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT current_date,
  emoji TEXT,
  label TEXT,
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mood_log TO authenticated;
GRANT ALL ON public.mood_log TO service_role;
ALTER TABLE public.mood_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mood_select" ON public.mood_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IN (SELECT partner_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "mood_insert" ON public.mood_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "mood_update" ON public.mood_log FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "mood_delete" ON public.mood_log FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.mood_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_jar;
