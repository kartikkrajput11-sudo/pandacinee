
CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(_username)
      AND id <> auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.suggest_usernames(_base text, _count int DEFAULT 5)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  suggestions text[] := ARRAY[]::text[];
  suffixes text[];
  s text;
  i int;
BEGIN
  base := lower(regexp_replace(coalesce(_base, ''), '[^a-z0-9_.]', '', 'gi'));
  IF length(base) < 2 THEN base := 'panda'; END IF;
  IF length(base) > 20 THEN base := substr(base, 1, 20); END IF;

  suffixes := ARRAY[
    base || '_',
    base || '.',
    base || '_' || floor(random()*90+10)::text,
    base || floor(random()*900+100)::text,
    base || '_' || floor(random()*9000+1000)::text,
    'the.' || base,
    'real_' || base,
    base || 'x',
    base || '__',
    base || floor(random()*90+10)::text
  ];

  FOREACH s IN ARRAY suffixes LOOP
    IF array_length(suggestions,1) >= _count THEN EXIT; END IF;
    candidate := substr(s, 1, 30);
    IF public.is_username_available(candidate) AND NOT (candidate = ANY(suggestions)) THEN
      suggestions := suggestions || candidate;
    END IF;
  END LOOP;

  -- Fallback: append random digits until we have enough
  i := 0;
  WHILE array_length(suggestions,1) IS DISTINCT FROM NULL AND array_length(suggestions,1) < _count AND i < 20 LOOP
    candidate := substr(base, 1, 22) || floor(random()*9000+1000)::text;
    IF public.is_username_available(candidate) AND NOT (candidate = ANY(suggestions)) THEN
      suggestions := suggestions || candidate;
    END IF;
    i := i + 1;
  END LOOP;

  RETURN suggestions;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_usernames(text, int) TO authenticated;
