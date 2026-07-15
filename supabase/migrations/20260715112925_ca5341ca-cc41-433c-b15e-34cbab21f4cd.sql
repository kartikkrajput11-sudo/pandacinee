-- ═══════════════════════════════════════════════════════════
-- LOVE LETTERS VAULT
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.love_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  voice_url text,
  theme text NOT NULL DEFAULT 'gold' CHECK (theme IN ('gold','rose','ivory','emerald')),
  unlock_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT love_letters_no_self CHECK (sender_id <> recipient_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.love_letters TO authenticated;
GRANT ALL ON public.love_letters TO service_role;

ALTER TABLE public.love_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "letters_select_participants" ON public.love_letters FOR SELECT
  TO authenticated
  USING (auth.uid() IN (sender_id, recipient_id));

CREATE POLICY "letters_insert_sender_to_partner_or_friend" ON public.love_letters FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND recipient_id <> auth.uid()
    AND (
      recipient_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
      OR public.is_accepted_friend(recipient_id)
    )
  );

-- Sender may edit/delete only while unopened.
CREATE POLICY "letters_update_sender_unopened" ON public.love_letters FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid() AND opened_at IS NULL)
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "letters_delete_sender_unopened" ON public.love_letters FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() AND opened_at IS NULL);

CREATE TRIGGER letters_touch_updated_at BEFORE UPDATE ON public.love_letters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX love_letters_recipient_idx ON public.love_letters (recipient_id, unlock_at);
CREATE INDEX love_letters_sender_idx ON public.love_letters (sender_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.love_letters;

-- Recipient opens a letter via this function so RLS doesn't have to
-- permit an arbitrary recipient-side UPDATE on other columns.
CREATE OR REPLACE FUNCTION public.open_love_letter(_id uuid)
RETURNS public.love_letters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE me uuid := auth.uid(); l public.love_letters;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO l FROM public.love_letters WHERE id = _id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Letter not found'; END IF;
  IF l.recipient_id <> me THEN RAISE EXCEPTION 'Only the recipient can open this letter'; END IF;
  IF now() < l.unlock_at THEN RAISE EXCEPTION 'This letter is still sealed'; END IF;
  UPDATE public.love_letters
    SET opened_at = COALESCE(opened_at, now())
    WHERE id = _id
    RETURNING * INTO l;
  RETURN l;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.open_love_letter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_love_letter(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RITUALS (gratitude / breathing / candle)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.rituals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('gratitude','breathing','candle')),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rituals_no_self CHECK (host_id <> partner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rituals TO authenticated;
GRANT ALL ON public.rituals TO service_role;

ALTER TABLE public.rituals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rituals_select_participants" ON public.rituals FOR SELECT
  TO authenticated
  USING (auth.uid() IN (host_id, partner_id));

CREATE POLICY "rituals_insert_host_with_partner_or_friend" ON public.rituals FOR INSERT
  TO authenticated
  WITH CHECK (
    host_id = auth.uid()
    AND partner_id <> auth.uid()
    AND (
      partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
      OR public.is_accepted_friend(partner_id)
    )
  );

CREATE POLICY "rituals_update_participants" ON public.rituals FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (host_id, partner_id))
  WITH CHECK (auth.uid() IN (host_id, partner_id));

CREATE POLICY "rituals_delete_host" ON public.rituals FOR DELETE
  TO authenticated
  USING (host_id = auth.uid());

CREATE TRIGGER rituals_touch_updated_at BEFORE UPDATE ON public.rituals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX rituals_participants_idx
  ON public.rituals (host_id, partner_id, updated_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rituals;

-- ═══════════════════════════════════════════════════════════
-- CONSTELLATION NOTES (extra pins on top of derived events)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.constellation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text NOT NULL DEFAULT '',
  glyph text NOT NULL DEFAULT '✦',
  occurred_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT constellation_no_self CHECK (author_id <> partner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.constellation_notes TO authenticated;
GRANT ALL ON public.constellation_notes TO service_role;

ALTER TABLE public.constellation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "constellation_select_participants" ON public.constellation_notes FOR SELECT
  TO authenticated
  USING (auth.uid() IN (author_id, partner_id));

CREATE POLICY "constellation_insert_author_partner" ON public.constellation_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND partner_id <> auth.uid()
    AND partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "constellation_update_author" ON public.constellation_notes FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "constellation_delete_author" ON public.constellation_notes FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

CREATE TRIGGER constellation_touch_updated_at BEFORE UPDATE ON public.constellation_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX constellation_participants_idx
  ON public.constellation_notes (author_id, partner_id, occurred_at DESC);

-- ═══════════════════════════════════════════════════════════
-- CONCIERGE SUGGESTIONS (AI-generated ideas for the pair)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.concierge_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('date','gift','trip','note','ritual')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT concierge_no_self CHECK (author_id <> partner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concierge_suggestions TO authenticated;
GRANT ALL ON public.concierge_suggestions TO service_role;

ALTER TABLE public.concierge_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "concierge_select_participants" ON public.concierge_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() IN (author_id, partner_id));

CREATE POLICY "concierge_insert_author_partner" ON public.concierge_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND partner_id <> auth.uid()
    AND partner_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
  );

-- Either partner can toggle saved / dismissed.
CREATE POLICY "concierge_update_participants" ON public.concierge_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (author_id, partner_id))
  WITH CHECK (auth.uid() IN (author_id, partner_id));

CREATE POLICY "concierge_delete_author" ON public.concierge_suggestions FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

CREATE TRIGGER concierge_touch_updated_at BEFORE UPDATE ON public.concierge_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX concierge_pair_idx
  ON public.concierge_suggestions (author_id, partner_id, created_at DESC);
