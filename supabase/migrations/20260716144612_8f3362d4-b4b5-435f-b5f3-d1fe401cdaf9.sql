
CREATE TABLE public.watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  media_type text NOT NULL DEFAULT 'custom' CHECK (media_type IN ('movie','tv','custom')),
  tmdb_id integer,
  poster_url text,
  overview text,
  note text,
  watched boolean NOT NULL DEFAULT false,
  watched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_items TO authenticated;
GRANT ALL ON public.watchlist_items TO service_role;

ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

-- Either partner in the pair can read
CREATE POLICY "watchlist read by pair" ON public.watchlist_items
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = partner_id);

-- Either partner can insert; they must be the one adding
CREATE POLICY "watchlist insert by pair" ON public.watchlist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = added_by
    AND (auth.uid() = owner_id OR auth.uid() = partner_id)
  );

-- Either partner can update (toggle watched, edit note, etc.)
CREATE POLICY "watchlist update by pair" ON public.watchlist_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = partner_id)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = partner_id);

-- Either partner can delete
CREATE POLICY "watchlist delete by pair" ON public.watchlist_items
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = partner_id);

CREATE INDEX watchlist_items_owner_idx ON public.watchlist_items(owner_id, created_at DESC);
CREATE INDEX watchlist_items_partner_idx ON public.watchlist_items(partner_id, created_at DESC);

CREATE TRIGGER watchlist_items_touch
  BEFORE UPDATE ON public.watchlist_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.watchlist_items;
