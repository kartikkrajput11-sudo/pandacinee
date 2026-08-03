CREATE TABLE public.pet_pandas (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Pan',
  unlocked BOOLEAN NOT NULL DEFAULT false,
  affection INTEGER NOT NULL DEFAULT 0,
  interactions INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_visit DATE,
  costume TEXT NOT NULL DEFAULT 'classic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pet_pandas TO authenticated;
GRANT ALL ON public.pet_pandas TO service_role;

ALTER TABLE public.pet_pandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own pet" ON public.pet_pandas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create their own pet" ON public.pet_pandas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own pet" ON public.pet_pandas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);