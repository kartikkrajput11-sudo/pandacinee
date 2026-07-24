import { createFileRoute, Link } from "@tanstack/react-router";
import { GameBackLink } from "@/components/games/GameBackLink";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Brain, Sparkles, Trophy, RotateCw, Check, X as XIcon, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { generateCoupleTrivia } from "@/lib/games.functions";
import { gameSfx } from "@/lib/game-sfx";
import { AvatarImg } from "@/components/AvatarImg";
import { GameChat } from "@/components/games/GameChat";

export const Route = createFileRoute("/_authenticated/app/trivia")({
  head: () => ({
    meta: [
      { title: "Couple's Trivia · Pandacine" },
      { name: "description", content: "Race your partner through AI-crafted trivia. Speed and smarts win." },
      { property: "og:title", content: "Couple's Trivia · Pandacine" },
      { property: "og:description", content: "Race your partner through AI-crafted trivia. Speed and smarts win." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TriviaPage,
});

type Q = { q: string; options: string[]; answer: number; category: string };
type Phase = "lobby" | "playing" | "reveal" | "final";
type Pick = { choice: number; ms: number };
type State = {
  phase: Phase;
  questions: Q[];
  index: number;
  startedAt: number | null;
  picks: Record<string, Record<number, Pick>>; // userId -> qIndex -> pick
  scores: Record<string, number>;
  rounds: number;
  seed: number;
};
type Session = { id: string; host_id: string; partner_id: string; game: string; state: State };

const ROUND_MS = 20_000;
const MAX_SPEED_BONUS = 50;

const CAT_LABEL: Record<string, { emoji: string; name: string }> = {
  general: { emoji: "✨", name: "General" },
  movies: { emoji: "🎬", name: "Movies" },
  music: { emoji: "🎵", name: "Music" },
  love: { emoji: "💘", name: "Love" },
  science: { emoji: "🔬", name: "Science" },
  geography: { emoji: "🌍", name: "Geography" },
  food: { emoji: "🍜", name: "Food" },
  history: { emoji: "📜", name: "History" },
};

function emptyState(): State {
  return {
    phase: "lobby",
    questions: [],
    index: 0,
    startedAt: null,
    picks: {},
    scores: {},
    rounds: 8,
    seed: 0,
  };
}

function TriviaPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  // Load or create session
  useEffect(() => {
    if (!me || !partner) return;
    let active = true;
    (async () => {
      const { data: existing } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game", "couple-trivia")
        .or(`and(host_id.eq.${me.id},partner_id.eq.${partner.id}),and(host_id.eq.${partner.id},partner_id.eq.${me.id})`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing && active) { setSession(existing as unknown as Session); return; }
      const initial = emptyState();
      const { data: created, error } = await supabase
        .from("game_sessions")
        .insert({ host_id: me.id, partner_id: partner.id, game: "couple-trivia", state: initial })
        .select("*").single();
      if (error) { toast.error(error.message); return; }
      if (active) setSession(created as unknown as Session);
    })();
    return () => { active = false; };
  }, [me?.id, partner?.id]);

  // Realtime
  useEffect(() => {
    if (!session?.id) return;
    const ch = supabase
      .channel(`trivia-${session.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` },
        (payload: any) => setSession((s) => (s ? { ...s, state: payload.new.state } : s)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session?.id]);

  async function patch(next: State) {
    if (!session) return;
    setSession({ ...session, state: next });
    const { error } = await supabase.from("game_sessions").update({ state: next }).eq("id", session.id);
    if (error) toast.error(error.message);
  }

  async function startGame(rounds: number) {
    if (!session || loading) return;
    setLoading(true);
    try {
      gameSfx.spin();
      const poolKey = `trivia-pool:${session.host_id}:${session.partner_id}`;
      type Pool = { questions: Q[]; usedHashes: string[]; seed: number };
      const hashQ = (q: Q) => `${q.q}::${q.answer}`;
      let pool: Pool | null = null;
      try {
        const raw = localStorage.getItem(poolKey);
        if (raw) pool = JSON.parse(raw) as Pool;
      } catch { /* ignore */ }

      // Determine unseen questions in current pool
      let unseen: Q[] = pool
        ? pool.questions.filter((q) => !pool!.usedHashes.includes(hashQ(q)))
        : [];

      // If pool missing or not enough unseen, fetch a fresh batch of 50
      if (!pool || unseen.length < rounds) {
        const res = await generateCoupleTrivia({ data: { rounds: 50 } });
        pool = { questions: res.trivia.questions as Q[], usedHashes: [], seed: res.seed };
        unseen = [...pool.questions];
      }

      // Shuffle & take `rounds` distinct questions
      const shuffled = [...unseen].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, rounds);
      pool.usedHashes = [...pool.usedHashes, ...picked.map(hashQ)];
      try { localStorage.setItem(poolKey, JSON.stringify(pool)); } catch { /* ignore quota */ }

      await patch({
        ...emptyState(),
        phase: "playing",
        questions: picked,
        index: 0,
        startedAt: Date.now(),
        rounds,
        seed: pool.seed,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate trivia");
    } finally {
      setLoading(false);
    }
  }


  async function submitPick(choice: number) {
    if (!session || !me) return;
    const s = session.state;
    if (s.phase !== "playing" || !s.startedAt) return;
    if (s.picks?.[me.id]?.[s.index]) return; // already answered
    const ms = Math.max(0, Date.now() - s.startedAt);
    const nextPicks = {
      ...(s.picks || {}),
      [me.id]: { ...(s.picks?.[me.id] || {}), [s.index]: { choice, ms } },
    };
    const q = s.questions[s.index];
    const correct = choice === q.answer;
    const speedBonus = correct ? Math.max(0, Math.round(MAX_SPEED_BONUS * (1 - ms / ROUND_MS))) : 0;
    const inc = correct ? 100 + speedBonus : 0;
    const nextScores = { ...(s.scores || {}), [me.id]: (s.scores?.[me.id] || 0) + inc };
    if (correct) gameSfx.correct?.(); else gameSfx.wrong?.();
    const bothAnswered = !!nextPicks[session.host_id]?.[s.index] && !!nextPicks[session.partner_id]?.[s.index];
    const timeUp = ms >= ROUND_MS;
    if (bothAnswered || timeUp) {
      await patch({ ...s, picks: nextPicks, scores: nextScores, phase: "reveal" });
    } else {
      await patch({ ...s, picks: nextPicks, scores: nextScores });
    }
  }

  async function nextRound() {
    if (!session) return;
    const s = session.state;
    const isLast = s.index >= s.questions.length - 1;
    if (isLast) {
      await patch({ ...s, phase: "final" });
      return;
    }
    await patch({ ...s, phase: "playing", index: s.index + 1, startedAt: Date.now() });
  }

  async function playAgain() {
    if (!session) return;
    await patch(emptyState());
  }

  if (!me) return null;
  if (!partner) {
    return (
      <div className="pt-10 px-5">
        <GameBackLink className="text-candle-muted text-sm flex items-center gap-2 mb-4">
          <ArrowLeft className="size-4" /> Back
        </GameBackLink>
        <p className="text-sm text-candle-muted">Pair with your partner to play Couple's Trivia.</p>
      </div>
    );
  }
  if (!session) {
    return <div className="pt-10 px-5 text-candle-muted text-sm">Starting session…</div>;
  }

  const s = session.state;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <GameBackLink className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle hover:text-petal transition-colors">
            <ArrowLeft className="size-4" />
          </GameBackLink>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Game · AI</p>
            <h1 className="text-xl font-serif italic">🧠 Couple's Trivia</h1>
          </div>
          {s.phase !== "lobby" && (
            <Scoreboard s={s} me={me} partner={partner} hostId={session.host_id} partnerId={session.partner_id} />
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {s.phase === "lobby" && (
          <Lobby loading={loading} me={me} partner={partner} onStart={startGame} />
        )}
        {(s.phase === "playing" || s.phase === "reveal") && (
          <RoundView
            s={s} session={session} me={me} partner={partner}
            onPick={submitPick} onNext={nextRound}
          />
        )}
        {s.phase === "final" && (
          <FinalView s={s} me={me} partner={partner} hostId={session.host_id} partnerId={session.partner_id} onAgain={playAgain} />
        )}
      </main>
      {me && partner && (
        <GameChat
          roomKey={`trivia:${[me.id, partner.id].sort().join(":")}`}
          me={me}
          partnerName={partner.display_name}
          title="Trivia banter"
        />
      )}
    </div>
  );
}


function Lobby({ loading, me, partner, onStart }: { loading: boolean; me: any; partner: any; onStart: (r: number) => void }) {
  const [rounds, setRounds] = useState(10);
  return (
    <div className="rounded-3xl bg-gradient-to-br from-petal/10 via-surface to-surface border border-petal/30 p-8 text-center">
      <div className="size-16 rounded-2xl bg-petal/20 mx-auto flex items-center justify-center mb-4">
        <Brain className="size-8 text-petal" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted mb-1">Best of</p>
      <h2 className="text-3xl font-serif italic text-candle mb-2">A duel of wits</h2>
      <p className="text-sm text-candle-muted max-w-md mx-auto mb-6">
        Both of you get the same question. Right answer earns 100 points — plus a speed bonus. Fastest brain wins the round.
      </p>

      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="flex flex-col items-center">
          <AvatarImg src={me?.avatar_url} className="size-14 rounded-full border-2 border-petal/40" />
          <p className="text-xs mt-1 text-candle">{me?.display_name}</p>
        </div>
        <div className="text-2xl text-petal">vs</div>
        <div className="flex flex-col items-center">
          <AvatarImg src={partner?.avatar_url} className="size-14 rounded-full border-2 border-border" />
          <p className="text-xs mt-1 text-candle">{partner?.display_name}</p>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-2">Rounds</p>
      <div className="flex justify-center gap-2 mb-6">
        {[10, 20, 30, 50].map((r) => (
          <button key={r} onClick={() => setRounds(r)}
            className={`h-10 w-14 rounded-2xl border text-sm ${rounds === r ? "bg-petal/20 border-petal/60 text-candle" : "bg-surface-elevated border-border text-candle-muted"}`}>
            {r}
          </button>
        ))}
      </div>


      <button
        onClick={() => onStart(rounds)}
        disabled={loading}
        className="h-12 px-8 rounded-full bg-petal text-white font-medium hover:bg-petal/90 disabled:opacity-60 inline-flex items-center gap-2"
      >
        {loading ? <RotateCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {loading ? "Crafting questions…" : "Start the duel"}
      </button>
      <p className="text-xs text-candle-muted mt-3">Either of you can start — the other joins live.</p>
    </div>
  );
}

function Scoreboard({ s, me, partner, hostId, partnerId }: { s: State; me: any; partner: any; hostId: string; partnerId: string }) {
  const meIsHost = me.id === hostId;
  const myScore = s.scores?.[me.id] || 0;
  const pScore = s.scores?.[meIsHost ? partnerId : hostId] || 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-petal/15 border border-petal/40">
        <AvatarImg src={me?.avatar_url} className="size-5 rounded-full" />
        <span className="font-serif italic text-candle">{myScore}</span>
      </div>
      <span className="text-candle-muted">·</span>
      <div className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-surface border border-border">
        <AvatarImg src={partner?.avatar_url} className="size-5 rounded-full" />
        <span className="font-serif italic text-candle">{pScore}</span>
      </div>
    </div>
  );
}

function RoundView({
  s, session, me, partner, onPick, onNext,
}: { s: State; session: Session; me: any; partner: any; onPick: (c: number) => void; onNext: () => void }) {
  const q = s.questions[s.index];
  const myPick = s.picks?.[me.id]?.[s.index];
  const partnerId = me.id === session.host_id ? session.partner_id : session.host_id;
  const partnerPick = s.picks?.[partnerId]?.[s.index];
  const isReveal = s.phase === "reveal";
  const cat = CAT_LABEL[q?.category] || CAT_LABEL.general;

  // Timer
  const [remaining, setRemaining] = useState(ROUND_MS);
  useEffect(() => {
    if (!s.startedAt || isReveal) { setRemaining(ROUND_MS); return; }
    const tick = () => setRemaining(Math.max(0, ROUND_MS - (Date.now() - (s.startedAt || 0))));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [s.startedAt, s.index, isReveal]);

  // Auto reveal on timeout (only one client needs to; use host)
  const firedRef = useRef(false);
  useEffect(() => { firedRef.current = false; }, [s.index]);
  useEffect(() => {
    if (isReveal || firedRef.current) return;
    if (remaining > 0) return;
    if (me.id !== session.host_id) return;
    firedRef.current = true;
    (async () => {
      const { error } = await supabase.from("game_sessions").update({ state: { ...s, phase: "reveal" } }).eq("id", session.id);
      if (error) toast.error(error.message);
    })();
  }, [remaining, isReveal, me.id, session.host_id, session.id, s]);

  if (!q) return null;
  const pctLeft = Math.round((remaining / ROUND_MS) * 100);

  return (
    <div>
      {/* Meta */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Round</span>
          <span className="font-serif italic text-candle">{s.index + 1} <span className="text-candle-muted">/ {s.questions.length}</span></span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.25em] text-petal">{cat.emoji} {cat.name}</span>
      </div>

      {/* Timer bar */}
      <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-5 border border-border">
        <div
          className={`h-full transition-[width] duration-100 ${pctLeft < 25 ? "bg-red-500" : pctLeft < 50 ? "bg-amber-400" : "bg-petal"}`}
          style={{ width: `${pctLeft}%` }}
        />
      </div>

      {/* Question card */}
      <div className="rounded-3xl bg-gradient-to-br from-petal/10 via-surface to-surface border border-petal/30 p-6 mb-5">
        <h2 className="text-2xl font-serif italic text-candle leading-snug text-center">{q.q}</h2>
      </div>

      {/* Options */}
      <div className="grid gap-2.5">
        {q.options.map((opt, i) => {
          const chosenByMe = myPick?.choice === i;
          const chosenByPartner = partnerPick?.choice === i;
          const isCorrect = i === q.answer;
          const showCorrect = isReveal && isCorrect;
          const showWrong = isReveal && chosenByMe && !isCorrect;
          return (
            <button
              key={i}
              onClick={() => !isReveal && !myPick && onPick(i)}
              disabled={isReveal || !!myPick || remaining <= 0}
              className={`relative w-full text-left px-5 py-4 rounded-2xl border transition-all flex items-center gap-3
                ${showCorrect ? "bg-green-500/15 border-green-500/60 text-candle"
                  : showWrong ? "bg-red-500/15 border-red-500/60 text-candle"
                  : chosenByMe ? "bg-petal/15 border-petal/50 text-candle"
                  : "bg-surface border-border text-candle hover:border-petal/40"}
                ${isReveal || myPick ? "cursor-default" : "hover:-translate-y-0.5"}`}
            >
              <span className={`size-7 shrink-0 rounded-full flex items-center justify-center text-xs font-medium border
                ${showCorrect ? "bg-green-500/30 border-green-500/60" : showWrong ? "bg-red-500/30 border-red-500/60" : "bg-surface-elevated border-border"}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {isReveal && isCorrect && <Check className="size-4 text-green-500" />}
              {isReveal && chosenByMe && !isCorrect && <XIcon className="size-4 text-red-500" />}
              {chosenByPartner && (
                <span title={partner?.display_name} className="ml-1">
                  <AvatarImg src={partner?.avatar_url} className="size-5 rounded-full ring-1 ring-border" />
                </span>
              )}
              {chosenByMe && !chosenByPartner && (
                <span title={me?.display_name} className="ml-1">
                  <AvatarImg src={me?.avatar_url} className="size-5 rounded-full ring-1 ring-petal/60" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Waiting / reveal footer */}
      <div className="mt-5 text-center">
        {!isReveal && myPick && !partnerPick && (
          <p className="text-xs text-candle-muted animate-pulse">Waiting for {partner?.display_name}…</p>
        )}
        {!isReveal && !myPick && (
          <p className="text-xs text-candle-muted">Tap the answer — faster is worth more.</p>
        )}
        {isReveal && (
          <div className="flex flex-col items-center gap-3">
            <PickBadge label="You" pick={myPick} q={q} />
            <PickBadge label={partner?.display_name} pick={partnerPick} q={q} />
            <button onClick={onNext} className="mt-2 h-11 px-6 rounded-full bg-petal text-white font-medium hover:bg-petal/90">
              {s.index >= s.questions.length - 1 ? "See results" : "Next round"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PickBadge({ label, pick, q }: { label: string; pick?: Pick; q: Q }) {
  if (!pick) return <p className="text-xs text-candle-muted">{label}: no answer</p>;
  const correct = pick.choice === q.answer;
  const bonus = correct ? Math.max(0, Math.round(MAX_SPEED_BONUS * (1 - pick.ms / ROUND_MS))) : 0;
  return (
    <p className={`text-xs flex items-center gap-1.5 ${correct ? "text-green-500" : "text-red-400"}`}>
      {correct ? <Check className="size-3" /> : <XIcon className="size-3" />}
      <span className="text-candle-muted">{label}:</span>
      {correct ? `+${100 + bonus}` : "0"}
      {correct && bonus > 0 && <><Zap className="size-3 text-amber-400" /><span className="text-amber-400">+{bonus} speed</span></>}
      <span className="text-candle-muted">· {(pick.ms / 1000).toFixed(1)}s</span>
    </p>
  );
}

function FinalView({ s, me, partner, hostId, partnerId, onAgain }: {
  s: State; me: any; partner: any; hostId: string; partnerId: string; onAgain: () => void;
}) {
  const meIsHost = me.id === hostId;
  const myScore = s.scores?.[me.id] || 0;
  const pScore = s.scores?.[meIsHost ? partnerId : hostId] || 0;
  const iWon = myScore > pScore;
  const tie = myScore === pScore;
  const mine = useMemo(() => Object.entries(s.picks?.[me.id] || {}).filter(([i, p]) => (p as Pick).choice === s.questions[+i]?.answer).length, [s, me.id]);
  const total = s.questions.length;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-petal/15 via-surface to-surface border border-petal/40 p-8 text-center">
      <div className="size-16 rounded-2xl bg-petal/20 mx-auto flex items-center justify-center mb-4">
        <Trophy className="size-8 text-petal" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted mb-1">Curtain call</p>
      <h2 className="text-4xl font-serif italic text-candle mb-2">
        {tie ? "A tie" : iWon ? "You win 🎉" : `${partner?.display_name} wins`}
      </h2>
      <p className="text-sm text-candle-muted mb-6">You got {mine} of {total} right.</p>

      <div className="flex items-center justify-center gap-6 mb-6">
        <div className="flex flex-col items-center">
          <AvatarImg src={me?.avatar_url} className={`size-16 rounded-full border-2 ${iWon ? "border-petal ring-4 ring-petal/20" : "border-border"}`} />
          <p className="text-xs mt-1 text-candle">{me?.display_name}</p>
          <p className="font-serif italic text-2xl text-candle">{myScore}</p>
        </div>
        <div className="text-xl text-candle-muted">·</div>
        <div className="flex flex-col items-center">
          <AvatarImg src={partner?.avatar_url} className={`size-16 rounded-full border-2 ${!iWon && !tie ? "border-petal ring-4 ring-petal/20" : "border-border"}`} />
          <p className="text-xs mt-1 text-candle">{partner?.display_name}</p>
          <p className="font-serif italic text-2xl text-candle">{pScore}</p>
        </div>
      </div>

      <button onClick={onAgain} className="h-12 px-8 rounded-full bg-petal text-white font-medium hover:bg-petal/90 inline-flex items-center gap-2">
        <RotateCw className="size-4" /> Rematch
      </button>
    </div>
  );
}
