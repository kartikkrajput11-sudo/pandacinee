
CREATE OR REPLACE FUNCTION public.revoke_admin(_target uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_admin INTO caller_is_admin FROM public.profiles WHERE id = caller;
  IF NOT COALESCE(caller_is_admin, false) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _pin <> '2007' THEN RETURN false; END IF;
  IF _target IS NULL THEN RAISE EXCEPTION 'Target required'; END IF;
  UPDATE public.profiles SET is_admin = false WHERE id = _target;
  RETURN true;
END;
$$;
