
-- ============ coin_bundles ============
CREATE TABLE public.coin_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  coins integer NOT NULL CHECK (coins > 0),
  price_paise integer NOT NULL CHECK (price_paise > 0),
  currency text NOT NULL DEFAULT 'INR',
  bonus_label text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coin_bundles TO authenticated;
GRANT ALL ON public.coin_bundles TO service_role;

ALTER TABLE public.coin_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read active bundles"
  ON public.coin_bundles FOR SELECT
  TO authenticated
  USING (active = true);

-- ============ coin_purchases ============
CREATE TABLE public.coin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle_id uuid NOT NULL REFERENCES public.coin_bundles(id),
  coins integer NOT NULL,
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text UNIQUE,
  razorpay_signature text,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','credited')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  credited_at timestamptz
);

CREATE INDEX coin_purchases_user_idx ON public.coin_purchases(user_id, created_at DESC);

GRANT SELECT ON public.coin_purchases TO authenticated;
GRANT ALL ON public.coin_purchases TO service_role;

ALTER TABLE public.coin_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own purchases"
  ON public.coin_purchases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============ credit function (idempotent) ============
CREATE OR REPLACE FUNCTION public.credit_coin_purchase(_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.coin_purchases;
  new_balance integer;
BEGIN
  SELECT * INTO p FROM public.coin_purchases WHERE razorpay_payment_id = _payment_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF p.status = 'credited' THEN
    SELECT panda_coins INTO new_balance FROM public.profiles WHERE id = p.user_id;
    RETURN jsonb_build_object('balance', new_balance, 'already', true);
  END IF;
  IF p.status <> 'paid' THEN RAISE EXCEPTION 'Purchase not paid'; END IF;

  UPDATE public.profiles SET panda_coins = panda_coins + p.coins
    WHERE id = p.user_id
    RETURNING panda_coins INTO new_balance;

  INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (p.user_id, p.coins, 'purchase_bundle', p.razorpay_payment_id)
    ON CONFLICT DO NOTHING;

  UPDATE public.coin_purchases
    SET status = 'credited', credited_at = now()
    WHERE id = p.id;

  RETURN jsonb_build_object('balance', new_balance, 'already', false, 'coins', p.coins);
END;
$$;

-- ============ seed bundles ============
INSERT INTO public.coin_bundles (bundle_key, name, description, coins, price_paise, bonus_label, sort_order) VALUES
  ('starter_100', 'Bamboo Snack', 'A little treat', 100, 4900, NULL, 10),
  ('popular_500', 'Panda Pouch', 'Most loved', 550, 19900, '+10%', 20),
  ('big_1200', 'Cloud Chest', 'Great value', 1350, 39900, '+12%', 30),
  ('mega_3000', 'Bamboo Vault', 'Best value', 3500, 89900, '+17%', 40);
