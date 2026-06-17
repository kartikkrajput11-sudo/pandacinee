
-- Lock search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- handle_new_user is only invoked by the trigger; revoke EXECUTE from everyone
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- pair_with_invite_code: only authenticated users
REVOKE EXECUTE ON FUNCTION public.pair_with_invite_code(TEXT) FROM PUBLIC, anon;
