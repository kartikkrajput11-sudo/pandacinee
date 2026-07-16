
-- 1. Balance column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS panda_coins integer NOT NULL DEFAULT 0
    CHECK (panda_coins >= 0);

-- 2. Shop catalog
CREATE TABLE IF NOT EXISTS public.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('chat_theme','site_theme','chat_perk','profile_flair','ai_sticker_pack')),
  name text NOT NULL,
  description text,
  price integer NOT NULL CHECK (price >= 0),
  preview_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_items readable by authenticated"
  ON public.shop_items FOR SELECT TO authenticated
  USING (active = true OR public.is_admin(auth.uid()));

CREATE POLICY "shop_items writable by admin"
  ON public.shop_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER shop_items_touch
  BEFORE UPDATE ON public.shop_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. User inventory
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_inventory TO authenticated;
GRANT ALL ON public.user_inventory TO service_role;

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory owner can read"
  ON public.user_inventory FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "inventory owner can update equipped"
  ON public.user_inventory FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Insert/delete happens only via SECURITY DEFINER RPCs below; no direct policies needed.

CREATE INDEX IF NOT EXISTS user_inventory_user_idx ON public.user_inventory (user_id);

-- 4. Coin ledger (idempotent)
CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref_id)
);

GRANT SELECT ON public.coin_ledger TO authenticated;
GRANT ALL ON public.coin_ledger TO service_role;

ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger owner can read"
  ON public.coin_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS coin_ledger_user_idx ON public.coin_ledger (user_id, created_at DESC);

-- 5. Award coins (idempotent by ref_id)
CREATE OR REPLACE FUNCTION public.grant_coins(_reason text, _amount integer, _ref_id text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  new_balance integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _reason IS NULL OR length(_reason) = 0 THEN RAISE EXCEPTION 'Reason required'; END IF;

  BEGIN
    INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (me, _amount, _reason, _ref_id);
  EXCEPTION WHEN unique_violation THEN
    -- Already granted this ref, no-op
    SELECT panda_coins INTO new_balance FROM public.profiles WHERE id = me;
    RETURN new_balance;
  END;

  UPDATE public.profiles SET panda_coins = panda_coins + _amount
    WHERE id = me
    RETURNING panda_coins INTO new_balance;

  RETURN new_balance;
END;
$$;

-- 6. Purchase an item (atomic deduction + inventory row)
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  item public.shop_items;
  current_balance integer;
  new_balance integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO item FROM public.shop_items WHERE id = _item_id AND active = true;
  IF item.id IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = me AND item_id = _item_id) THEN
    RAISE EXCEPTION 'You already own this item';
  END IF;

  SELECT panda_coins INTO current_balance FROM public.profiles WHERE id = me FOR UPDATE;
  IF current_balance < item.price THEN
    RAISE EXCEPTION 'Not enough Panda Coins';
  END IF;

  UPDATE public.profiles SET panda_coins = panda_coins - item.price
    WHERE id = me
    RETURNING panda_coins INTO new_balance;

  INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (me, -item.price, 'purchase:' || item.category, item.id::text);

  INSERT INTO public.user_inventory (user_id, item_id) VALUES (me, item.id);

  RETURN jsonb_build_object('balance', new_balance, 'item_id', item.id);
END;
$$;

-- 7. Equip / unequip owned items (one equipped per category)
CREATE OR REPLACE FUNCTION public.toggle_equip_item(_item_id uuid, _equip boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  item_cat text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = me AND item_id = _item_id) THEN
    RAISE EXCEPTION 'You do not own this item';
  END IF;
  SELECT category INTO item_cat FROM public.shop_items WHERE id = _item_id;

  IF _equip THEN
    -- Unequip other items in the same category (except AI packs and perks which can stack)
    IF item_cat IN ('chat_theme','site_theme','profile_flair') THEN
      UPDATE public.user_inventory
        SET equipped = false
        WHERE user_id = me
          AND item_id IN (SELECT id FROM public.shop_items WHERE category = item_cat);
    END IF;
    UPDATE public.user_inventory SET equipped = true WHERE user_id = me AND item_id = _item_id;
  ELSE
    UPDATE public.user_inventory SET equipped = false WHERE user_id = me AND item_id = _item_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_coins(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_equip_item(uuid, boolean) TO authenticated;
