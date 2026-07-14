ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_check
  CHECK (char_length(content) <= 2000 AND (
    type = 'text' AND char_length(content) >= 1
    OR type <> 'text'
  ));