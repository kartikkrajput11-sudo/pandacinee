
CREATE TABLE public.movie_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_id BIGINT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'movie',
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX movie_chat_messages_room_idx
  ON public.movie_chat_messages (movie_id, media_type, created_at);
CREATE INDEX movie_chat_messages_pair_idx
  ON public.movie_chat_messages (sender_id, receiver_id);

GRANT SELECT, INSERT, DELETE ON public.movie_chat_messages TO authenticated;
GRANT ALL ON public.movie_chat_messages TO service_role;

ALTER TABLE public.movie_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read movie chat"
  ON public.movie_chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send their own movie chat messages"
  ON public.movie_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders can delete their own movie chat messages"
  ON public.movie_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.movie_chat_messages;
