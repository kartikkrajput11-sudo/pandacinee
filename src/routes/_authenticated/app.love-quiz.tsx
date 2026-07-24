import { createFileRoute, Link } from "@tanstack/react-router";
import { GameBackLink } from "@/components/games/GameBackLink";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Sparkles, Trophy, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { generateLoveQuiz } from "@/lib/games.functions";
import { gameSfx } from "@/lib/game-sfx";
import { GroupPlayersBar } from "@/components/games/GroupPlayersBar";
import { GameChat } from "@/components/games/GameChat";

export const Route = createFileRoute("/_authenticated/app/love-quiz")({
  component: LoveQuiz,
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
});

type Q = { q: string; options: string[]; answer: number };
type Phase = "spin" | "playing" | "reveal";
type State = {
  phase: Phase;
  questions: Q[];
  firstPlayer: string | null;
  currentPlayer: string | null;
  answers: Record<string, number[]>; // userId -> picks per question index
  spinSeed: number; // used to sync wheel animation
  createdAt: number;
};
type Session = { id: string; host_id: string; partner_id: string; game: string; state: State };

function emptyState(): State {
  return {
    phase: "spin",
    questions: [],
    firstPlayer: null,
    currentPlayer: null,
    answers: {},
    spinSeed: 0,
    createdAt: Date.now(),
  };
}

function LoveQuiz() {
  const { data } = useProfile();
  const me = data?.profile;
  const { matchId } = Route.useSearch();
  const { opponentId: matchOppId } = useMatchOpponent(matchId, me?.id);
  const partner = matchId
    ? (matchOppId ? { id: matchOppId, display_name: "Partner" } as { id: string; display_name?: string } : null)
    : data?.partner;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);

  // Load or create session
  useEffect(() => {
    if (!me || !partner) return;
    let active = true;
    (async () => {
      const { data: existing } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game", "love-quiz")
        .or(
          `and(host_id.eq.${me.id},partner_id.eq.${partner.id}),and(host_id.eq.${partner.id},partner_id.eq.${me.id})`
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing && active) {
        setSession(existing as unknown as Session);
        return;
      }
      const initial = emptyState();
      const { data: created, error } = await supabase
        .from("game_sessions")
        .insert({ host_id: me.id, partner_id: partner.id, game: "love-quiz", state: initial })
        .select("*")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (active) setSession(created as unknown as Session);
    })();
    return () => {
      active = false;
    };
  }, [me?.id, partner?.id]);

  // Realtime
  useEffect(() => {
    if (!session?.id) return;
    const ch = supabase
      .channel(`love-quiz-${session.id}`)
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

  async function patch(next: State) {
    if (!session) return;
    setSession({ ...session, state: next });
    const { error } = await supabase.from("game_sessions").update({ state: next }).eq("id", session.id);
    if (error) toast.error(error.message);
  }

  async function spinWheel() {
    if (!me || !partner || !session || spinning) return;
    gameSfx.spin();
    setSpinning(true);
    setLoading(true);
    try {
      // Per-couple localStorage pool of 50 quiz questions; serve 5 fresh each game,
      // auto-refill a new batch once the pool is exhausted.
      const poolKey = `love-quiz-pool:${session.host_id}:${session.partner_id}`;
      type Q = { q: string; options: string[]; answer: number };
      type Pool = { questions: Q[]; usedHashes: string[]; seed: number };
      const hashQ = (q: Q) => `${q.q}::${q.answer}`;
      let pool: Pool | null = null;
      try {
        const raw = localStorage.getItem(poolKey);
        if (raw) pool = JSON.parse(raw) as Pool;
      } catch { /* ignore */ }

      let unseen: Q[] = pool
        ? pool.questions.filter((q) => !pool!.usedHashes.includes(hashQ(q)))
        : [];

      if (!pool || unseen.length < 5) {
        const hints = [
          me?.display_name && `Player 1: ${me.display_name}`,
          partner?.display_name && `Player 2: ${partner.display_name}`,
          me?.favorite_emoji && `Favorite emoji: ${me.favorite_emoji}`,
          me?.bio && `Bio: ${me.bio}`,
        ]
          .filter(Boolean)
          .join(". ");
        const res = await generateLoveQuiz({ data: { hints: hints || undefined, count: 50 } });
        pool = { questions: res.quiz.questions as Q[], usedHashes: [], seed: res.seed };
        unseen = [...pool.questions];
      }

      const picked = [...unseen].sort(() => Math.random() - 0.5).slice(0, 5);
      pool.usedHashes = [...pool.usedHashes, ...picked.map(hashQ)];
      try { localStorage.setItem(poolKey, JSON.stringify(pool)); } catch { /* quota */ }

      const first = Math.random() < 0.5 ? session.host_id : session.partner_id;
      const seed = Math.floor(Math.random() * 1_000_000) + 1;
      // First broadcast spin seed so both phones animate together
      await patch({
        phase: "spin",
        questions: picked,
        firstPlayer: null,
        currentPlayer: null,
        answers: {},
        spinSeed: seed,
        createdAt: Date.now(),
      });
      // After spin animation, land on the winner
      setTimeout(() => {
        patch({
          phase: "playing",
          questions: picked,
          firstPlayer: first,
          currentPlayer: first,
          answers: {},
          spinSeed: seed,
          createdAt: Date.now(),
        });
        gameSfx.start();
        setSpinning(false);
      }, 2400);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't generate quiz");
      setSpinning(false);
    } finally {
      setLoading(false);
    }
  }


  // Auto-animate the spin on the non-initiating side when seed changes
  useEffect(() => {
    if (!session) return;
    if (session.state.phase === "spin" && session.state.spinSeed > 0 && !spinning) {
      setSpinning(true);
      const t = setTimeout(() => setSpinning(false), 2400);
      return () => clearTimeout(t);
    }
  }, [session?.state.phase, session?.state.spinSeed]);

  async function submitPick(i: number) {
    if (!me || !session) return;
    const s = session.state;
    if (s.phase !== "playing" || s.currentPlayer !== me.id) return;
    const mine = s.answers[me.id] ?? [];
    if (mine.length >= s.questions.length) return;
    const nextMine = [...mine, i];
    const answers = { ...s.answers, [me.id]: nextMine };

    // Did I finish?
    const iDone = nextMine.length >= s.questions.length;
    const otherId = me.id === session.host_id ? session.partner_id : session.host_id;
    const otherDone = (answers[otherId]?.length ?? 0) >= s.questions.length;

    let phase: Phase = s.phase;
    let currentPlayer: string | null = s.currentPlayer;
    if (iDone && otherDone) {
      phase = "reveal";
      currentPlayer = null;
      gameSfx.complete();
    } else if (iDone) {
      currentPlayer = otherId;
      gameSfx.pop();
    } else {
      gameSfx.pick();
    }
    await patch({ ...s, answers, phase, currentPlayer });
  }

  async function rematch() {
    await patch(emptyState());
  }

  if (!me) return null;

  const s = session?.state;
  const bothPresent = !!me && !!partner;

  return (
    <div className="pt-10 px-5 pb-10">
      {matchId && <GroupPlayersBar matchId={matchId} meId={me?.id} gameName="Love Quiz" />}
      <header className="flex items-center gap-3 mb-6">
        <GameBackLink className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </GameBackLink>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">AI · couple</p>
          <h1 className="font-serif text-2xl italic">Love Quiz</h1>
        </div>
      </header>

      {!partner ? (
        <p className="text-sm text-candle-muted">Pair with your partner to play the Love Quiz.</p>
      ) : !session || !s ? (
        <div className="rounded-3xl border border-border bg-surface p-8 text-center">
          <Sparkles className="size-6 text-petal mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-candle">Setting up your quiz…</p>
        </div>
      ) : s.phase === "spin" ? (
        <SpinIntro
          me={me}
          partner={partner}
          seed={s.spinSeed}
          spinning={spinning}
          loading={loading}
          onSpin={spinWheel}
        />
      ) : s.phase === "playing" ? (
        <Playing
          me={me}
          partner={partner}
          session={session}
          onPick={submitPick}
          bothPresent={bothPresent}
        />
      ) : (
        <Reveal me={me} partner={partner} session={session} onRematch={rematch} />
      )}
      {me && partner && (
        <GameChat
          roomKey={`lovequiz:${[me.id, partner.id].sort().join(":")}`}
          me={me}
          partnerName={partner.display_name}
          title="Whisper"
        />
      )}
    </div>
  );
}


function SpinIntro({
  me,
  partner,
  seed,
  spinning,
  loading,
  onSpin,
}: {
  me: { id: string; display_name?: string | null };
  partner: { id: string; display_name?: string | null };
  seed: number;
  spinning: boolean;
  loading: boolean;
  onSpin: () => void;
}) {
  const meName = me.display_name ?? "You";
  const partnerName = partner.display_name ?? "Partner";
  // A tiny CSS wheel that spins several turns based on seed
  const turns = 4 + (seed % 4);
  const finalDeg = (seed % 360) + turns * 360;

  return (
    <div className="rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft to-transparent p-6 text-center">
      <p className="text-[10px] uppercase tracking-widest text-petal mb-1">Round one</p>
      <p className="font-serif italic text-2xl text-candle mb-4">Who goes first?</p>

      <div className="relative mx-auto mb-6 size-56">
        {/* Pointer */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-petal" />
        <div
          className="size-56 rounded-full border-4 border-petal shadow-petal grid place-items-center overflow-hidden transition-transform duration-[2200ms] ease-out"
          style={{
            transform: `rotate(${spinning || seed > 0 ? finalDeg : 0}deg)`,
            background:
              "conic-gradient(from 0deg, hsl(var(--petal)/0.9) 0 50%, hsl(var(--petal-soft)) 50% 100%)",
          }}
        >
          <div className="absolute top-6 left-1/2 -translate-x-1/2 rotate-0 font-serif italic text-velvet text-sm max-w-[100px] leading-tight">
            {meName}
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rotate-180 font-serif italic text-candle text-sm max-w-[100px] leading-tight">
            <span className="inline-block rotate-180">{partnerName}</span>
          </div>
        </div>
      </div>

      <button
        onClick={onSpin}
        disabled={spinning || loading}
        className="inline-flex items-center gap-2 rounded-full bg-petal text-velvet px-6 py-3 text-sm font-semibold shadow-petal disabled:opacity-60"
      >
        {loading || spinning ? <Sparkles className="size-4 animate-pulse" /> : <RotateCw className="size-4" />}
        {loading ? "Crafting quiz…" : spinning ? "Spinning…" : seed > 0 ? "Spin again" : "Spin the wheel"}
      </button>
      <p className="text-xs text-candle-muted mt-3">Both phones stay in sync — wheel spins together.</p>
    </div>
  );
}

function Playing({
  me,
  partner,
  session,
  onPick,
  bothPresent,
}: {
  me: { id: string; display_name?: string | null };
  partner: { id: string; display_name?: string | null };
  session: Session;
  onPick: (i: number) => void;
  bothPresent: boolean;
}) {
  const s = session.state;
  const otherId = me.id === session.host_id ? session.partner_id : session.host_id;
  const myAnswers = s.answers[me.id] ?? [];
  const theirAnswers = s.answers[otherId] ?? [];
  const myTurn = s.currentPlayer === me.id;
  const currentIdx = myTurn ? myAnswers.length : theirAnswers.length;
  const q = s.questions[currentIdx];
  const total = s.questions.length;

  const meName = me.display_name ?? "You";
  const partnerName = partner.display_name ?? "Partner";
  const activeName = myTurn ? meName : partnerName;

  if (!q) {
    return <p className="text-sm text-candle-muted text-center">Loading question…</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3 text-xs text-candle-muted">
        <span>
          Q {currentIdx + 1} / {total}
        </span>
        <span className="flex items-center gap-1">
          <Trophy className="size-3 text-petal" /> {myAnswers.length + theirAnswers.length} / {total * 2}
        </span>
      </div>
      <div className="rounded-2xl bg-surface border border-border p-3 mb-3 flex items-center justify-between text-xs">
        <span className="text-candle-muted">Turn</span>
        <span className="font-serif italic text-candle">
          {myTurn ? `${activeName} (you)` : activeName}
        </span>
      </div>

      <div className="rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft to-transparent p-6 mb-4">
        <p className="font-serif italic text-2xl text-candle leading-snug">{q.q}</p>
      </div>

      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            disabled={!myTurn || !bothPresent}
            onClick={() => onPick(i)}
            className={`w-full text-left rounded-2xl border px-4 py-3.5 text-sm transition ${
              myTurn
                ? "border-border bg-surface text-candle hover:border-petal/40"
                : "border-border/50 bg-surface/60 text-candle-muted"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {!myTurn && (
        <p className="text-xs text-candle-muted text-center mt-4">
          Waiting on {partnerName} to answer… ({theirAnswers.length} / {total})
        </p>
      )}
    </>
  );
}

function Reveal({
  me,
  partner,
  session,
  onRematch,
}: {
  me: { id: string; display_name?: string | null };
  partner: { id: string; display_name?: string | null };
  session: Session;
  onRematch: () => void;
}) {
  const s = session.state;
  const otherId = me.id === session.host_id ? session.partner_id : session.host_id;
  const mine = s.answers[me.id] ?? [];
  const theirs = s.answers[otherId] ?? [];

  const myScore = useMemo(
    () => s.questions.reduce((acc, q, i) => acc + (mine[i] === q.answer ? 1 : 0), 0),
    [s.questions, mine]
  );
  const theirScore = useMemo(
    () => s.questions.reduce((acc, q, i) => acc + (theirs[i] === q.answer ? 1 : 0), 0),
    [s.questions, theirs]
  );
  const matches = useMemo(
    () => s.questions.reduce((acc, _q, i) => acc + (mine[i] === theirs[i] ? 1 : 0), 0),
    [s.questions, mine, theirs]
  );

  const meName = me.display_name ?? "You";
  const partnerName = partner.display_name ?? "Partner";
  const total = s.questions.length;
  const winner =
    myScore === theirScore ? "tie" : myScore > theirScore ? "me" : "them";

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft to-transparent p-6 text-center">
        <div className="text-6xl mb-2">
          {winner === "tie" ? "🤝" : winner === "me" ? "💖" : "🌸"}
        </div>
        <p className="font-serif italic text-2xl text-candle mb-1">
          {winner === "tie"
            ? "Perfectly tied"
            : winner === "me"
            ? `${meName} knows best`
            : `${partnerName} knows best`}
        </p>
        <p className="text-sm text-candle-muted mb-4">
          {matches} of {total} answers matched · shared vibe
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-[10px] uppercase tracking-widest text-petal">{meName}</p>
            <p className="font-serif italic text-2xl text-candle">
              {myScore} / {total}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-[10px] uppercase tracking-widest text-petal">{partnerName}</p>
            <p className="font-serif italic text-2xl text-candle">
              {theirScore} / {total}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {s.questions.map((q, i) => {
          const myPick = mine[i];
          const theirPick = theirs[i];
          return (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-[10px] uppercase tracking-widest text-petal mb-1">Q{i + 1}</p>
              <p className="font-serif italic text-base text-candle mb-3">{q.q}</p>
              <div className="space-y-1.5 text-xs">
                {q.options.map((opt, oi) => {
                  const isAnswer = oi === q.answer;
                  const mineHere = myPick === oi;
                  const theirsHere = theirPick === oi;
                  return (
                    <div
                      key={oi}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 border ${
                        isAnswer
                          ? "border-petal bg-petal-soft text-candle"
                          : "border-border bg-velvet/40 text-candle-muted"
                      }`}
                    >
                      <span>
                        {isAnswer ? "✓ " : ""}
                        {opt}
                      </span>
                      <span className="flex gap-1">
                        {mineHere && (
                          <span className="text-[10px] uppercase tracking-widest text-petal">
                            {meName}
                          </span>
                        )}
                        {theirsHere && (
                          <span className="text-[10px] uppercase tracking-widest text-petal">
                            {partnerName}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onRematch}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-petal text-velvet px-6 py-3 text-sm font-semibold shadow-petal"
      >
        <RotateCw className="size-4" /> New quiz · Spin again
      </button>
    </div>
  );
}
