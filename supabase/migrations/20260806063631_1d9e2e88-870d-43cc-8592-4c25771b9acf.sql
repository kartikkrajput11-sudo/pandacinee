ALTER TABLE public.love_letters ADD COLUMN IF NOT EXISTS style jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.punishment_locks ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false;