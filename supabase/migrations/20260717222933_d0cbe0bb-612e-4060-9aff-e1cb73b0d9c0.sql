
-- Generator for short readable codes (unambiguous alphabet)
CREATE OR REPLACE FUNCTION public.gen_group_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.chat_groups WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

ALTER TABLE public.chat_groups
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- Backfill existing rows
UPDATE public.chat_groups
SET invite_code = public.gen_group_invite_code()
WHERE invite_code IS NULL;

ALTER TABLE public.chat_groups
  ALTER COLUMN invite_code SET NOT NULL,
  ALTER COLUMN invite_code SET DEFAULT public.gen_group_invite_code();

-- Join by code
CREATE OR REPLACE FUNCTION public.join_group_with_code(_code text)
RETURNS public.chat_groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  g public.chat_groups;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN RAISE EXCEPTION 'Code required'; END IF;
  SELECT * INTO g FROM public.chat_groups
    WHERE invite_code = upper(regexp_replace(_code, '\s', '', 'g'));
  IF g.id IS NULL THEN RAISE EXCEPTION 'Invalid group code'; END IF;
  IF EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = g.id AND user_id = me) THEN
    RETURN g;
  END IF;
  INSERT INTO public.chat_group_members (group_id, user_id, role)
    VALUES (g.id, me, 'member');
  RETURN g;
END;
$$;

-- Admin-only regenerate
CREATE OR REPLACE FUNCTION public.regenerate_group_invite_code(_gid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  new_code text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_group_admin(_gid, me) THEN RAISE EXCEPTION 'Only admins can regenerate the code'; END IF;
  new_code := public.gen_group_invite_code();
  UPDATE public.chat_groups SET invite_code = new_code WHERE id = _gid;
  RETURN new_code;
END;
$$;
