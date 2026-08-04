CREATE OR REPLACE FUNCTION public.admin_grant_coins(_target uuid, _amount integer, _note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  new_balance integer;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = caller), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target IS NULL THEN RAISE EXCEPTION 'Target required'; END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'Amount must be a non-zero integer'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles
    SET panda_coins = GREATEST(0, panda_coins + _amount),
        coins = GREATEST(0, coins + _amount)
    WHERE id = _target
    RETURNING panda_coins INTO new_balance;

  INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (_target, _amount, COALESCE(NULLIF(_note, ''), 'admin_grant'),
            'admin:' || caller::text || ':' || extract(epoch from now())::bigint::text);

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_coins(uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_grant_coins(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_coins(uuid, integer, text) TO service_role;