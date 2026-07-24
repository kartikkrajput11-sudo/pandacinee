import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GameBackLink } from "@/components/games/GameBackLink";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Flag, Handshake, Undo2, RefreshCcw, Bot, User, Users, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useProfileById } from "@/hooks/useProfileById";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { ChessBoard } from "@/components/chess/ChessBoard";
import { PromotionDialog } from "@/components/chess/PromotionDialog";
import { WinAnimation } from "@/components/chess/WinAnimation";
import {
  Chess,
  type Square,
  type Color,
  PIECE_GLYPH,
  capturedPieces,
  materialAdvantage,
  toPairPGN,
  isPromotion,
  computeResult,
  type PromotionPiece,
} from "@/lib/chess";
import type { AiLevel, ChessMode } from "@/lib/chess";
import { sfx } from "@/lib/chess-sfx";
import { GameChat } from "@/components/games/GameChat";
import { GroupPlayersBar } from "@/components/games/GroupPlayersBar";

const searchSchema = z.object({
  game: z.string().uuid().optional(),
  mode: z.enum(["partner", "self", "ai"]).optional(),
  ai: z.enum(["easy", "medium", "hard", "expert"]).optional(),
  matchId: z.string().optional(),
  friend: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/app/chess")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ChessPage,
  head: () => ({
    meta: [
      { title: "Chess — PandaCine" },
      { name: "description", content: "Play chess with your panda, live." },
    ],
  }),
});

type GameRow = {
  id: string;
  white_id: string;
  black_id: string;
  fen: string;
  pgn: string;
  turn: "w" | "b";
  status: "active" | "checkmate" | "stalemate" | "draw" | "resigned" | "abandoned";
  winner: "w" | "b" | "draw" | null;
  draw_offer_by: string | null;
  undo_request_by: string | null;
  rematch_offer_by: string | null;
  last_move_at: string;
};


function ChessPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const { opponentId: matchOppId, ready: matchReady } = useMatchOpponent(search.matchId, me?.id);
  const otherId = search.matchId
    ? matchOppId
    : (search.friend && me && search.friend !== me.id ? search.friend : null);
  const { data: otherProfile } = useProfileById(otherId);
  const partner = otherId
    ? ({
        id: otherId,
        display_name: otherProfile?.display_name ?? otherProfile?.username ?? "Friend",
      } as { id: string; display_name?: string })
    : profileData?.partner;

  const gameId = search.game ?? null;
  const mode = search.mode;

  // Auto-start a partner game when arriving from a group match with an opponent seated.
  useEffect(() => {
    if (!search.matchId || gameId || mode === "self" || mode === "ai") return;
    if (!matchReady || !me?.id || !matchOppId) return;
    void startPartnerGame(me.id, matchOppId).then((id) => {
      if (id) navigate({ to: "/app/chess", search: { game: id, mode: "partner", matchId: search.matchId } });
    });
  }, [search.matchId, matchReady, me?.id, matchOppId, gameId, mode, navigate]);

  // Show lobby only when no active session — partner needs a game id, local modes need a mode selection.
  if (!gameId && mode !== "self" && mode !== "ai") {
    if (search.matchId) {
      return (
        <div className="min-h-screen grid place-items-center text-candle-muted">
          Setting up the board with your opponent…
        </div>
      );
    }
    return <Lobby me={me} partner={partner} onStart={(nextMode, ai) => {
      if (nextMode === "partner") {
        void startPartnerGame(me?.id, partner?.id).then((id) => {
          if (id) navigate({ to: "/app/chess", search: { game: id, mode: "partner" } });
        });
      } else {
        navigate({ to: "/app/chess", search: { mode: nextMode, ai } });
      }
    }} />;
  }

  return (
    <>
      {search.matchId && <GroupPlayersBar matchId={search.matchId} meId={me?.id} gameName="Chess" />}
      <GameScreen gameId={gameId} mode={mode ?? "partner"} aiLevel={search.ai ?? "medium"} meId={me?.id ?? null} partnerName={partner?.display_name ?? "your panda"} />
    </>
  );
}


async function startPartnerGame(meId?: string | null, partnerId?: string | null): Promise<string | null> {
  if (!meId || !partnerId) {
    toast.error("Pair with your panda first");
    return null;
  }
  // Reuse an active game between the two players, if any, so both sides land on the same board.
  const { data: existing } = await supabase
    .from("chess_games")
    .select("id")
    .eq("status", "active")
    .or(
      `and(white_id.eq.${meId},black_id.eq.${partnerId}),and(white_id.eq.${partnerId},black_id.eq.${meId})`,
    )
    .order("last_move_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // Random side choice
  const meIsWhite = Math.random() < 0.5;
  const { data, error } = await supabase
    .from("chess_games")
    .insert({
      white_id: meIsWhite ? meId : partnerId,
      black_id: meIsWhite ? partnerId : meId,
    })
    .select("id")
    .single();
  if (error) {
    toast.error(error.message);
    return null;
  }
  return data.id;
}


// ─────────── Lobby ───────────

function Lobby({
  me,
  partner,
  onStart,
}: {
  me?: { id: string } | null;
  partner?: { id: string; display_name: string } | null;
  onStart: (mode: ChessMode, ai?: AiLevel) => void;
}) {
  const [aiLevel, setAiLevel] = useState<AiLevel>("medium");
  const [history, setHistory] = useState<GameRow[]>([]);

  useEffect(() => {
    if (!me?.id) return;
    supabase
      .from("chess_games")
      .select("*")
      .or(`white_id.eq.${me.id},black_id.eq.${me.id}`)
      .order("updated_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setHistory((data as GameRow[]) ?? []));
  }, [me?.id]);

  const stats = useMemo(() => {
    if (!me?.id) return { played: 0, wins: 0, losses: 0, draws: 0 };
    let wins = 0, losses = 0, draws = 0;
    history.forEach((g) => {
      if (g.status === "active") return;
      if (g.winner === "draw") draws++;
      else if ((g.winner === "w" && g.white_id === me.id) || (g.winner === "b" && g.black_id === me.id)) wins++;
      else if (g.winner) losses++;
    });
    return { played: wins + losses + draws, wins, losses, draws };
  }, [history, me?.id]);

  return (
    <div className="pt-10 px-5 pb-20">
      <header className="flex items-center gap-3 mb-6">
        <GameBackLink className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </GameBackLink>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Chess</p>
          <h1 className="font-serif text-3xl italic">Play together</h1>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <StatCard label="Games" value={stats.played} />
        <StatCard label="Wins" value={stats.wins} />
        <StatCard label="Draws" value={stats.draws} />
      </div>

      <div className="space-y-3 mb-6">
        <ModeCard
          disabled={!partner}
          icon={<Users className="size-6" />}
          title="Play with your panda"
          body={partner ? `Live game with ${partner.display_name}` : "Pair with your panda first"}
          onClick={() => onStart("partner")}
        />
        <ModeCard
          icon={<User className="size-6" />}
          title="Play yourself"
          body="Control both sides, learn openings, replay ideas."
          onClick={() => onStart("self")}
        />
        <div className="p-5 rounded-3xl border border-petal/20 bg-surface">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-petal-soft flex items-center justify-center text-petal">
              <Bot className="size-6" />
            </div>
            <div>
              <p className="font-serif italic text-lg leading-tight">Play vs AI</p>
              <p className="text-xs text-candle-muted">Adaptive difficulty. No repeats.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {(["easy", "medium", "hard", "expert"] as AiLevel[]).map((l) => (
              <button
                key={l}
                onClick={() => setAiLevel(l)}
                className={`py-2 text-xs rounded-xl border transition-all capitalize ${
                  aiLevel === l ? "bg-petal text-velvet border-petal" : "bg-velvet border-petal/20 text-candle-muted"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={() => onStart("ai", aiLevel)}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-petal to-lavender text-velvet font-semibold shadow-petal hover:opacity-95"
          >
            Start game
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Recent games</p>
          <div className="space-y-2">
            {history.map((g) => (
              <Link
                key={g.id}
                to="/app/chess"
                search={{ game: g.id, mode: "partner" as const }}
                className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-petal/10 hover:border-petal/40 transition-colors"
              >
                <span className="text-sm">
                  {g.status === "active" ? "In progress" : g.winner === "draw" ? "Draw" :
                    (g.winner === "w" && g.white_id === me?.id) || (g.winner === "b" && g.black_id === me?.id) ? "You won" : "You lost"}
                </span>
                <span className="text-xs text-candle-muted">{new Date(g.last_move_at).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-petal/10 text-center">
      <p className="text-2xl font-serif italic">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-candle-muted">{label}</p>
    </div>
  );
}

function ModeCard({
  icon,
  title,
  body,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 p-5 rounded-3xl border border-petal/20 bg-surface hover:border-petal/50 transition-all text-left disabled:opacity-50"
    >
      <div className="w-11 h-11 rounded-2xl bg-petal-soft flex items-center justify-center text-petal shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-serif italic text-lg leading-tight">{title}</p>
        <p className="text-xs text-candle-muted">{body}</p>
      </div>
    </button>
  );
}

// ─────────── Game screen ───────────

function GameScreen({
  gameId,
  mode,
  aiLevel,
  meId,
  partnerName,
}: {
  gameId: string | null;
  mode: ChessMode;
  aiLevel: AiLevel;
  meId: string | null;
  partnerName: string;
}) {
  const isLocal = mode !== "partner";
  const [game, setGame] = useState<GameRow | null>(null);
  const [chess, setChess] = useState(() => new Chess());
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [muted, setMuted] = useState(false);
  const [orientation, setOrientation] = useState<Color>("w");
  const [historyCursor, setHistoryCursor] = useState<number | null>(null); // null = live
  const [thinking, setThinking] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [partnerHere, setPartnerHere] = useState(false);
  const aiRef = useRef(false);

  // ── Load / subscribe for partner games ──
  useEffect(() => {
    if (isLocal || !gameId || !meId) return;
    let cancelled = false;
    supabase.from("chess_games").select("*").eq("id", gameId).maybeSingle().then(({ data }) => {
      if (cancelled || !data) return;
      const row = data as GameRow;
      setGame(row);
      setChess(loadChess(row.pgn, row.fen));
    });
    const ch = supabase
      .channel(`chess:${gameId}`, { config: { presence: { key: meId } } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chess_games", filter: `id=eq.${gameId}` }, (p) => {
        const row = p.new as GameRow;
        setGame((prev) => {
          // Sound for opponent's move
          if (prev && prev.pgn !== row.pgn && row.turn === (meId === row.white_id ? "w" : "b")) {
            try {
              const c = new Chess();
              c.loadPgn(row.pgn);
              const last = c.history({ verbose: true }).pop();
              if (last) {
                if (last.captured) sfx.capture({ muted });
                else if (last.san === "O-O" || last.san === "O-O-O") sfx.castle({ muted });
                else if (last.promotion) sfx.promote({ muted });
                else sfx.move({ muted });
                if (c.inCheck() && !c.isCheckmate()) sfx.check({ muted });
              }
            } catch { /* ignore */ }
          }
          return row;
        });
        setChess(loadChess(row.pgn, row.fen));
        setHistoryCursor(null);
      })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<{ id: string }>();
        const ids = new Set<string>();
        Object.values(state).forEach((metas) => metas.forEach((m) => m?.id && ids.add(m.id)));
        setPartnerHere(Array.from(ids).some((id) => id !== meId));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ id: meId, at: Date.now() });
      });
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isLocal, meId]);


  // Auto-flip for black player
  useEffect(() => {
    if (game && meId === game.black_id) setOrientation("b");
  }, [game, meId]);

  // ── AI moves ──
  useEffect(() => {
    if (mode !== "ai" || chess.isGameOver()) return;
    // AI plays black by default
    if (chess.turn() !== "b" || aiRef.current) return;
    aiRef.current = true;
    setThinking(true);
    (async () => {
      const { aiPickMove } = await import("@/lib/stockfish");
      const move = await aiPickMove(chess.fen(), aiLevel);
      if (move) applyLocalMove(move.from as Square, move.to as Square, move.promotion as PromotionPiece | undefined);
      setThinking(false);
      aiRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, mode, aiLevel]);

  // ── Game-over celebration ──
  useEffect(() => {
    const result = computeResult(chess);
    if (result.status !== "active" && !confetti) {
      setConfetti(true);
      if (result.winner === "draw") {
        sfx.draw({ muted });
      } else if (result.winner && myColor && myColor !== "both" && result.winner !== myColor) {
        sfx.lose({ muted });
      }
      // The win animation drives its own cinematic stinger via winCinematic.
      setTimeout(() => setConfetti(false), 4500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess]);

  // Game-start chime once game/mode is ready
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (isLocal || (game && (mode === "partner" ? partnerHere : true))) {
      startedRef.current = true;
      sfx.gameStart({ muted });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal, game, partnerHere, mode]);


  const myColor: Color | "both" | null = useMemo(() => {
    if (historyCursor !== null) return null;
    if (mode === "self") return "both";
    if (mode === "ai") return "w";
    if (!game || !meId) return null;
    if (meId === game.white_id) return "w";
    if (meId === game.black_id) return "b";
    return null;
  }, [mode, game, meId, historyCursor]);

  const displayChess = useMemo(() => {
    if (historyCursor === null) return chess;
    const c = new Chess();
    const history = chess.history();
    for (let i = 0; i < historyCursor && i < history.length; i++) c.move(history[i]);
    return c;
  }, [chess, historyCursor]);

  const lastMove = useMemo(() => {
    const h = displayChess.history({ verbose: true });
    const last = h[h.length - 1];
    return last ? { from: last.from as Square, to: last.to as Square } : null;
  }, [displayChess]);

  function applyLocalMove(from: Square, to: Square, promo?: PromotionPiece) {
    const next = new Chess(chess.fen());
    // Rebuild history so PGN stays intact
    chess.history().forEach(() => { /* no-op, we use fen replay */ });
    // We need to keep move history; reconstruct from pgn string
    const rebuild = new Chess();
    try {
      rebuild.loadPgn(chess.pgn());
    } catch { /* first move */ }
    const move = rebuild.move({ from, to, promotion: promo });
    if (!move) return;
    setChess(rebuild);
    if (move.captured) sfx.capture({ muted });
    else if (move.san === "O-O" || move.san === "O-O-O") sfx.castle({ muted });
    else if (move.promotion) sfx.promote({ muted });
    else sfx.move({ muted });
    if (rebuild.inCheck() && !rebuild.isCheckmate()) sfx.check({ muted });

    // Persist for partner mode
    if (!isLocal && game) {
      const result = computeResult(rebuild);
      supabase
        .from("chess_games")
        .update({
          fen: rebuild.fen(),
          pgn: rebuild.pgn(),
          turn: rebuild.turn(),
          status: result.status === "active" ? "active" : result.status,
          winner: result.winner,
          last_move_at: new Date().toISOString(),
          draw_offer_by: null,
          undo_request_by: null,
        })
        .eq("id", game.id)
        .then(({ error }) => {
          if (error) toast.error(error.message);
        });
    }
    return move;
  }

  function tryMove(from: Square, to: Square) {
    if (isPromotion(chess, from, to)) {
      setPromotion({ from, to });
      return;
    }
    applyLocalMove(from, to);
  }

  const result = computeResult(displayChess);
  const cap = capturedPieces(displayChess);
  const adv = materialAdvantage(displayChess);
  const pgnRows = toPairPGN(chess);

  const myTurn =
    isLocal
      ? (mode === "self" ? true : chess.turn() === "w" && !thinking)
      : !!game && chess.turn() === (meId === game.white_id ? "w" : "b") && game.status === "active";

  const opponentName = !isLocal && game
    ? (meId === game.white_id ? "Black" : "White")
    : mode === "ai" ? `AI · ${aiLevel}` : "Yourself";

  return (
    <div className="pt-6 px-3 pb-12 min-h-screen">
      <header className="flex items-center gap-3 mb-4 px-2">
        <Link to="/app/chess" search={{}} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Chess</p>
          <h1 className="font-serif italic text-xl">vs {opponentName}</h1>
        </div>
        <button onClick={() => setMuted((m) => !m)} className="p-2 rounded-full bg-surface border border-petal/20">
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        {mode !== "partner" && (
          <button onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))} className="p-2 rounded-full bg-surface border border-petal/20">
            <RefreshCcw className="size-4" />
          </button>
        )}
      </header>

      {/* Top player bar */}
      <PlayerBar
        label={orientation === "w" ? "Opponent" : "You"}
        captured={cap[orientation === "w" ? "b" : "w"]}
        adv={orientation === "w" ? -adv : adv}
        color={orientation === "w" ? "b" : "w"}
        active={displayChess.turn() === (orientation === "w" ? "b" : "w") && result.status === "active"}
      />

      <div className="flex justify-center my-3 relative">
        <ChessBoard
          chess={displayChess}
          orientation={orientation}
          canMoveColor={
            mode === "partner" && !partnerHere
              ? null
              : historyCursor !== null || result.status !== "active"
              ? null
              : myColor
          }
          lastMove={lastMove}
          onMove={tryMove}
        />
        {mode === "partner" && !partnerHere && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-velvet/70 backdrop-blur-sm z-10">
            <div className="text-center px-6">
              <div className="text-4xl mb-2 animate-bounce">🐼</div>
              <p className="font-serif italic text-lg">Waiting for {partnerName}…</p>
              <p className="text-xs text-candle-muted mt-1">The match starts the moment your panda arrives.</p>
            </div>
          </div>
        )}
      </div>

      <PlayerBar
        label={orientation === "w" ? "You" : "Opponent"}
        captured={cap[orientation === "w" ? "w" : "b"]}
        adv={orientation === "w" ? adv : -adv}
        color={orientation === "w" ? "w" : "b"}
        active={displayChess.turn() === orientation && result.status === "active"}
      />

      {thinking && <p className="text-center text-xs text-candle-muted mt-2 animate-pulse">AI is thinking…</p>}

      {/* Game status */}
      {result.status !== "active" && (
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-petal/20 to-lavender/10 border border-petal/40 text-center">
          <p className="font-serif italic text-2xl">
            {result.status === "checkmate" ? "Checkmate" : result.status === "stalemate" ? "Stalemate" : "Draw"}
          </p>
          <p className="text-sm text-candle-muted">
            {result.winner === "draw" ? "Well played, both of you." :
              result.winner ? `${result.winner === "w" ? "White" : "Black"} wins` : ""}
          </p>
        </div>
      )}

      {/* Win animation — sword slices the losing king's head */}
      <WinAnimation
        trigger={
          confetti && result.winner && result.winner !== "draw" ? `${result.winner}-${chess.history().length}` : null
        }
        loserColor={
          result.winner === "w" ? "b" : result.winner === "b" ? "w" : null
        }
        muted={muted}
        onDone={() => { /* handled by confetti timer */ }}
      />


      {/* Draw / stalemate — soft confetti */}
      {confetti && result.winner === "draw" && (
        <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-2xl animate-[fall_3s_ease-out_forwards]"
              style={{
                left: `${Math.random() * 100}%`,
                top: "-10%",
                animationDelay: `${Math.random() * 1.5}s`,
                color: ["#e879f9", "#f0abfc", "#f9a8d4", "#fbbf24"][i % 4],
              }}
            >
              {["✨", "💜", "🌸", "⭐"][i % 4]}
            </span>
          ))}
          <style>{`@keyframes fall { to { transform: translateY(110vh) rotate(360deg); opacity: 0; } }`}</style>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 mt-4">
        {isLocal ? (
          <button
            onClick={() => {
              const c = new Chess();
              const h = chess.history();
              for (let i = 0; i < h.length - (mode === "ai" ? 2 : 1); i++) c.move(h[i]);
              setChess(c);
            }}
            disabled={chess.history().length === 0}
            className="flex-1 py-2 rounded-2xl bg-surface border border-petal/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Undo2 className="size-4" /> Undo
          </button>
        ) : game ? (
          <>
            <button
              onClick={() => partnerAction(game.id, meId, "undo")}
              disabled={chess.history().length === 0 || game.status !== "active"}
              className="flex-1 py-2 rounded-2xl bg-surface border border-petal/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Undo2 className="size-4" /> Undo
            </button>
            <button
              onClick={() => partnerAction(game.id, meId, "draw")}
              disabled={game.status !== "active"}
              className="flex-1 py-2 rounded-2xl bg-surface border border-petal/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Handshake className="size-4" /> Draw
            </button>
            <button
              onClick={() => {
                if (confirm("Resign this game?")) resign(game.id, meId);
              }}
              disabled={game.status !== "active"}
              className="flex-1 py-2 rounded-2xl bg-surface border border-red-400/30 text-red-300 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Flag className="size-4" /> Resign
            </button>
          </>
        ) : null}
      </div>

      {/* Partner requests */}
      {!isLocal && game && game.draw_offer_by && game.draw_offer_by !== meId && game.status === "active" && (
        <RequestBanner
          text={`${opponentName} offers a draw`}
          onAccept={() => acceptDraw(game.id)}
          onDecline={() => clearOffer(game.id)}
        />
      )}
      {!isLocal && game && game.undo_request_by && game.undo_request_by !== meId && game.status === "active" && (
        <RequestBanner
          text={`${opponentName} wants to undo last move`}
          onAccept={() => acceptUndo(game, chess, setChess)}
          onDecline={() => clearOffer(game.id)}
        />
      )}

      {/* Rematch */}
      {result.status !== "active" && (
        <button
          onClick={async () => {
            if (mode === "partner" && game) {
              const id = await startPartnerGame(meId, meId === game.white_id ? game.black_id : game.white_id);
              if (id) window.location.search = `?game=${id}&mode=partner`;
            } else {
              setChess(new Chess());
              setConfetti(false);
              setHistoryCursor(null);
            }
          }}
          className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-petal to-lavender text-velvet font-semibold shadow-petal flex items-center justify-center gap-2"
        >
          <RotateCcw className="size-4" /> Rematch
        </button>
      )}

      {/* Move list */}
      {pgnRows.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Moves</p>
          <div className="p-3 rounded-2xl bg-surface border border-petal/10 max-h-48 overflow-y-auto font-mono text-sm">
            {pgnRows.map((row, i) => (
              <div key={i} className="flex gap-3 py-0.5">
                <span className="text-candle-muted w-6">{i + 1}.</span>
                <span>{row}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setHistoryCursor((c) => Math.max(0, (c ?? chess.history().length) - 1))}
              className="flex-1 py-2 rounded-xl bg-surface border border-petal/20 text-xs"
            >
              ← Prev
            </button>
            <button
              onClick={() => setHistoryCursor(null)}
              className="flex-1 py-2 rounded-xl bg-surface border border-petal/20 text-xs"
            >
              Live
            </button>
            <button
              onClick={() =>
                setHistoryCursor((c) => {
                  if (c === null) return null;
                  return c + 1 >= chess.history().length ? null : c + 1;
                })
              }
              className="flex-1 py-2 rounded-xl bg-surface border border-petal/20 text-xs"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {promotion && (
        <PromotionDialog
          color={chess.turn()}
          onPick={(p) => {
            applyLocalMove(promotion.from, promotion.to, p);
            setPromotion(null);
          }}
          onCancel={() => setPromotion(null)}
        />
      )}

      {mode === "partner" && game && meId && (
        <GameChat
          roomKey={`chess:${game.id}`}
          me={{ id: meId }}
          partnerName={partnerName}
          title="Chess table"
        />
      )}
    </div>
  );
}

function loadChess(pgn: string, fen: string): Chess {
  const c = new Chess();
  if (pgn) {
    try {
      c.loadPgn(pgn);
      return c;
    } catch { /* fall through */ }
  }
  try {
    c.load(fen);
  } catch { /* ignore */ }
  return c;
}

function PlayerBar({
  label,
  captured,
  adv,
  color,
  active,
}: {
  label: string;
  captured: import("chess.js").PieceSymbol[];
  adv: number;
  color: Color;
  active: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl bg-surface border ${active ? "border-petal/60 shadow-petal" : "border-petal/10"}`}>
      <div className={`w-2.5 h-2.5 rounded-full ${active ? "bg-petal animate-pulse" : "bg-candle-muted/40"}`} />
      <span className="text-sm font-serif italic">{label}</span>
      <div className="flex-1 flex items-center gap-0.5 flex-wrap justify-end">
        {captured.map((p, i) => (
          <span
            key={i}
            className="text-lg leading-none"
            style={{
              color: color === "w" ? "black" : "white",
              textShadow: color === "w" ? "0 1px 1px rgba(255,255,255,0.35)" : "0 1px 1px rgba(0,0,0,0.6)",
            }}
          >
            {PIECE_GLYPH[color === "w" ? "b" : "w"][p]}
          </span>
        ))}
        {adv > 0 && <span className="text-xs text-candle-muted ml-1">+{adv}</span>}
      </div>
    </div>
  );
}

function RequestBanner({ text, onAccept, onDecline }: { text: string; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="mt-3 p-3 rounded-2xl bg-petal-soft border border-petal/40 flex items-center gap-2">
      <span className="text-sm flex-1">{text}</span>
      <button onClick={onAccept} className="px-3 py-1.5 rounded-xl bg-petal text-velvet text-xs font-semibold">Accept</button>
      <button onClick={onDecline} className="px-3 py-1.5 rounded-xl bg-velvet border border-petal/20 text-xs">Decline</button>
    </div>
  );
}

// ─────────── Partner actions ───────────
async function partnerAction(gameId: string, meId: string | null, kind: "draw" | "undo") {
  if (!meId) return;
  
  const update = kind === "draw" ? { draw_offer_by: meId } : { undo_request_by: meId };
  const { error } = await supabase.from("chess_games").update(update).eq("id", gameId);
  if (error) toast.error(error.message);
  else toast.success(kind === "draw" ? "Draw offered" : "Undo requested");
}
async function acceptDraw(gameId: string) {
  await supabase.from("chess_games").update({ status: "draw", winner: "draw", draw_offer_by: null }).eq("id", gameId);
}
async function clearOffer(gameId: string) {
  await supabase.from("chess_games").update({ draw_offer_by: null, undo_request_by: null }).eq("id", gameId);
}
async function acceptUndo(game: GameRow, chess: Chess, setChess: (c: Chess) => void) {
  const c = new Chess();
  const h = chess.history();
  for (let i = 0; i < h.length - 1; i++) c.move(h[i]);
  setChess(c);
  await supabase.from("chess_games").update({
    fen: c.fen(),
    pgn: c.pgn(),
    turn: c.turn(),
    undo_request_by: null,
  }).eq("id", game.id);
}
async function resign(gameId: string, meId: string | null) {
  if (!meId) return;
  const { data } = await supabase.from("chess_games").select("white_id").eq("id", gameId).maybeSingle();
  if (!data) return;
  const winner = data.white_id === meId ? "b" : "w";
  await supabase.from("chess_games").update({ status: "resigned", winner }).eq("id", gameId);
}
