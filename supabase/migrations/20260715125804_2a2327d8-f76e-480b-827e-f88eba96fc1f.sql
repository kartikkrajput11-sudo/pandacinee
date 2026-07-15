
-- Chess games between partners/friends
CREATE TABLE public.chess_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  white_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  black_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn TEXT NOT NULL DEFAULT '',
  turn TEXT NOT NULL DEFAULT 'w' CHECK (turn IN ('w','b')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','checkmate','stalemate','draw','resigned','abandoned')),
  winner TEXT CHECK (winner IN ('w','b','draw')),
  time_control_seconds INT,
  time_increment_seconds INT DEFAULT 0,
  white_time_ms INT,
  black_time_ms INT,
  last_move_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  draw_offer_by UUID,
  undo_request_by UUID,
  rematch_offer_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chess_games TO authenticated;
GRANT ALL ON public.chess_games TO service_role;

ALTER TABLE public.chess_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view their games" ON public.chess_games
  FOR SELECT USING (auth.uid() = white_id OR auth.uid() = black_id);
CREATE POLICY "Players create their games" ON public.chess_games
  FOR INSERT WITH CHECK (auth.uid() = white_id OR auth.uid() = black_id);
CREATE POLICY "Players update their games" ON public.chess_games
  FOR UPDATE USING (auth.uid() = white_id OR auth.uid() = black_id);
CREATE POLICY "Players delete their games" ON public.chess_games
  FOR DELETE USING (auth.uid() = white_id OR auth.uid() = black_id);

CREATE INDEX chess_games_players_idx ON public.chess_games (white_id, black_id, updated_at DESC);

CREATE TRIGGER chess_games_touch BEFORE UPDATE ON public.chess_games
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_games;
