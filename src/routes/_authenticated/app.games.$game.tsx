import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, History, RefreshCw, Send, SkipForward, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  GAMES,
  GameKind,
  THIS_OR_THAT,
  WOULD_YOU_RATHER,
  GUESS_ME,
  TRUTH_OR_DARE,
  checkWinner,
  TTTCell,
  RPS_CHOICES,
  RPS_EMOJI,
  RPSChoice,
  rpsWinner,
} from "@/lib/games";
import { generateGameCard } from "@/lib/games.functions";

const paramsSchema = z.object({
  game: z.enum([
    "truth-or-dare",
    "this-or-that",
    "would-you-rather",
    "never-have-i-ever",
    "guess-me",
    "two-truths-lie",
    "hot-takes",
    "emoji-riddle",
    "tic-tac-toe",
    "rock-paper-scissors",
  ]),
});

const INTENSITIES = [
  { id: "sweet", label: "Sweet", emoji: "🌸" },
  { id: "playful", label: "Playful", emoji: "✨" },
  { id: "spicy", label: "Spicy", emoji: "🌶️" },
  { id: "deep", label: "Deep", emoji: "🌙" },
] as const;
type Intensity = (typeof INTENSITIES)[number]["id"];

export const Route = createFileRoute("/_authenticated/app/games/$game")({
  parseParams: (raw) => paramsSchema.parse(raw),
  component: GameRoute,
});

type Session = { id: string; host_id: string; partner_id: string; game: string; state: any };

function GameRoute() {
  const { game } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [session, setSession] = useState<Session | null>(null);
  const meta = GAMES[game as GameKind];

  useEffect(() => {
    if (!me || !partner) return;
    let active = true;
    (async () => {
      // try find latest session between us
      const { data: existing } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game", game)
        .or(
          `and(host_id.eq.${me.id},partner_id.eq.${partner.id}),and(host_id.eq.${partner.id},partner_id.eq.${me.id})`
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing && active) {
        setSession(existing as Session);
        return;
      }
      const initial = initialState(game as GameKind);
      const { data: created, error } = await supabase
        .from("game_sessions")
        .insert({ host_id: me.id, partner_id: partner.id, game, state: initial })
        .select("*")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (active) setSession(created as Session);
    })();
    return () => {
      active = false;
    };
  }, [me?.id, partner?.id, game]);

  useEffect(() => {
    if (!session?.id) return;
    const ch = supabase
      .channel(`game-${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` },
        (payload: any) => setSession((s) => (s ? { ...s, state: payload.new.state } : s))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session?.id]);

  async function patch(state: any) {
    if (!session) return;
    setSession({ ...session, state });
    const { error } = await supabase.from("game_sessions").update({ state }).eq("id", session.id);
    if (error) toast.error(error.message);
  }

  if (!me) return null;
  if (!partner) {
    return (
      <div className="pt-10 px-5">
        <Link to="/app/play" className="text-candle-muted text-sm flex items-center gap-2 mb-4">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <p className="text-sm text-candle-muted">Pair with your partner to play this game.</p>
      </div>
    );
  }

  return (
    <div className="pt-10 px-5 pb-10">
      <header className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate({ to: "/app/play" })} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Game</p>
          <h1 className="font-serif text-2xl italic">
            {meta.emoji} {meta.name}
          </h1>
        </div>
      </header>

      {!session ? (
        <p className="text-sm text-candle-muted">Starting session…</p>
      ) : game === "truth-or-dare" ? (
        <TruthOrDare me={me.id} session={session} patch={patch} />
      ) : game === "this-or-that" ? (
        <PairPick game="this-or-that" me={me.id} session={session} patch={patch} fallback={THIS_OR_THAT} />
      ) : game === "would-you-rather" ? (
        <PairPick game="would-you-rather" me={me.id} session={session} patch={patch} fallback={WOULD_YOU_RATHER} />
      ) : game === "never-have-i-ever" ? (
        <NeverHaveIEver me={me.id} session={session} patch={patch} />
      ) : game === "two-truths-lie" ? (
        <TwoTruthsLie me={me.id} session={session} patch={patch} />
      ) : game === "hot-takes" ? (
        <HotTakes me={me.id} session={session} patch={patch} />
      ) : game === "emoji-riddle" ? (
        <EmojiRiddle me={me.id} session={session} patch={patch} />
      ) : game === "tic-tac-toe" ? (
        <TicTacToe me={me.id} session={session} patch={patch} />
      ) : game === "rock-paper-scissors" ? (
        <RockPaperScissors me={me.id} session={session} patch={patch} />
      ) : (
        <GuessMe me={me.id} partnerId={partner.id} session={session} patch={patch} />
      )}
    </div>
  );
}

function initialState(game: GameKind) {
  if (game === "truth-or-dare")
    return {
      count: 0,
      card: null as null | { type: "truth" | "dare"; text: string },
      intensity: "playful" as Intensity,
      history: [] as { type: "truth" | "dare"; text: string }[],
      tally: { truth: 0, dare: 0, skipped: 0 },
      bestOf: 10,
    };
  if (game === "this-or-that" || game === "would-you-rather")
    return {
      count: 0,
      card: null as null | { a: string; b: string },
      picks: {} as Record<string, 0 | 1>,
      score: { matches: 0, total: 0 },
      intensity: "playful" as Intensity,
      history: [] as { a: string; b: string }[],
      bestOf: 10,
    };
  if (game === "never-have-i-ever")
    return {
      count: 0,
      card: null as null | { text: string },
      picks: {} as Record<string, 0 | 1>,
      tallies: { have: 0, havent: 0 },
      intensity: "playful" as Intensity,
      history: [] as { text: string }[],
      bestOf: 10,
    };
  if (game === "two-truths-lie")
    return {
      count: 0,
      card: null as null | { statements: string[]; lie: number; reveal: string },
      guesses: {} as Record<string, number>,
      revealed: false,
      score: {} as Record<string, number>,
      intensity: "playful" as Intensity,
      history: [] as { statements: string[]; lie: number }[],
      bestOf: 10,
    };
  if (game === "hot-takes")
    return {
      count: 0,
      card: null as null | { text: string; tag?: string },
      ratings: {} as Record<string, number>,
      alignment: { total: 0, sum: 0 },
      intensity: "playful" as Intensity,
      history: [] as { text: string }[],
      bestOf: 10,
    };
  if (game === "emoji-riddle")
    return {
      count: 0,
      card: null as null | { emojis: string; answer: string; category: string; hint: string },
      guesses: {} as Record<string, string>,
      hintShown: false,
      revealed: false,
      score: {} as Record<string, number>,
      intensity: "playful" as Intensity,
      history: [] as { emojis: string; answer: string }[],
      bestOf: 10,
    };
  if (game === "tic-tac-toe")
    return { board: Array(9).fill(null), turn: "X", wins: { X: 0, O: 0, draws: 0 }, bestOf: 5 };
  if (game === "rock-paper-scissors")
    return { picks: {} as Record<string, RPSChoice>, round: 1, score: {} as Record<string, number>, bestOf: 5 };
  return {
    count: 0,
    card: null as null | { text: string },
    answer: null as string | null,
    answeredBy: null as string | null,
    guess: null as string | null,
    revealed: false,
    intensity: "playful" as Intensity,
    history: [] as { prompt: string; answer: string; guess: string; verdict: "right" | "close" | "wrong" | null }[],
    tally: { right: 0, close: 0, wrong: 0 },
    bestOf: 10,
  };
}

const BEST_OF_OPTIONS = [5, 10, 20, 0] as const;
function MatchControls({
  round,
  bestOf,
  onBestOf,
  onRematch,
  disabled,
}: {
  round: number;
  bestOf: number;
  onBestOf: (n: number) => void;
  onRematch: () => void;
  disabled?: boolean;
}) {
  const done = bestOf > 0 && round > bestOf;
  return (
    <div className="flex items-center justify-between gap-2 mb-3 text-xs">
      <div className="flex items-center gap-1.5 text-candle-muted">
        <span className="uppercase tracking-widest text-petal text-[10px]">Best of</span>
        <select
          value={bestOf}
          onChange={(e) => onBestOf(Number(e.target.value))}
          disabled={disabled}
          className="bg-surface border border-border rounded-full px-2 py-0.5 text-xs text-candle"
        >
          {BEST_OF_OPTIONS.map((n) => (
            <option key={n} value={n}>{n === 0 ? "∞" : n}</option>
          ))}
        </select>
        <span className="ml-1">
          Round <span className="text-candle">{Math.min(round, bestOf || round)}</span>
          {bestOf > 0 ? <span className="text-candle-muted"> / {bestOf}</span> : null}
        </span>
      </div>
      <button
        onClick={onRematch}
        disabled={disabled}
        className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-candle-muted hover:text-candle disabled:opacity-60"
      >
        <RefreshCw className="size-3" /> Rematch
      </button>
    </div>
  );
}
function MatchComplete({ title, subtitle, onRematch }: { title: string; subtitle: string; onRematch: () => void }) {
  return (
    <div className="p-5 rounded-3xl border border-petal bg-petal-soft text-center mb-4">
      <p className="text-[10px] uppercase tracking-widest text-petal mb-1">Match complete</p>
      <p className="font-serif italic text-xl mb-1">{title}</p>
      <p className="text-xs text-candle-muted mb-3">{subtitle}</p>
      <button onClick={onRematch} className="px-5 py-2 bg-petal text-velvet rounded-full font-semibold text-sm inline-flex items-center gap-2">
        <RefreshCw className="size-3.5" /> Rematch
      </button>
    </div>
  );
}

function HistoryStrip({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <details className="mt-4 rounded-2xl border border-border bg-surface/50">
      <summary className="cursor-pointer px-4 py-2.5 text-xs text-candle-muted flex items-center gap-2">
        <History className="size-3.5" /> Recent cards ({items.length})
      </summary>
      <div className="px-4 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
        {items.slice(-8).reverse().map((t, i) => (
          <p key={i} className="text-xs text-candle-muted italic">· {t}</p>
        ))}
      </div>
    </details>
  );
}

function IntensityBar({
  value,
  onChange,
  disabled,
}: {
  value: Intensity;
  onChange: (v: Intensity) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1 mb-4 p-1 rounded-full bg-surface border border-border">
      {INTENSITIES.map((i) => (
        <button
          key={i.id}
          onClick={() => !disabled && onChange(i.id)}
          disabled={disabled}
          className={`flex-1 py-1.5 text-xs rounded-full transition-all ${
            value === i.id ? "bg-petal text-velvet font-semibold" : "text-candle-muted"
          }`}
        >
          {i.emoji} {i.label}
        </button>
      ))}
    </div>
  );
}

function TicTacToe({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? { board: Array(9).fill(null), turn: "X", wins: { X: 0, O: 0, draws: 0 }, bestOf: 5 };
  const board: TTTCell[] = s.board;
  const mySymbol = session.host_id === me ? "X" : "O";
  const winner = checkWinner(board);
  const bestOf: number = s.bestOf ?? 5;
  const wins = s.wins ?? { X: 0, O: 0, draws: 0 };
  const played = (wins.X ?? 0) + (wins.O ?? 0) + (wins.draws ?? 0);
  const round = played + 1;
  const matchDone = bestOf > 0 && played >= bestOf;
  const myTurn = !winner && s.turn === mySymbol && !matchDone;

  function play(i: number) {
    if (!myTurn || board[i]) return;
    const next = [...board];
    next[i] = mySymbol;
    const w = checkWinner(next);
    const nextWins = { ...wins };
    if (w === "draw") nextWins.draws = (nextWins.draws ?? 0) + 1;
    else if (w) nextWins[w] = (nextWins[w] ?? 0) + 1;
    patch({ ...s, board: next, turn: mySymbol === "X" ? "O" : "X" });
    if (w)
      setTimeout(
        () =>
          patch({
            ...s,
            board: Array(9).fill(null),
            turn: w === "draw" ? s.turn : w === "X" ? "O" : "X",
            wins: nextWins,
          }),
        1500
      );
  }

  function rematch() {
    patch({ ...s, board: Array(9).fill(null), turn: "X", wins: { X: 0, O: 0, draws: 0 } });
  }

  return (
    <div>
      <MatchControls round={round} bestOf={bestOf} onBestOf={(n) => patch({ ...s, bestOf: n })} onRematch={rematch} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        You are {mySymbol} · X {wins.X ?? 0} – O {wins.O ?? 0} · draws {wins.draws ?? 0}
      </p>
      {matchDone ? (
        <MatchComplete
          title={
            (wins.X ?? 0) === (wins.O ?? 0)
              ? "Draw match 🤝"
              : (wins.X ?? 0) > (wins.O ?? 0)
              ? "X wins the match 🎉"
              : "O wins the match 🎉"
          }
          subtitle={`X ${wins.X ?? 0} · O ${wins.O ?? 0} · draws ${wins.draws ?? 0}`}
          onRematch={rematch}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-5 mx-auto max-w-[300px]">
            {board.map((c, i) => (
              <button
                key={i}
                onClick={() => play(i)}
                disabled={!myTurn || !!c || !!winner}
                className="aspect-square rounded-2xl bg-surface border border-border text-4xl font-serif italic disabled:opacity-70"
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-candle-muted">
            {winner === "draw"
              ? "Draw 🤝 — new round…"
              : winner
              ? `${winner} wins 🎉 — new round…`
              : myTurn
              ? "Your move"
              : "Waiting on your panda…"}
          </p>
        </>
      )}
    </div>
  );
}

function RockPaperScissors({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? { picks: {}, round: 1, score: {}, bestOf: 5 };
  const otherId = session.host_id === me ? session.partner_id : session.host_id;
  const myPick = s.picks?.[me] as RPSChoice | undefined;
  const theirPick = s.picks?.[otherId] as RPSChoice | undefined;
  const both = myPick && theirPick;
  const myScore = s.score?.[me] ?? 0;
  const theirScore = s.score?.[otherId] ?? 0;
  const bestOf: number = s.bestOf ?? 5;
  const round: number = s.round ?? 1;
  const matchDone = bestOf > 0 && round > bestOf;

  function pick(c: RPSChoice) {
    if (myPick || matchDone) return;
    patch({ ...s, picks: { ...s.picks, [me]: c } });
  }
  function next() {
    if (!both) return;
    const w = rpsWinner(myPick!, theirPick!);
    const score = { ...(s.score ?? {}) };
    if (w === 0) score[me] = (score[me] ?? 0) + 1;
    else if (w === 1) score[otherId] = (score[otherId] ?? 0) + 1;
    patch({ ...s, picks: {}, round: (s.round ?? 1) + 1, score });
  }
  function rematch() {
    patch({ ...s, picks: {}, round: 1, score: {} });
  }
  const result = both ? rpsWinner(myPick!, theirPick!) : null;

  return (
    <div>
      <MatchControls round={round} bestOf={bestOf} onBestOf={(n) => patch({ ...s, bestOf: n })} onRematch={rematch} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        You {myScore} – {theirScore} Them
      </p>
      {matchDone ? (
        <MatchComplete
          title={myScore === theirScore ? "Draw match 🤝" : myScore > theirScore ? "You win the match 🎉" : "They win the match 🌸"}
          subtitle={`Final ${myScore} – ${theirScore}`}
          onRematch={rematch}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {RPS_CHOICES.map((c) => (
              <button
                key={c}
                onClick={() => pick(c)}
                disabled={!!myPick}
                className={`aspect-square rounded-3xl border text-5xl flex items-center justify-center transition-all ${
                  myPick === c ? "border-petal bg-petal-soft" : "border-border bg-surface"
                } ${myPick && myPick !== c ? "opacity-40" : ""}`}
              >
                {RPS_EMOJI[c]}
              </button>
            ))}
          </div>
          {both ? (
            <div className="p-4 rounded-2xl border border-petal bg-petal-soft text-center mb-4">
              <p className="font-serif italic text-xl">
                {result === -1 ? "Tie 🤝" : result === 0 ? "You won 🎉" : "They won 🌸"}
              </p>
              <p className="text-xs text-candle-muted mt-1">{RPS_EMOJI[myPick!]} vs {RPS_EMOJI[theirPick!]}</p>
              <button onClick={next} className="mt-3 px-5 py-2 bg-petal text-velvet rounded-full font-semibold">Next round</button>
            </div>
          ) : myPick ? (
            <p className="text-sm text-candle-muted text-center">Locked in. Waiting on your panda…</p>
          ) : (
            <p className="text-sm text-candle-muted text-center">Pick your weapon.</p>
          )}
        </>
      )}
    </div>
  );
}

function useCardFetcher(kind: "truth-or-dare" | "would-you-rather" | "this-or-that" | "never-have-i-ever" | "guess-me" | "two-truths-lie" | "hot-takes" | "emoji-riddle") {
  const [loading, setLoading] = useState(false);
  async function fetchCard(intensity: Intensity, type?: "truth" | "dare"): Promise<any | null> {
    setLoading(true);
    try {
      const res = await generateGameCard({ data: { kind, intensity, ...(type ? { type } : {}) } });
      return (res as any).card;
    } catch (err: any) {
      toast.error(err?.message ?? "AI unavailable");
      return null;
    } finally {
      setLoading(false);
    }
  }
  return { loading, fetchCard };
}

function SwipeToReveal({ label, onReveal }: { label: string; onReveal: () => void }) {
  const [x, setX] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const THRESHOLD = 110;
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-petal/40 bg-gradient-to-br from-petal-soft to-transparent select-none touch-pan-y"
      style={{ minHeight: 120 }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setStart(e.clientX);
      }}
      onPointerMove={(e) => {
        if (start == null) return;
        const dx = Math.max(0, Math.min(220, e.clientX - start));
        setX(dx);
      }}
      onPointerUp={() => {
        if (x >= THRESHOLD) {
          onReveal();
        }
        setStart(null);
        setX(0);
      }}
      onPointerCancel={() => {
        setStart(null);
        setX(0);
      }}
    >
      <div className="absolute inset-y-0 left-0 flex items-center pl-5 text-petal font-serif italic text-lg pointer-events-none">
        ✨ Reveal
      </div>
      <div
        className="relative px-5 py-6 bg-velvet border-r border-petal/30 flex items-center justify-between gap-3"
        style={{
          transform: `translateX(${x}px)`,
          transition: start == null ? "transform 220ms ease" : "none",
        }}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">Locked</p>
          <p className="font-serif italic text-lg text-candle truncate">{label}</p>
          <p className="text-[11px] text-candle-muted mt-1">Swipe right to reveal →</p>
        </div>
        <div className="text-2xl text-petal shrink-0 animate-pulse">→</div>
      </div>
    </div>
  );
}

function TruthOrDare({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const partnerId = session.host_id === me ? session.partner_id : session.host_id;
  const s = session.state ?? { count: 0, card: null, intensity: "playful", history: [], tally: { truth: 0, dare: 0, skipped: 0 }, bestOf: 10, answer: null, answeredBy: null, turn: null, revealed: false };
  const { loading, fetchCard } = useCardFetcher("truth-or-dare");
  const card = s.card as null | { type: "truth" | "dare"; text: string };
  const tally = s.tally ?? { truth: 0, dare: 0, skipped: 0 };
  const round = (s.count ?? 0) + 1;
  const bestOf: number = s.bestOf ?? 10;
  const matchDone = bestOf > 0 && (s.count ?? 0) >= bestOf;
  const [input, setInput] = useState("");
  const answer: string | null = s.answer ?? null;
  const answeredByMe = s.answeredBy === me;
  const turn: string = s.turn ?? session.host_id;
  const myTurn = turn === me;
  const revealed = !!s.revealed;

  async function pick(type: "truth" | "dare") {
    if (matchDone || !myTurn) return;
    const c = await fetchCard(s.intensity ?? "playful", type);
    const fallback = TRUTH_OR_DARE.find((x) => x.type === type) ?? TRUTH_OR_DARE[0];
    const chosen = c && c.type === type ? c : { type, text: c?.text ?? fallback.text };
    patch({ ...s, card: chosen, answer: null, answeredBy: null, revealed: false, turn });
  }

  function submitAnswer() {
    if (!input.trim() || !card) return;
    patch({ ...s, answer: input.trim(), answeredBy: me, revealed: false, turn });
    setInput("");
  }

  function revealAnswer() {
    if (!answer || revealed) return;
    patch({ ...s, revealed: true });
  }

  function completeCard() {
    if (!card) return;
    const history = [...(s.history ?? []), { ...card, answer: answer ?? null }].slice(-30);
    const nextTally = { ...tally, [card.type]: (tally[card.type] ?? 0) + 1 };
    // Whoever reveals + taps Done becomes the next picker — turns alternate.
    patch({
      ...s,
      count: (s.count ?? 0) + 1,
      card: null,
      history,
      tally: nextTally,
      answer: null,
      answeredBy: null,
      revealed: false,
      turn: me,
    });
    setInput("");
  }
  function skipCard() {
    if (!card) return;
    const history = [...(s.history ?? []), { ...card, answer: answer ?? null, skipped: true }].slice(-30);
    const nextTally = { ...tally, skipped: (tally.skipped ?? 0) + 1 };
    patch({
      ...s,
      count: (s.count ?? 0) + 1,
      card: null,
      history,
      tally: nextTally,
      answer: null,
      answeredBy: null,
      revealed: false,
      turn: me,
    });
    setInput("");
  }
  function rematch() {
    patch({
      ...s,
      count: 0,
      card: null,
      history: [],
      tally: { truth: 0, dare: 0, skipped: 0 },
      answer: null,
      answeredBy: null,
      revealed: false,
      turn: session.host_id,
    });
    setInput("");
  }

  const answerLabel = card?.type === "dare" ? "Proof / how it went" : "Your answer";
  const placeholder = card?.type === "dare" ? "Describe how you did it…" : "Type your honest answer…";

  return (
    <div>
      <MatchControls
        round={round}
        bestOf={bestOf}
        onBestOf={(n) => patch({ ...s, bestOf: n })}
        onRematch={rematch}
        disabled={loading}
      />
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        🎯 Truth {tally.truth} · 🔥 Dare {tally.dare} · ⏭ Skipped {tally.skipped ?? 0}
      </p>
      <p className="text-[11px] text-candle-muted mb-3 text-center">
        {matchDone ? "Match complete" : myTurn ? "Your turn ✨" : "Partner's turn…"}
      </p>

      {matchDone ? (
        <MatchComplete
          title={`${tally.truth + tally.dare} cards completed`}
          subtitle={`${tally.truth} truths · ${tally.dare} dares · ${tally.skipped ?? 0} skipped`}
          onRematch={rematch}
        />
      ) : !card ? (
        <div className="p-6 rounded-3xl border border-border bg-surface mb-5 min-h-[200px] flex flex-col items-center justify-center gap-4">
          <p className="font-serif text-2xl italic text-candle text-center">Truth or Dare?</p>
          <p className="text-xs text-candle-muted text-center">
            {myTurn ? `Pick to reveal your card · ${s.intensity ?? "playful"} mode` : "Waiting for your partner to pick…"}
          </p>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={() => pick("truth")}
              disabled={loading || !myTurn}
              className="flex-1 py-3.5 rounded-2xl bg-petal-soft border border-petal text-candle font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Sparkles className="size-4 animate-pulse" /> : "🎯"} Truth
            </button>
            <button
              onClick={() => pick("dare")}
              disabled={loading || !myTurn}
              className="flex-1 py-3.5 rounded-2xl bg-petal text-velvet font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Sparkles className="size-4 animate-pulse" /> : "🔥"} Dare
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="p-6 rounded-3xl border border-petal/40 bg-gradient-to-br from-petal-soft to-transparent mb-5 min-h-[180px] flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest text-petal">
              {card.type === "truth" ? "🎯 Truth" : "🔥 Dare"} · {s.intensity ?? "playful"}
            </p>
            <p className="font-serif text-2xl italic leading-snug text-candle">{card.text}</p>
            <p className="text-[10px] text-candle-muted">Card {round}{bestOf > 0 ? ` / ${bestOf}` : ""}</p>
          </div>

          {card.type === "dare" && myTurn && !answer && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Send it to your partner</p>
              <div className="grid grid-cols-3 gap-2">
                <Link
                  to="/app/chat/$peerId"
                  params={{ peerId: partnerId }}
                  className="rounded-2xl bg-surface border border-border py-3 text-xs text-candle flex flex-col items-center gap-1"
                >
                  <span className="text-lg">📸</span> Photo
                </Link>
                <Link
                  to="/app/chat/$peerId"
                  params={{ peerId: partnerId }}
                  className="rounded-2xl bg-surface border border-border py-3 text-xs text-candle flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🎤</span> Voice
                </Link>
                <Link
                  to="/app/chat/$peerId"
                  params={{ peerId: partnerId }}
                  className="rounded-2xl bg-surface border border-border py-3 text-xs text-candle flex flex-col items-center gap-1"
                >
                  <span className="text-lg">💬</span> Chat
                </Link>
              </div>
              <p className="text-[10px] text-candle-muted mt-2 text-center">Do the dare in chat, then come back and mark it done below.</p>
            </div>
          )}


          <div className="mb-4">
            {answer ? (
              revealed ? (
                <Bubble label={answeredByMe ? `${answerLabel} (you)` : `${answerLabel} · their reply`} text={answer} />
              ) : answeredByMe ? (
                <div className="p-4 rounded-2xl border border-border bg-surface text-center">
                  <p className="text-xs text-candle-muted">Answer locked in ✨ waiting for partner to tap Reveal.</p>
                </div>
              ) : (
                <button
                  onClick={revealAnswer}
                  className="w-full p-5 rounded-3xl border border-petal/40 bg-gradient-to-br from-petal-soft to-transparent text-left active:scale-[0.99] transition-transform"
                >
                  <p className="text-[10px] uppercase tracking-widest text-petal">Locked</p>
                  <p className="font-serif italic text-lg text-candle">{`${answerLabel} from partner`}</p>
                  <p className="text-[11px] text-candle-muted mt-1">Tap to reveal ✨</p>
                </button>
              )
            ) : myTurn ? (
              <>
                <p className="text-xs text-candle-muted mb-2">{answerLabel} — partner will tap to reveal it.</p>
                <Composer value={input} onChange={setInput} onSubmit={submitAnswer} placeholder={placeholder} />
              </>
            ) : (
              <div className="p-4 rounded-2xl border border-border bg-surface text-center">
                <p className="text-xs text-candle-muted">Waiting for partner's answer…</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={skipCard}
              disabled={loading || (!!answer && answeredByMe)}
              className="rounded-2xl bg-surface border border-border px-4 py-3.5 text-sm text-candle flex items-center gap-2 disabled:opacity-60"
            >
              <SkipForward className="size-4" /> Skip
            </button>
            <button
              onClick={completeCard}
              disabled={loading || !answer || !revealed || answeredByMe}
              className="flex-1 py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Sparkles className="size-4 animate-pulse" /> : "✓"}
              {!answer
                ? "Waiting for answer"
                : answeredByMe
                ? "Partner will reveal"
                : !revealed
                ? "Tap Reveal first"
                : "Done · my turn"}
            </button>
          </div>

        </>
      )}
      <p className="text-xs text-candle-muted text-center mt-3">Both phones flip together.</p>
      <HistoryStrip
        items={(s.history ?? []).map(
          (h: any) =>
            `${h.type === "truth" ? "🎯" : "🔥"} ${h.text}${h.answer ? ` → ${h.answer}` : h.skipped ? " (skipped)" : ""}`
        )}
      />
    </div>
  );
}

function PairPick({
  game,
  me,
  session,
  patch,
  fallback,
}: {
  game: "this-or-that" | "would-you-rather";
  me: string;
  session: Session;
  patch: (s: any) => void;
  fallback: [string, string][];
}) {
  const s = session.state ?? { count: 0, card: null, picks: {}, score: { matches: 0, total: 0 }, intensity: "playful" };
  const { loading, fetchCard } = useCardFetcher(game);
  const card = s.card ?? { a: fallback[s.count % fallback.length][0], b: fallback[s.count % fallback.length][1] };
  const myPick = s.picks?.[me];
  const otherId = session.host_id === me ? session.partner_id : session.host_id;
  const theirPick = s.picks?.[otherId];
  const bothPicked = myPick !== undefined && theirPick !== undefined;
  const match = bothPicked && myPick === theirPick;

  function pick(idx: 0 | 1) {
    if (myPick !== undefined) return;
    patch({ ...s, picks: { ...s.picks, [me]: idx } });
  }
  async function next() {
    const matches = (s.score?.matches ?? 0) + (match ? 1 : 0);
    const total = (s.score?.total ?? 0) + 1;
    const c = await fetchCard(s.intensity ?? "playful");
    const history = [...(s.history ?? []), card].slice(-20);
    patch({
      ...s,
      count: (s.count ?? 0) + 1,
      card: c,
      picks: {},
      score: { matches, total },
      history,
    });
  }
  async function skip() {
    if (myPick !== undefined || theirPick !== undefined) return;
    const c = await fetchCard(s.intensity ?? "playful");
    patch({ ...s, card: c });
  }

  useEffect(() => {
    if (!s.card && !loading) {
      fetchCard(s.intensity ?? "playful").then((c) => c && patch({ ...s, card: c }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bestOf: number = s.bestOf ?? 10;
  const round = (s.score?.total ?? 0) + 1;
  const matchDone = bestOf > 0 && (s.score?.total ?? 0) >= bestOf;
  function rematch() {
    patch({ ...s, count: 0, card: null, picks: {}, score: { matches: 0, total: 0 }, history: [] });
  }

  return (
    <div>
      <MatchControls
        round={round}
        bestOf={bestOf}
        onBestOf={(n) => patch({ ...s, bestOf: n })}
        onRematch={rematch}
        disabled={loading}
      />
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        Match score · {s.score?.matches ?? 0}/{s.score?.total ?? 0}
      </p>

      {matchDone ? (
        <MatchComplete
          title={`${s.score?.matches ?? 0} of ${s.score?.total ?? 0} matched`}
          subtitle={
            (s.score?.matches ?? 0) / Math.max(1, s.score?.total ?? 1) >= 0.6
              ? "Two hearts in sync 💞"
              : "Different tastes, same team 🫶"
          }
          onRematch={rematch}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[card.a, card.b].map((label, i) => {
              const selected = myPick === i;
              const theirs = theirPick === i;
              return (
                <button
                  key={i}
                  onClick={() => pick(i as 0 | 1)}
                  disabled={myPick !== undefined}
                  className={`aspect-square rounded-3xl border p-4 flex flex-col items-center justify-center text-center transition-all ${
                    selected ? "border-petal bg-petal-soft" : "border-border bg-surface"
                  } ${myPick !== undefined && !selected ? "opacity-50" : ""}`}
                >
                  <p className="font-serif italic text-lg leading-tight">{label}</p>
                  {bothPicked && theirs && (
                    <p className="text-[10px] uppercase tracking-widest text-petal mt-2">Their pick</p>
                  )}
                </button>
              );
            })}
          </div>
          {bothPicked && (
            <div className={`p-4 rounded-2xl border mb-4 text-center ${match ? "border-petal bg-petal-soft" : "border-border bg-surface"}`}>
              <p className="font-serif italic text-lg">{match ? "Match! 💞" : "Different tastes 🫶"}</p>
            </div>
          )}
          <div className="flex gap-2">
            {!bothPicked && myPick === undefined && theirPick === undefined && (
              <button
                onClick={skip}
                disabled={loading}
                className="rounded-2xl bg-surface border border-border px-4 py-3.5 text-sm text-candle flex items-center gap-2 disabled:opacity-60"
              >
                <SkipForward className="size-4" /> Skip
              </button>
            )}
            <button
              onClick={next}
              disabled={!bothPicked || loading}
              className="flex-1 py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
              {loading ? "Crafting…" : "Next round"}
            </button>
          </div>
          {myPick === undefined && !bothPicked && (
            <p className="text-xs text-candle-muted text-center mt-3">Tap your pick — wait for your panda.</p>
          )}
        </>
      )}
      <HistoryStrip items={(s.history ?? []).map((h: any) => `${h.a} vs ${h.b}`)} />
    </div>
  );
}

function NeverHaveIEver({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? { count: 0, card: null, picks: {}, tallies: { have: 0, havent: 0 }, intensity: "playful" };
  const { loading, fetchCard } = useCardFetcher("never-have-i-ever");
  const otherId = session.host_id === me ? session.partner_id : session.host_id;
  const myPick = s.picks?.[me];
  const theirPick = s.picks?.[otherId];
  const bothPicked = myPick !== undefined && theirPick !== undefined;

  useEffect(() => {
    if (!s.card && !loading) {
      fetchCard(s.intensity ?? "playful").then((c) => c && patch({ ...s, card: c }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(v: 0 | 1) {
    if (myPick !== undefined) return;
    patch({ ...s, picks: { ...s.picks, [me]: v } });
  }
  async function next() {
    const have = (s.tallies?.have ?? 0) + (myPick === 0 ? 1 : 0) + (theirPick === 0 ? 1 : 0);
    const havent = (s.tallies?.havent ?? 0) + (myPick === 1 ? 1 : 0) + (theirPick === 1 ? 1 : 0);
    const c = await fetchCard(s.intensity ?? "playful");
    const history = [...(s.history ?? []), s.card].filter(Boolean).slice(-20);
    patch({ ...s, count: (s.count ?? 0) + 1, card: c, picks: {}, tallies: { have, havent }, history });
  }
  async function skip() {
    if (myPick !== undefined || theirPick !== undefined) return;
    const c = await fetchCard(s.intensity ?? "playful");
    patch({ ...s, card: c });
  }

  const bestOf: number = s.bestOf ?? 10;
  const round = (s.count ?? 0) + 1;
  const matchDone = bestOf > 0 && (s.count ?? 0) >= bestOf;
  function rematch() {
    patch({ ...s, count: 0, card: null, picks: {}, tallies: { have: 0, havent: 0 }, history: [] });
  }

  return (
    <div>
      <MatchControls
        round={round}
        bestOf={bestOf}
        onBestOf={(n) => patch({ ...s, bestOf: n })}
        onRematch={rematch}
        disabled={loading}
      />
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        🫶 Have {s.tallies?.have ?? 0} · Haven't {s.tallies?.havent ?? 0}
      </p>

      {matchDone ? (
        <MatchComplete
          title={`${s.tallies?.have ?? 0} confessions · ${s.tallies?.havent ?? 0} nopes`}
          subtitle="Trade stories about the ones you both did 👀"
          onRematch={rematch}
        />
      ) : (
        <>
          <div className="p-6 rounded-3xl border border-border bg-surface mb-5 min-h-[180px] flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Never have I ever…</p>
            <p className="font-serif text-2xl italic leading-snug">
              {s.card?.text ?? (loading ? "Crafting…" : "…")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {["I have", "I haven't"].map((label, i) => {
              const selected = myPick === i;
              const theirs = theirPick === i;
              return (
                <button
                  key={i}
                  onClick={() => pick(i as 0 | 1)}
                  disabled={myPick !== undefined || !s.card}
                  className={`py-4 rounded-3xl border transition-all ${
                    selected ? "border-petal bg-petal-soft" : "border-border bg-surface"
                  } ${myPick !== undefined && !selected ? "opacity-50" : ""}`}
                >
                  <p className="font-serif italic text-lg">{label}</p>
                  {bothPicked && theirs && (
                    <p className="text-[10px] uppercase tracking-widest text-petal mt-1">Their pick</p>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            {!bothPicked && myPick === undefined && theirPick === undefined && (
              <button
                onClick={skip}
                disabled={loading || !s.card}
                className="rounded-2xl bg-surface border border-border px-4 py-3.5 text-sm text-candle flex items-center gap-2 disabled:opacity-60"
              >
                <SkipForward className="size-4" /> Skip
              </button>
            )}
            <button
              onClick={next}
              disabled={!bothPicked || loading}
              className="flex-1 py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
              {loading ? "Crafting…" : "Next"}
            </button>
          </div>
        </>
      )}
      <HistoryStrip items={(s.history ?? []).map((h: any) => h.text)} />
    </div>
  );
}

function GuessMe({
  me,
  partnerId,
  session,
  patch,
}: {
  me: string;
  partnerId: string;
  session: Session;
  patch: (s: any) => void;
}) {
  const s = session.state ?? { count: 0, card: null, answer: null, answeredBy: null, guess: null, revealed: false, intensity: "playful" };
  const { loading, fetchCard } = useCardFetcher("guess-me");
  const prompt = s.card?.text ?? GUESS_ME[s.count % GUESS_ME.length];
  const [input, setInput] = useState("");
  const iAnswered = s.answeredBy === me;
  const partnerAnswered = s.answeredBy === partnerId;
  const myTurnToGuess = s.answer && partnerAnswered && !s.revealed;

  useEffect(() => {
    if (!s.card && !loading) {
      fetchCard(s.intensity ?? "playful").then((c) => c && patch({ ...s, card: c }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitAnswer() {
    if (!input.trim()) return;
    patch({ ...s, answer: input.trim(), answeredBy: me, guess: null, revealed: false });
    setInput("");
  }
  function submitGuess() {
    if (!input.trim()) return;
    patch({ ...s, guess: input.trim(), revealed: true });
    setInput("");
  }
  async function next(verdictOverride?: "right" | "close" | "wrong" | null) {
    const tally = s.tally ?? { right: 0, close: 0, wrong: 0 };
    const nextTally = verdictOverride
      ? { ...tally, [verdictOverride]: (tally[verdictOverride] ?? 0) + 1 }
      : tally;
    const history = s.answer
      ? [...(s.history ?? []), { prompt, answer: s.answer, guess: s.guess ?? "—", verdict: verdictOverride ?? null }].slice(-20)
      : (s.history ?? []);
    const c = await fetchCard(s.intensity ?? "playful");
    patch({
      ...s,
      count: (s.count ?? 0) + 1,
      card: c,
      answer: null,
      answeredBy: null,
      guess: null,
      revealed: false,
      history,
      tally: nextTally,
    });
    setInput("");
  }

  const bestOf: number = s.bestOf ?? 10;
  const round = (s.count ?? 0) + 1;
  const matchDone = bestOf > 0 && (s.count ?? 0) >= bestOf;
  const tally = s.tally ?? { right: 0, close: 0, wrong: 0 };
  function rematch() {
    patch({
      ...s,
      count: 0,
      card: null,
      answer: null,
      answeredBy: null,
      guess: null,
      revealed: false,
      history: [],
      tally: { right: 0, close: 0, wrong: 0 },
    });
    setInput("");
  }

  return (
    <div>
      <MatchControls
        round={round}
        bestOf={bestOf}
        onBestOf={(n) => patch({ ...s, bestOf: n })}
        onRematch={rematch}
        disabled={loading}
      />
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        ✨ Right {tally.right} · 🌸 Close {tally.close} · 🫧 Off {tally.wrong}
      </p>

      {matchDone ? (
        <MatchComplete
          title={`${tally.right} spot-on · ${tally.close} close`}
          subtitle={
            tally.right >= tally.wrong ? "You know each other well 💞" : "So much still to learn about each other 🌙"
          }
          onRematch={rematch}
        />
      ) : (
        <>
          <div className="p-6 rounded-3xl border border-border bg-surface mb-5">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Prompt</p>
            <p className="font-serif text-xl italic">{prompt}</p>
          </div>

          {!s.answer ? (
            iAnswered ? (
              <p className="text-sm text-candle-muted text-center">Waiting on your panda…</p>
            ) : (
              <>
                <p className="text-xs text-candle-muted mb-2">Write your real answer — they'll try to guess.</p>
                <Composer value={input} onChange={setInput} onSubmit={submitAnswer} placeholder="My answer…" />
              </>
            )
          ) : myTurnToGuess ? (
            <>
              <p className="text-xs text-candle-muted mb-2">Guess what they wrote.</p>
              <Composer value={input} onChange={setInput} onSubmit={submitGuess} placeholder="My guess…" />
            </>
          ) : s.revealed ? (
            <div className="space-y-3">
              <Bubble label={iAnswered ? "Your answer" : "Their answer"} text={s.answer} />
              <Bubble label={iAnswered ? "Their guess" : "Your guess"} text={s.guess ?? "—"} />
              {iAnswered ? (
                <>
                  <p className="text-xs text-candle-muted text-center">How close was their guess?</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => next("right")}
                      disabled={loading}
                      className="py-3 rounded-2xl bg-petal text-velvet font-semibold text-sm disabled:opacity-60"
                    >
                      ✨ Spot on
                    </button>
                    <button
                      onClick={() => next("close")}
                      disabled={loading}
                      className="py-3 rounded-2xl bg-petal-soft border border-petal text-candle font-semibold text-sm disabled:opacity-60"
                    >
                      🌸 Close
                    </button>
                    <button
                      onClick={() => next("wrong")}
                      disabled={loading}
                      className="py-3 rounded-2xl bg-surface border border-border text-candle text-sm disabled:opacity-60"
                    >
                      🫧 Off
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-candle-muted text-center">Waiting for them to score your guess…</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-candle-muted text-center">Waiting on your panda's guess…</p>
          )}
        </>
      )}
      <HistoryStrip
        items={(s.history ?? []).map(
          (h: any) => `${h.verdict === "right" ? "✨" : h.verdict === "close" ? "🌸" : h.verdict === "wrong" ? "🫧" : "·"} ${h.prompt} → ${h.answer}`
        )}
      />
    </div>
  );
}


function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder={placeholder}
        className="flex-1 bg-velvet border border-border rounded-2xl px-4 py-3 text-candle"
      />
      <button
        onClick={onSubmit}
        className="size-12 rounded-2xl bg-petal text-velvet flex items-center justify-center"
      >
        <Send className="size-4" />
      </button>
    </div>
  );
}

function Bubble({ label, text }: { label: string; text: string }) {
  return (
    <div className="p-4 rounded-2xl border border-border bg-surface">
      <p className="text-[10px] uppercase tracking-widest text-petal mb-1">{label}</p>
      <p className="font-serif italic text-lg">{text}</p>
    </div>
  );
}

// ─────────────────────────── Two Truths & a Lie ───────────────────────────
function TwoTruthsLie({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? {
    count: 0, card: null, guesses: {}, revealed: false,
    score: {}, intensity: "playful", history: [], bestOf: 10,
  };
  const { loading, fetchCard } = useCardFetcher("two-truths-lie");
  const otherId = session.host_id === me ? session.partner_id : session.host_id;
  const card = s.card as null | { statements: string[]; lie: number; reveal: string };
  const myGuess = s.guesses?.[me];
  const theirGuess = s.guesses?.[otherId];
  const bothGuessed = myGuess !== undefined && theirGuess !== undefined;
  const revealed = !!s.revealed;

  useEffect(() => {
    if (!s.card && !loading) {
      fetchCard(s.intensity ?? "playful").then((c) => c && patch({ ...s, card: c }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bothGuessed && !revealed) patch({ ...s, revealed: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothGuessed]);

  function guess(i: number) {
    if (myGuess !== undefined || !card) return;
    patch({ ...s, guesses: { ...s.guesses, [me]: i } });
  }
  async function next() {
    const myPts = (s.score?.[me] ?? 0) + (myGuess === card?.lie ? 1 : 0);
    const theirPts = (s.score?.[otherId] ?? 0) + (theirGuess === card?.lie ? 1 : 0);
    const c = await fetchCard(s.intensity ?? "playful");
    const history = [...(s.history ?? []), card].filter(Boolean).slice(-20);
    patch({
      ...s,
      count: (s.count ?? 0) + 1,
      card: c,
      guesses: {},
      revealed: false,
      score: { [me]: myPts, [otherId]: theirPts },
      history,
    });
  }

  const bestOf: number = s.bestOf ?? 10;
  const round = (s.count ?? 0) + 1;
  const matchDone = bestOf > 0 && (s.count ?? 0) >= bestOf;
  function rematch() {
    patch({ ...s, count: 0, card: null, guesses: {}, revealed: false, score: {}, history: [] });
  }

  return (
    <div>
      <MatchControls round={round} bestOf={bestOf} onBestOf={(n) => patch({ ...s, bestOf: n })} onRematch={rematch} disabled={loading} />
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        🕵️ You {s.score?.[me] ?? 0} · Them {s.score?.[otherId] ?? 0}
      </p>

      {matchDone ? (
        <MatchComplete
          title={`You ${s.score?.[me] ?? 0} — Them ${s.score?.[otherId] ?? 0}`}
          subtitle={(s.score?.[me] ?? 0) === (s.score?.[otherId] ?? 0) ? "Perfectly tied 🤝" : "Well-detected 🔍"}
          onRematch={rematch}
        />
      ) : (
        <>
          <p className="text-xs text-candle-muted text-center mb-3">Two are true. One is a lie. Tap the fib.</p>
          <div className="flex flex-col gap-3 mb-4">
            {(card?.statements ?? ["…", "…", "…"]).map((line, i) => {
              const isLie = revealed && card?.lie === i;
              const isMine = myGuess === i;
              const isTheirs = theirGuess === i;
              return (
                <button
                  key={i}
                  onClick={() => guess(i)}
                  disabled={myGuess !== undefined || !card}
                  className={`text-left rounded-3xl border p-4 transition-all ${
                    revealed
                      ? isLie
                        ? "border-petal bg-petal-soft"
                        : "border-border bg-surface opacity-70"
                      : isMine
                        ? "border-petal bg-petal-soft"
                        : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-petal mt-1 shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <p className="font-serif italic text-lg leading-snug flex-1">{line}</p>
                  </div>
                  {revealed && (
                    <div className="flex gap-2 mt-2 text-[10px] uppercase tracking-widest">
                      {isLie && <span className="text-petal">← the lie</span>}
                      {isMine && <span className="text-candle-muted">your guess</span>}
                      {isTheirs && <span className="text-candle-muted">their guess</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {revealed && card?.reveal && (
            <div className="p-4 rounded-2xl border border-petal/40 bg-petal-soft/40 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-petal mb-1">The reveal</p>
              <p className="text-sm text-candle">{card.reveal}</p>
            </div>
          )}
          <button
            onClick={next}
            disabled={!revealed || loading}
            className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
            {loading ? "Crafting…" : bothGuessed ? "Next round" : "Waiting for panda…"}
          </button>
        </>
      )}
      <HistoryStrip items={(s.history ?? []).map((h: any) => h?.statements?.[h.lie] ?? "")} />
    </div>
  );
}

// ─────────────────────────── Hot Takes ───────────────────────────
function HotTakes({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? {
    count: 0, card: null, ratings: {}, alignment: { total: 0, sum: 0 },
    intensity: "playful", history: [], bestOf: 10,
  };
  const { loading, fetchCard } = useCardFetcher("hot-takes");
  const otherId = session.host_id === me ? session.partner_id : session.host_id;
  const card = s.card as null | { text: string; tag?: string };
  const myRating = s.ratings?.[me];
  const theirRating = s.ratings?.[otherId];
  const bothRated = myRating !== undefined && theirRating !== undefined;
  const gap = bothRated ? Math.abs(myRating - theirRating) : null;

  useEffect(() => {
    if (!s.card && !loading) fetchCard(s.intensity ?? "playful").then((c) => c && patch({ ...s, card: c }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rate(v: number) {
    if (myRating !== undefined) return;
    patch({ ...s, ratings: { ...s.ratings, [me]: v } });
  }
  async function next() {
    const g = gap ?? 0;
    const sum = (s.alignment?.sum ?? 0) + (4 - g); // 4=perfect, 0=opposite
    const total = (s.alignment?.total ?? 0) + 4;
    const c = await fetchCard(s.intensity ?? "playful");
    const history = [...(s.history ?? []), card].filter(Boolean).slice(-20);
    patch({ ...s, count: (s.count ?? 0) + 1, card: c, ratings: {}, alignment: { sum, total }, history });
  }

  const bestOf: number = s.bestOf ?? 10;
  const round = (s.count ?? 0) + 1;
  const matchDone = bestOf > 0 && (s.count ?? 0) >= bestOf;
  function rematch() {
    patch({ ...s, count: 0, card: null, ratings: {}, alignment: { total: 0, sum: 0 }, history: [] });
  }
  const alignPct = s.alignment?.total ? Math.round((s.alignment.sum / s.alignment.total) * 100) : 0;

  const LABELS = ["Hard disagree", "Meh no", "Neutral", "Kinda yes", "Hard agree"];

  return (
    <div>
      <MatchControls round={round} bestOf={bestOf} onBestOf={(n) => patch({ ...s, bestOf: n })} onRematch={rematch} disabled={loading} />
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        🔥 Alignment {alignPct}%
      </p>
      {matchDone ? (
        <MatchComplete
          title={`${alignPct}% in sync`}
          subtitle={alignPct >= 70 ? "Same brain, same heart 💞" : alignPct >= 40 ? "Healthy differences 🌿" : "Opposites do attract 🔥"}
          onRematch={rematch}
        />
      ) : (
        <>
          <div className="p-6 rounded-3xl border border-petal/40 bg-gradient-to-br from-petal-soft via-transparent to-transparent mb-5 min-h-[160px] flex flex-col justify-center">
            {card?.tag && (
              <p className="text-[10px] uppercase tracking-widest text-petal mb-2">🔥 {card.tag}</p>
            )}
            <p className="font-serif text-2xl italic leading-snug">
              {card?.text ?? (loading ? "Cooking a hot take…" : "…")}
            </p>
          </div>
          <div className="mb-4">
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {[1, 2, 3, 4, 5].map((v) => {
                const mine = myRating === v;
                const theirs = bothRated && theirRating === v;
                return (
                  <button
                    key={v}
                    onClick={() => rate(v)}
                    disabled={myRating !== undefined || !card}
                    className={`aspect-square rounded-2xl border text-lg font-serif italic transition-all ${
                      mine ? "border-petal bg-petal-soft" : "border-border bg-surface"
                    } ${myRating !== undefined && !mine ? "opacity-50" : ""}`}
                  >
                    {v}
                    {theirs && <div className="text-[8px] uppercase tracking-widest text-petal mt-0.5">theirs</div>}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-candle-muted">
              <span>{LABELS[0]}</span>
              <span>{LABELS[4]}</span>
            </div>
          </div>
          {bothRated && (
            <div className={`p-4 rounded-2xl border mb-4 text-center ${gap === 0 ? "border-petal bg-petal-soft" : gap! >= 3 ? "border-border bg-surface" : "border-border bg-surface"}`}>
              <p className="font-serif italic text-lg">
                {gap === 0 ? "Twinned brains 🧠💞" : gap === 1 ? "Close enough 🌿" : gap === 2 ? "Different lenses 👓" : "Wild disagreement 🔥"}
              </p>
              <p className="text-xs text-candle-muted mt-1">You: {myRating} · Them: {theirRating}</p>
            </div>
          )}
          <button
            onClick={next}
            disabled={!bothRated || loading}
            className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
            {loading ? "Cooking…" : bothRated ? "Next take" : "Waiting for panda…"}
          </button>
        </>
      )}
      <HistoryStrip items={(s.history ?? []).map((h: any) => h?.text ?? "")} />
    </div>
  );
}

// ─────────────────────────── Emoji Riddle ───────────────────────────
function EmojiRiddle({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? {
    count: 0, card: null, guesses: {}, hintShown: false, revealed: false,
    score: {}, intensity: "playful", history: [], bestOf: 10,
  };
  const { loading, fetchCard } = useCardFetcher("emoji-riddle");
  const otherId = session.host_id === me ? session.partner_id : session.host_id;
  const card = s.card as null | { emojis: string; answer: string; category: string; hint: string };
  const myGuess = (s.guesses?.[me] ?? "") as string;
  const theirGuess = (s.guesses?.[otherId] ?? "") as string;
  const bothGuessed = !!myGuess && !!theirGuess;
  const revealed = !!s.revealed;
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!s.card && !loading) fetchCard(s.intensity ?? "playful").then((c) => c && patch({ ...s, card: c }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setDraft(""); }, [s.card]);

  function normalize(v: string) {
    return v.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  }
  function isRight(v: string) {
    if (!card) return false;
    const a = normalize(card.answer);
    const b = normalize(v);
    return !!b && (a === b || a.includes(b) || b.includes(a));
  }

  function submitGuess() {
    if (!draft.trim() || myGuess) return;
    patch({ ...s, guesses: { ...s.guesses, [me]: draft.trim() } });
    setDraft("");
  }
  function reveal() {
    if (!card) return;
    const myPts = (s.score?.[me] ?? 0) + (isRight(myGuess) ? 1 : 0);
    const theirPts = (s.score?.[otherId] ?? 0) + (isRight(theirGuess) ? 1 : 0);
    patch({ ...s, revealed: true, score: { [me]: myPts, [otherId]: theirPts } });
  }
  async function next() {
    const c = await fetchCard(s.intensity ?? "playful");
    const history = [...(s.history ?? []), card].filter(Boolean).slice(-20);
    patch({ ...s, count: (s.count ?? 0) + 1, card: c, guesses: {}, revealed: false, hintShown: false, history });
  }

  const bestOf: number = s.bestOf ?? 10;
  const round = (s.count ?? 0) + 1;
  const matchDone = bestOf > 0 && (s.count ?? 0) >= bestOf;
  function rematch() {
    patch({ ...s, count: 0, card: null, guesses: {}, revealed: false, hintShown: false, score: {}, history: [] });
  }

  return (
    <div>
      <MatchControls round={round} bestOf={bestOf} onBestOf={(n) => patch({ ...s, bestOf: n })} onRematch={rematch} disabled={loading} />
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        🧩 You {s.score?.[me] ?? 0} · Them {s.score?.[otherId] ?? 0}
      </p>

      {matchDone ? (
        <MatchComplete
          title={`You ${s.score?.[me] ?? 0} — Them ${s.score?.[otherId] ?? 0}`}
          subtitle="Emoji whisperers 🧩"
          onRematch={rematch}
        />
      ) : (
        <>
          <div className="p-6 rounded-3xl border border-petal/40 bg-gradient-to-br from-petal-soft via-transparent to-transparent mb-5 min-h-[160px] flex flex-col items-center justify-center text-center">
            {card?.category && (
              <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Category · {card.category}</p>
            )}
            <p className="text-5xl leading-none tracking-widest mb-2">
              {card?.emojis ?? (loading ? "✨" : "…")}
            </p>
            {s.hintShown && card?.hint && (
              <p className="text-xs text-candle-muted italic mt-1">hint: {card.hint}</p>
            )}
          </div>

          {!revealed ? (
            <>
              <div className="flex gap-2 mb-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                  disabled={!!myGuess || !card}
                  placeholder={myGuess ? "Locked in ✓" : "Type your guess…"}
                  className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 text-candle placeholder:text-candle-muted disabled:opacity-60"
                />
                <button
                  onClick={submitGuess}
                  disabled={!draft.trim() || !!myGuess}
                  className="px-4 py-3 bg-petal text-velvet rounded-2xl font-semibold disabled:opacity-40"
                >
                  <Send className="size-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => patch({ ...s, hintShown: true })}
                  disabled={s.hintShown || !card}
                  className="rounded-2xl bg-surface border border-border px-4 py-3 text-sm text-candle disabled:opacity-40"
                >
                  💡 Hint
                </button>
                <button
                  onClick={reveal}
                  disabled={!bothGuessed}
                  className="flex-1 py-3 bg-petal text-velvet rounded-2xl font-semibold disabled:opacity-40"
                >
                  {bothGuessed ? "Reveal answer" : "Waiting for panda…"}
                </button>
              </div>
              {myGuess && !bothGuessed && (
                <p className="text-xs text-candle-muted text-center mt-3">Locked in. Waiting on your panda…</p>
              )}
            </>
          ) : (
            <>
              <div className="p-4 rounded-2xl border border-petal bg-petal-soft mb-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-petal mb-1">Answer</p>
                <p className="font-serif italic text-2xl">{card?.answer}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Bubble label={`You ${isRight(myGuess) ? "✓" : "✗"}`} text={myGuess || "—"} />
                <Bubble label={`Them ${isRight(theirGuess) ? "✓" : "✗"}`} text={theirGuess || "—"} />
              </div>
              <button
                onClick={next}
                disabled={loading}
                className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
                {loading ? "Crafting…" : "Next riddle"}
              </button>
            </>
          )}
        </>
      )}
      <HistoryStrip items={(s.history ?? []).map((h: any) => `${h?.emojis ?? ""} — ${h?.answer ?? ""}`)} />
    </div>
  );
}
