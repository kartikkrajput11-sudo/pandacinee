import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Send, Sparkles } from "lucide-react";
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
    return { count: 0, card: null as null | { type: "truth" | "dare"; text: string }, intensity: "playful" as Intensity };
  if (game === "this-or-that" || game === "would-you-rather")
    return {
      count: 0,
      card: null as null | { a: string; b: string },
      picks: {} as Record<string, 0 | 1>,
      score: { matches: 0, total: 0 },
      intensity: "playful" as Intensity,
    };
  if (game === "never-have-i-ever")
    return {
      count: 0,
      card: null as null | { text: string },
      picks: {} as Record<string, 0 | 1>,
      tallies: { have: 0, havent: 0 },
      intensity: "playful" as Intensity,
    };
  if (game === "tic-tac-toe")
    return { board: Array(9).fill(null), turn: "X", wins: { X: 0, O: 0, draws: 0 } };
  if (game === "rock-paper-scissors")
    return { picks: {} as Record<string, RPSChoice>, round: 1, score: {} as Record<string, number> };
  return {
    count: 0,
    card: null as null | { text: string },
    answer: null as string | null,
    answeredBy: null as string | null,
    guess: null as string | null,
    revealed: false,
    intensity: "playful" as Intensity,
  };
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
  const s = session.state ?? { board: Array(9).fill(null), turn: "X", wins: { X: 0, O: 0, draws: 0 } };
  const board: TTTCell[] = s.board;
  const mySymbol = session.host_id === me ? "X" : "O";
  const winner = checkWinner(board);
  const myTurn = !winner && s.turn === mySymbol;

  function play(i: number) {
    if (!myTurn || board[i]) return;
    const next = [...board];
    next[i] = mySymbol;
    const w = checkWinner(next);
    const wins = { ...s.wins };
    if (w === "draw") wins.draws += 1;
    else if (w) wins[w] += 1;
    patch({ ...s, board: next, turn: mySymbol === "X" ? "O" : "X" });
    if (w) setTimeout(() => patch({ board: Array(9).fill(null), turn: w === "draw" ? s.turn : (w === "X" ? "O" : "X"), wins }), 1500);
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        You are {mySymbol} · X {s.wins?.X ?? 0} – O {s.wins?.O ?? 0} · draws {s.wins?.draws ?? 0}
      </p>
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
        {winner === "draw" ? "Draw 🤝 — new round…" :
          winner ? `${winner} wins 🎉 — new round…` :
          myTurn ? "Your move" : "Waiting on your panda…"}
      </p>
    </div>
  );
}

function RockPaperScissors({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? { picks: {}, round: 1, score: {} };
  const otherId = session.host_id === me ? session.partner_id : session.host_id;
  const myPick = s.picks?.[me] as RPSChoice | undefined;
  const theirPick = s.picks?.[otherId] as RPSChoice | undefined;
  const both = myPick && theirPick;
  const myScore = s.score?.[me] ?? 0;
  const theirScore = s.score?.[otherId] ?? 0;

  function pick(c: RPSChoice) {
    if (myPick) return;
    patch({ ...s, picks: { ...s.picks, [me]: c } });
  }
  function next() {
    if (!both) return;
    const w = rpsWinner(myPick!, theirPick!);
    const score = { ...(s.score ?? {}) };
    if (w === 0) score[me] = (score[me] ?? 0) + 1;
    else if (w === 1) score[otherId] = (score[otherId] ?? 0) + 1;
    patch({ picks: {}, round: (s.round ?? 1) + 1, score });
  }
  const result = both ? rpsWinner(myPick!, theirPick!) : null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        Round {s.round ?? 1} · You {myScore} – {theirScore} Them
      </p>
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
    </div>
  );
}

function useCardFetcher(kind: "truth-or-dare" | "would-you-rather" | "this-or-that" | "never-have-i-ever" | "guess-me") {
  const [loading, setLoading] = useState(false);
  async function fetchCard(intensity: Intensity): Promise<any | null> {
    setLoading(true);
    try {
      const res = await generateGameCard({ data: { kind, intensity } });
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

function TruthOrDare({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? { count: 0, card: null, intensity: "playful" };
  const { loading, fetchCard } = useCardFetcher("truth-or-dare");
  const card = s.card ?? TRUTH_OR_DARE[s.count % TRUTH_OR_DARE.length];

  async function next() {
    const c = await fetchCard(s.intensity ?? "playful");
    patch({ ...s, count: (s.count ?? 0) + 1, card: c ?? TRUTH_OR_DARE[(s.count + 1) % TRUTH_OR_DARE.length] });
  }

  return (
    <div>
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <div className="p-6 rounded-3xl border border-border bg-surface mb-5 min-h-[200px] flex flex-col justify-between">
        <p className="text-[10px] uppercase tracking-widest text-petal">{card.type}</p>
        <p className="font-serif text-2xl italic leading-snug">{card.text}</p>
        <p className="text-[10px] text-candle-muted">Card {(s.count ?? 0) + 1}</p>
      </div>
      <button
        onClick={next}
        disabled={loading}
        className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
        {loading ? "Crafting…" : "Next card"}
      </button>
      <p className="text-xs text-candle-muted text-center mt-3">Both phones flip together.</p>
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
    patch({
      ...s,
      count: (s.count ?? 0) + 1,
      card: c,
      picks: {},
      score: { matches, total },
    });
  }

  useEffect(() => {
    if (!s.card && !loading) {
      fetchCard(s.intensity ?? "playful").then((c) => c && patch({ ...s, card: c }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        Match score · {s.score?.matches ?? 0}/{s.score?.total ?? 0}
      </p>
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
      <button
        onClick={next}
        disabled={!bothPicked || loading}
        className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
        {loading ? "Crafting…" : "Next round"}
      </button>
      {myPick === undefined && !bothPicked && (
        <p className="text-xs text-candle-muted text-center mt-3">Tap your pick — wait for your panda.</p>
      )}
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
    patch({ ...s, count: (s.count ?? 0) + 1, card: c, picks: {}, tallies: { have, havent } });
  }

  return (
    <div>
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        🫶 Have {s.tallies?.have ?? 0} · Haven't {s.tallies?.havent ?? 0}
      </p>
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
      <button
        onClick={next}
        disabled={!bothPicked || loading}
        className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
        {loading ? "Crafting…" : "Next"}
      </button>
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
  async function next() {
    const c = await fetchCard(s.intensity ?? "playful");
    patch({ ...s, count: (s.count ?? 0) + 1, card: c, answer: null, answeredBy: null, guess: null, revealed: false });
    setInput("");
  }

  return (
    <div>
      <IntensityBar value={s.intensity ?? "playful"} onChange={(v) => patch({ ...s, intensity: v })} disabled={loading} />
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
          <Bubble label="Their answer" text={s.answer} />
          <Bubble label="Your guess" text={s.guess ?? "—"} />
          <button
            onClick={next}
            disabled={loading}
            className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Sparkles className="size-4 animate-pulse" /> : <RefreshCw className="size-4" />}
            {loading ? "Crafting…" : "Next prompt"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-candle-muted text-center">Waiting on your panda's guess…</p>
      )}
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
