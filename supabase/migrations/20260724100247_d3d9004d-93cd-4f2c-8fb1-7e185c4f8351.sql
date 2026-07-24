
CREATE TABLE public.love_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  emoji text DEFAULT '💝',
  redeemed_at timestamptz,
  redeemed_note text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.love_coupons TO authenticated;
GRANT ALL ON public.love_coupons TO service_role;

ALTER TABLE public.love_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See coupons I sent or received"
  ON public.love_coupons FOR SELECT TO authenticated
  USING (auth.uid() = giver_id OR auth.uid() = recipient_id);

CREATE POLICY "Send coupons to partner or friends"
  ON public.love_coupons FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = giver_id
    AND (
      recipient_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
      OR public.is_accepted_friend(recipient_id)
    )
  );

CREATE POLICY "Recipient can redeem, giver can revoke"
  ON public.love_coupons FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = giver_id)
  WITH CHECK (auth.uid() = recipient_id OR auth.uid() = giver_id);

CREATE POLICY "Giver can delete unredeemed coupons"
  ON public.love_coupons FOR DELETE TO authenticated
  USING (auth.uid() = giver_id AND redeemed_at IS NULL);

CREATE INDEX idx_love_coupons_recipient ON public.love_coupons(recipient_id, redeemed_at);
CREATE INDEX idx_love_coupons_giver ON public.love_coupons(giver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.love_coupons;
