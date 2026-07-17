
-- =========================================================================
-- 1. PROFILES: block privilege-escalation columns from direct client updates
-- =========================================================================
-- Any signed-in user could previously set their own is_admin, coins,
-- panda_coins, partner_id, paired_at, or invite_code via a direct PostgREST
-- update. We install a BEFORE UPDATE trigger that reverts changes to these
-- columns unless the update is running inside a trusted SECURITY DEFINER
-- function that opted in via a session-local flag.

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trusted text;
BEGIN
  trusted := current_setting('app.privileged_profile_update', true);
  IF trusted IS DISTINCT FROM 'on' THEN
    NEW.is_admin    := OLD.is_admin;
    NEW.coins       := OLD.coins;
    NEW.panda_coins := OLD.panda_coins;
    NEW.partner_id  := OLD.partner_id;
    NEW.paired_at   := OLD.paired_at;
    NEW.invite_code := OLD.invite_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_columns();

-- ------------------------------------------------------------------
-- Update every trusted SECURITY DEFINER function that legitimately
-- writes to those columns so it sets the session flag first.
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pair_with_invite_code(_code text)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me UUID := auth.uid();
  partner public.profiles;
  my_profile public.profiles;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO my_profile FROM public.profiles WHERE id = me;
  IF my_profile.partner_id IS NOT NULL THEN RAISE EXCEPTION 'You are already paired'; END IF;
  SELECT * INTO partner FROM public.profiles WHERE invite_code = upper(trim(_code));
  IF partner IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  IF partner.id = me THEN RAISE EXCEPTION 'You cannot pair with yourself'; END IF;
  IF partner.partner_id IS NOT NULL THEN RAISE EXCEPTION 'That panda already has a partner'; END IF;
  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles SET partner_id = partner.id, paired_at = now() WHERE id = me;
  UPDATE public.profiles SET partner_id = me, paired_at = now() WHERE id = partner.id;
  SELECT * INTO partner FROM public.profiles WHERE id = partner.id;
  RETURN partner;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpair_partner()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me_id UUID := auth.uid();
DECLARE p_id UUID;
BEGIN
  IF me_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT partner_id INTO p_id FROM public.profiles WHERE id = me_id;
  IF p_id IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles SET partner_id = NULL, paired_at = NULL WHERE id IN (me_id, p_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_coins(_reason text, _amount integer, _ref_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT panda_coins INTO new_balance FROM public.profiles WHERE id = me;
    RETURN new_balance;
  END;
  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles SET panda_coins = panda_coins + _amount
    WHERE id = me
    RETURNING panda_coins INTO new_balance;
  RETURN new_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles SET panda_coins = panda_coins - item.price
    WHERE id = me
    RETURNING panda_coins INTO new_balance;
  INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (me, -item.price, 'purchase:' || item.category, item.id::text);
  INSERT INTO public.user_inventory (user_id, item_id) VALUES (me, item.id);
  RETURN jsonb_build_object('balance', new_balance, 'item_id', item.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.credit_coin_purchase(_payment_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  PERFORM set_config('app.privileged_profile_update', 'on', true);
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
$function$;

CREATE OR REPLACE FUNCTION public.revoke_admin(_target uuid, _pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_admin INTO caller_is_admin FROM public.profiles WHERE id = caller;
  IF NOT COALESCE(caller_is_admin, false) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target IS NULL THEN RAISE EXCEPTION 'Target required'; END IF;
  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles SET is_admin = false WHERE id = _target;
  RETURN true;
END;
$function$;


-- =========================================================================
-- 2. profile_achievements: restrict SELECT to self / partner / accepted friend
-- =========================================================================
DROP POLICY IF EXISTS "Anyone signed in can view achievements" ON public.profile_achievements;
CREATE POLICY "Achievements viewable by self, partner, or friend"
  ON public.profile_achievements FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_accepted_friend(user_id)
  );


-- =========================================================================
-- 3. scribble_stats: restrict SELECT to self / partner / accepted friend
-- =========================================================================
DROP POLICY IF EXISTS "Signed-in users can read scribble stats" ON public.scribble_stats;
CREATE POLICY "Scribble stats viewable by self, partner, or friend"
  ON public.scribble_stats FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_accepted_friend(user_id)
  );


-- =========================================================================
-- 4. Enforce user_blocks: blocked senders cannot insert new content targeted
--    at the blocker (messages, love_letters, movie_chat_messages).
-- =========================================================================

-- Direct messages: keep existing rule + block check.
DROP POLICY IF EXISTS "Send to partner or friend" ON public.messages;
CREATE POLICY "Send to partner or friend"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      receiver_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
      OR public.is_accepted_friend(receiver_id)
    )
    AND (
      receiver_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE b.blocker_id = messages.receiver_id
          AND b.blocked_id = auth.uid()
      )
    )
  );

-- Love letters
DROP POLICY IF EXISTS "letters_insert_sender_to_partner_or_friend" ON public.love_letters;
CREATE POLICY "letters_insert_sender_to_partner_or_friend"
  ON public.love_letters FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND recipient_id <> auth.uid()
    AND (
      recipient_id = (SELECT partner_id FROM public.profiles WHERE id = auth.uid())
      OR public.is_accepted_friend(recipient_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE b.blocker_id = love_letters.recipient_id
        AND b.blocked_id = auth.uid()
    )
  );

-- Movie chat: only sender_id was checked. Block sending if the receiver
-- has blocked the sender.
DROP POLICY IF EXISTS "Users can send their own movie chat messages" ON public.movie_chat_messages;
CREATE POLICY "Users can send their own movie chat messages"
  ON public.movie_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      receiver_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE b.blocker_id = movie_chat_messages.receiver_id
          AND b.blocked_id = auth.uid()
      )
    )
  );
