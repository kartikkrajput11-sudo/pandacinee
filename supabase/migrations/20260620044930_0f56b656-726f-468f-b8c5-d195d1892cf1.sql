
CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins view self or partner" ON public.daily_checkins
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "checkins insert own" ON public.daily_checkins
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "checkins delete own" ON public.daily_checkins
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.daily_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_index int NOT NULL UNIQUE,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_questions TO authenticated, anon;
GRANT ALL ON public.daily_questions TO service_role;
ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions public read" ON public.daily_questions
  FOR SELECT USING (true);

CREATE TABLE public.daily_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  question_id uuid NOT NULL REFERENCES public.daily_questions(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_answers TO authenticated;
GRANT ALL ON public.daily_answers TO service_role;
ALTER TABLE public.daily_answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_answered_on(_user uuid, _date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.daily_answers WHERE user_id = _user AND date = _date);
$$;

CREATE POLICY "answers view own" ON public.daily_answers
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "answers view partner after mine" ON public.daily_answers
  FOR SELECT TO authenticated USING (
    partner_id = auth.uid() AND public.has_answered_on(auth.uid(), date)
  );
CREATE POLICY "answers insert own" ON public.daily_answers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "answers delete own" ON public.daily_answers
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.couple_streak(_me uuid, _partner uuid)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d date := current_date - 1;
  s int := 0;
  bothin boolean;
BEGIN
  IF _partner IS NULL THEN RETURN 0; END IF;
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id = _me AND date = d)
       AND EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id = _partner AND date = d)
      INTO bothin;
    IF bothin THEN
      s := s + 1;
      d := d - 1;
    ELSE
      EXIT;
    END IF;
    IF s > 3650 THEN EXIT; END IF;
  END LOOP;
  SELECT EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id = _me AND date = current_date)
     AND EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id = _partner AND date = current_date)
    INTO bothin;
  IF bothin THEN s := s + 1; END IF;
  RETURN s;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_answers;

INSERT INTO public.daily_questions (day_index, prompt) VALUES
  (0, 'What made you smile today?'),
  (1, 'If we could teleport anywhere right now, where would you take me?'),
  (2, 'What is one tiny thing I do that you love?'),
  (3, 'What song reminds you of us?'),
  (4, 'Favorite memory of us this month?'),
  (5, 'What is a dream you have not told me yet?'),
  (6, 'If today had a color, what color would it be and why?'),
  (7, 'What is something you want to try together this year?'),
  (8, 'What is the weirdest food combo you secretly love?'),
  (9, 'Describe me in three emojis.'),
  (10, 'What is your love language today?'),
  (11, 'If I were a movie character, which one?'),
  (12, 'What is one thing you want to thank me for?'),
  (13, 'What would your perfect lazy Sunday look like?'),
  (14, 'A small win from your day?'),
  (15, 'Which moment together would you want to relive on loop?'),
  (16, 'What is something you are nervous about?'),
  (17, 'What animal would I be?'),
  (18, 'A place we should add to our someday list?'),
  (19, 'What is your favorite thing about right now?'),
  (20, 'What do you want more of in our days?'),
  (21, 'If we lived together full-time, what is the first thing you would change?'),
  (22, 'A tiny act of love I can do this week?'),
  (23, 'What is your honest mood, in one sentence?'),
  (24, 'What did you almost text me but did not?'),
  (25, 'What scent reminds you of home?'),
  (26, 'A goal for us this season?'),
  (27, 'Kindest thing anyone said to you recently?'),
  (28, 'If we had a band, what is its name?'),
  (29, 'One promise you want to keep?');
