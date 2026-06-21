import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  GAMES,
  GameKind,
  TRUTH_OR_DARE,
  THIS_OR_THAT,
  WOULD_YOU_RATHER,
  GUESS_ME,
  checkWinner,
  TTTCell,
  RPS_CHOICES,
  RPS_EMOJI,
  RPSChoice,
  rpsWinner,
} from "@/lib/games";

const paramsSchema = z.object({
  game: z.enum([
    "truth-or-dare",
    "this-or-that",
    "would-you-rather",
    "guess-me",
    "tic-tac-toe",
    "rock-paper-scissors",
  ]),
});

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
        <PairPick me={me.id} session={session} patch={patch} options={THIS_OR_THAT} />
      ) : game === "would-you-rather" ? (
        <PairPick me={me.id} session={session} patch={patch} options={WOULD_YOU_RATHER} />
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
  if (game === "truth-or-dare") return { index: 0 };
  if (game === "this-or-that" || game === "would-you-rather")
    return { index: 0, picks: {} as Record<string, 0 | 1>, score: { matches: 0, total: 0 } };
  if (game === "tic-tac-toe")
    return { board: Array(9).fill(null), turn: "X", wins: { X: 0, O: 0, draws: 0 } };
  if (game === "rock-paper-scissors")
    return { picks: {} as Record<string, RPSChoice>, round: 1, score: {} as Record<string, number> };
  return { index: 0, answer: null as string | null, answeredBy: null as string | null, guess: null as string | null, revealed: false };
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

function TruthOrDare({ me, session, patch }: { me: string; session: Session; patch: (s: any) => void }) {
  const s = session.state ?? { index: 0 };
  const card = TRUTH_OR_DARE[s.index % TRUTH_OR_DARE.length];
  return (
    <div>
      <div className="p-6 rounded-3xl border border-border bg-surface mb-5 min-h-[200px] flex flex-col justify-between">
        <p className="text-[10px] uppercase tracking-widest text-petal">{card.type}</p>
        <p className="font-serif text-2xl italic leading-snug">{card.text}</p>
        <p className="text-[10px] text-candle-muted">Card {s.index + 1}</p>
      </div>
      <button
        onClick={() => patch({ index: s.index + 1 })}
        className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold flex items-center justify-center gap-2"
      >
        <RefreshCw className="size-4" /> Next card
      </button>
      <p className="text-xs text-candle-muted text-center mt-3">Both phones flip together.</p>
    </div>
  );
}

function PairPick({
  me,
  session,
  patch,
  options,
}: {
  me: string;
  session: Session;
  patch: (s: any) => void;
  options: [string, string][];
}) {
  const s = session.state ?? { index: 0, picks: {}, score: { matches: 0, total: 0 } };
  const [a, b] = options[s.index % options.length];
  const myPick = s.picks?.[me];
  const otherId = session.host_id === me ? session.partner_id : session.host_id;
  const theirPick = s.picks?.[otherId];
  const bothPicked = myPick !== undefined && theirPick !== undefined;
  const match = bothPicked && myPick === theirPick;

  function pick(idx: 0 | 1) {
    if (myPick !== undefined) return;
    patch({ ...s, picks: { ...s.picks, [me]: idx } });
  }
  function next() {
    const matches = (s.score?.matches ?? 0) + (match ? 1 : 0);
    const total = (s.score?.total ?? 0) + 1;
    patch({ index: s.index + 1, picks: {}, score: { matches, total } });
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-petal mb-2 text-center">
        Match score · {s.score?.matches ?? 0}/{s.score?.total ?? 0}
      </p>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[a, b].map((label, i) => {
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
              <p className="font-serif italic text-xl">{label}</p>
              {bothPicked && theirs && (
                <p className="text-[10px] uppercase tracking-widest text-petal mt-2">Their pick</p>
              )}
            </button>
          );
        })}
      </div>
      {bothPicked && (
        <div
          className={`p-4 rounded-2xl border mb-4 text-center ${
            match ? "border-petal bg-petal-soft" : "border-border bg-surface"
          }`}
        >
          <p className="font-serif italic text-lg">{match ? "Match! 💞" : "Different tastes 🫶"}</p>
        </div>
      )}
      <button
        onClick={next}
        disabled={!bothPicked}
        className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold disabled:opacity-40"
      >
        Next round
      </button>
      {!myPick && !bothPicked && (
        <p className="text-xs text-candle-muted text-center mt-3">Tap your pick — wait for your panda.</p>
      )}
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
  const s = session.state ?? { index: 0, answer: null, answeredBy: null, guess: null, revealed: false };
  const prompt = GUESS_ME[s.index % GUESS_ME.length];
  const [input, setInput] = useState("");
  const iAnswered = s.answeredBy === me;
  const partnerAnswered = s.answeredBy === partnerId;
  const myTurnToGuess = s.answer && partnerAnswered && !s.revealed;

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
  function next() {
    patch({ index: s.index + 1, answer: null, answeredBy: null, guess: null, revealed: false });
    setInput("");
  }

  return (
    <div>
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
          <button onClick={next} className="w-full py-3.5 bg-petal text-velvet rounded-2xl font-semibold">
            Next prompt
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
