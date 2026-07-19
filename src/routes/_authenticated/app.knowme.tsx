import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Lock, Sparkles, RotateCcw, Heart, Wifi, Users } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { pickQuestions, type KnowMeQuestion } from "@/lib/knowme";
import { sfxReaction, sfxPollVote, sfxKiss } from "@/lib/sfx";
import { supabase } from "@/integrations/supabase/client";
import { GameChat } from "@/components/games/GameChat";

export const Route = createFileRoute("/_authenticated/app/knowme")({
  component: KnowMePage,
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "How Well Do You Know Me? — PandaCine" },
      { name: "description", content: "A luxury couple quiz — play side-by-side or across any distance." },
    ],
  }),
});


type Mode = "local" | "online";
type Phase =
  | "intro"
  | "lobby"          // online only — pick who answers
  | "waiting"       // online — waiting for partner to pick / connect
  | "setter"        // I am setter, answering privately
  | "handoff"       // local only — hand phone over
  | "setter_wait"   // online setter, guesser is guessing
  | "guesser"       // I am guesser, picking
  | "guesser_wait"  // online guesser waiting for truth
  | "result";

type PeerMsg =
  | { t: "hello"; from: string }
  | { t: "start"; from: string; seed: number; count: number; setterId: string }
  | { t: "answers_done"; from: string }
  | { t: "guess"; from: string; idx: number; guess: number }
  | { t: "reveal"; from: string; idx: number; truth: number }
  | { t: "finish"; from: string; guesses: number[]; answers: number[] };

function KnowMePage() {
  const { data } = useProfile();
  const me = data?.profile;
  const { matchId } = Route.useSearch();
  const { opponentId: matchOppId } = useMatchOpponent(matchId, me?.id);
  const partner = matchId
    ? (matchOppId ? { id: matchOppId, display_name: "Partner" } as { id: string; display_name?: string } : null)
    : data?.partner;
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("local");
  useEffect(() => { if (matchId && partner) setMode("online"); }, [matchId, partner]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(8);
  const [seed, setSeed] = useState(() => Date.now());
  const questions = useMemo<KnowMeQuestion[]>(() => pickQuestions(count, seed), [count, seed]);


  const [answers, setAnswers] = useState<number[]>([]);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealIdx, setRevealIdx] = useState<number | null>(null);

  // Online role state
  const [setterId, setSetterId] = useState<string | null>(null);
  const iAmSetter = !!(me && setterId && me.id === setterId);
  const iAmGuesser = !!(me && setterId && me.id !== setterId);

  const setterName = iAmGuesser ? (partner?.display_name ?? "your panda") : (me?.display_name ?? "You");
  const guesserName = iAmGuesser ? (me?.display_name ?? "You") : (partner?.display_name ?? "your panda");

  // Realtime channel
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerOnlineRef = useRef(false);
  const [peerOnline, setPeerOnline] = useState(false);

  useEffect(() => {
    if (mode !== "online" || !me || !partner) return;
    const key = matchId ?? [me.id, partner.id].sort().join(":");
    const channel = supabase.channel(`knowme:${key}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    chanRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const has = Object.keys(state).some((k) => k === partner.id);
        peerOnlineRef.current = has;
        setPeerOnline(has);
      })
      .on("broadcast", { event: "msg" }, ({ payload }) => handlePeer(payload as PeerMsg))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
          send({ t: "hello", from: me.id });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, me?.id, partner?.id]);

  function send(msg: PeerMsg) {
    chanRef.current?.send({ type: "broadcast", event: "msg", payload: msg });
  }

  function handlePeer(msg: PeerMsg) {
    if (!me) return;
    if (msg.from === me.id) return;
    if (msg.t === "hello") {
      // Re-announce role if already set
      if (setterId) send({ t: "start", from: me.id, seed, count, setterId });
      return;
    }
    if (msg.t === "start") {
      setSeed(msg.seed);
      setCount(msg.count);
      setSetterId(msg.setterId);
      setAnswers([]);
      setGuesses([]);
      setIdx(0);
      setRevealIdx(null);
      // If I am setter, go answer; else wait
      setPhase(msg.setterId === me.id ? "setter" : "waiting");
      return;
    }
    if (msg.t === "answers_done") {
      // I'm the guesser — start guessing
      setIdx(0);
      setRevealIdx(null);
      setPhase("guesser");
      return;
    }
    if (msg.t === "guess") {
      // I'm setter — reveal truth for that idx
      setIdx(msg.idx);
      setGuesses((g) => {
        const n = [...g];
        n[msg.idx] = msg.guess;
        return n;
      });
      const truth = answersRef.current[msg.idx];
      if (typeof truth === "number") {
        send({ t: "reveal", from: me.id, idx: msg.idx, truth });
        if (msg.guess === truth) sfxKiss(); else sfxPollVote();
      }
      return;
    }
    if (msg.t === "reveal") {
      // I'm guesser — got the truth
      setAnswers((a) => {
        const n = [...a];
        n[msg.idx] = msg.truth;
        return n;
      });
      setRevealIdx(msg.idx);
      setPhase("guesser");
      const my = guessesRef.current[msg.idx];
      if (my === msg.truth) sfxKiss(); else sfxPollVote();
      return;
    }
    if (msg.t === "finish") {
      setGuesses(msg.guesses);
      setAnswers(msg.answers);
      setPhase("result");
      return;
    }
  }

  // Refs to read latest state inside channel handlers
  const answersRef = useRef<number[]>([]);
  const guessesRef = useRef<number[]>([]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { guessesRef.current = guesses; }, [guesses]);

  function resetAll() {
    setPhase("intro");
    setAnswers([]);
    setGuesses([]);
    setIdx(0);
    setRevealIdx(null);
    setSetterId(null);
    setSeed(Date.now());
  }

  function startLocal() {
    setAnswers([]);
    setGuesses([]);
    setIdx(0);
    setRevealIdx(null);
    setPhase("setter");
  }

  function startOnlineAsSetter() {
    if (!me) return;
    const newSeed = Date.now();
    setSeed(newSeed);
    setSetterId(me.id);
    setAnswers([]);
    setGuesses([]);
    setIdx(0);
    setRevealIdx(null);
    send({ t: "start", from: me.id, seed: newSeed, count, setterId: me.id });
    setPhase("setter");
  }

  function startOnlineAsGuesser() {
    if (!me || !partner) return;
    const newSeed = Date.now();
    setSeed(newSeed);
    setSetterId(partner.id);
    send({ t: "start", from: me.id, seed: newSeed, count, setterId: partner.id });
    setPhase("waiting");
  }

  // Setter picks — local or online
  function pickSetter(optIdx: number) {
    sfxReaction();
    const next = [...answers, optIdx];
    setAnswers(next);
    if (next.length >= questions.length) {
      setIdx(0);
      if (mode === "online" && me) {
        send({ t: "answers_done", from: me.id });
        setPhase("setter_wait");
      } else {
        setPhase("handoff");
      }
    } else {
      setIdx(next.length);
    }
  }

  // Guesser picks
  function pickGuess(optIdx: number) {
    if (revealIdx === idx) return;
    const next = [...guesses];
    next[idx] = optIdx;
    setGuesses(next);
    if (mode === "online" && me) {
      // Wait for setter to send reveal
      send({ t: "guess", from: me.id, idx, guess: optIdx });
      setPhase("guesser_wait");
    } else {
      setRevealIdx(idx);
      if (optIdx === answers[idx]) sfxKiss();
      else sfxPollVote();
    }
  }

  function nextGuess() {
    if (idx + 1 >= questions.length) {
      if (mode === "online" && me) {
        send({ t: "finish", from: me.id, guesses: guessesRef.current, answers: answersRef.current });
      }
      setPhase("result");
    } else {
      setIdx(idx + 1);
      setRevealIdx(null);
    }
  }

  const score = guesses.reduce((acc, g, i) => (g === answers[i] ? acc + 1 : acc), 0);
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-velvet via-surface to-velvet">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 size-72 rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(circle, oklch(0.72 0.18 15 / 0.55), transparent 70%)" }} />
        <div className="absolute -bottom-24 -right-10 size-80 rounded-full blur-3xl opacity-35"
             style={{ background: "radial-gradient(circle, oklch(0.82 0.14 68 / 0.5), transparent 70%)" }} />
      </div>

      <div className="relative pt-10 px-5 pb-16 max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <Link to="/app/play" className="text-candle-muted hover:text-candle transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.28em] text-petal">Couple quiz</p>
            <h1 className="font-serif text-2xl italic mt-0.5">How Well Do You Know Me?</h1>
          </div>
          <button
            onClick={resetAll}
            className="p-2 rounded-full bg-surface border border-border text-candle-muted hover:text-candle"
            aria-label="Reset"
          >
            <RotateCcw className="size-4" />
          </button>
        </header>

        {mode === "online" && phase !== "intro" && (
          <div className="mb-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest">
            <span className={`size-1.5 rounded-full ${peerOnline ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`} />
            <span className="text-candle-muted">
              {peerOnline ? `${partner?.display_name ?? "Partner"} is here` : `Waiting for ${partner?.display_name ?? "partner"}…`}
            </span>
          </div>
        )}

        {phase === "intro" && (
          <Intro
            count={count}
            setCount={setCount}
            mode={mode}
            setMode={setMode}
            hasPartner={!!partner}
            setterName={me?.display_name ?? "You"}
            guesserName={partner?.display_name ?? "your panda"}
            onStartLocal={startLocal}
            onEnterOnline={() => setPhase("lobby")}
          />
        )}

        {phase === "lobby" && (
          <Lobby
            partnerName={partner?.display_name ?? "your panda"}
            peerOnline={peerOnline}
            onIAnswer={startOnlineAsSetter}
            onTheyAnswer={startOnlineAsGuesser}
          />
        )}

        {phase === "waiting" && (
          <WaitingCard
            title={`${setterName} is answering in secret…`}
            body="Their answers stay sealed until you make each guess. Sit tight."
          />
        )}

        {phase === "setter_wait" && (
          <WaitingCard
            title={`${guesserName} is guessing now.`}
            body={`Round ${Math.min(idx + 1, questions.length)} of ${questions.length}. You'll see the verdict together.`}
            progress={{ idx, total: questions.length }}
          />
        )}

        {phase === "guesser_wait" && (
          <WaitingCard
            title="Sending your guess…"
            body="Revealing the truth."
            progress={{ idx, total: questions.length }}
          />
        )}

        {phase === "setter" && (
          <SetterPhase
            q={questions[idx]}
            idx={idx}
            total={questions.length}
            setterName={setterName}
            onPick={pickSetter}
          />
        )}

        {phase === "handoff" && (
          <Handoff
            setterName={setterName}
            guesserName={guesserName}
            onReady={() => setPhase("guesser")}
          />
        )}

        {phase === "guesser" && (
          <GuesserPhase
            q={questions[idx]}
            idx={idx}
            total={questions.length}
            guesserName={guesserName}
            setterName={setterName}
            answer={answers[idx]}
            guess={guesses[idx]}
            revealed={revealIdx === idx}
            onPick={pickGuess}
            onNext={nextGuess}
          />
        )}

        {phase === "result" && (
          <Result
            score={score}
            total={questions.length}
            pct={pct}
            setterName={setterName}
            guesserName={guesserName}
            onRematch={() => { setSeed(Date.now()); if (mode === "online") setPhase("lobby"); else startLocal(); }}
            onExit={() => navigate({ to: "/app/play" })}
          />
        )}
      </div>

      {mode === "online" && me && partner && (
        <GameChat
          roomKey={`knowme:${[me.id, partner.id].sort().join(":")}`}
          me={me}
          partnerName={partner.display_name}
          title="Whisper"
        />
      )}
    </div>
  );
}

// ---------- Phases ----------

function Intro({
  count, setCount, mode, setMode, hasPartner, setterName, guesserName, onStartLocal, onEnterOnline,
}: {
  count: number; setCount: (n: number) => void;
  mode: Mode; setMode: (m: Mode) => void;
  hasPartner: boolean;
  setterName: string; guesserName: string;
  onStartLocal: () => void; onEnterOnline: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="relative rounded-[2rem] border border-petal/25 bg-gradient-to-br from-surface via-velvet to-surface p-6 shadow-[0_30px_80px_-40px_rgba(225,29,116,0.55)]">
        <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-petal/60 to-transparent" />
        <div className="flex items-center justify-center mb-4">
          <div className="size-14 rounded-full grid place-items-center border border-petal/40 bg-petal/10">
            <Heart className="size-6 text-petal" />
          </div>
        </div>
        <h2 className="font-serif italic text-xl text-center">A private little test of us.</h2>
        <p className="text-sm text-candle-muted text-center mt-2 leading-relaxed">
          One answers truthfully in secret. The other tries to know them by heart.
        </p>

        {/* Mode toggle */}
        <div className="mt-6 grid grid-cols-2 gap-2 p-1 rounded-2xl bg-surface/60 border border-border">
          <button
            onClick={() => setMode("local")}
            className={`py-2.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              mode === "local" ? "bg-petal text-white shadow-[0_8px_20px_-8px_rgba(225,29,116,0.7)]" : "text-candle-muted"
            }`}
          >
            <Users className="size-3.5" /> Side-by-side
          </button>
          <button
            onClick={() => setMode("online")}
            disabled={!hasPartner}
            className={`py-2.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              mode === "online" ? "bg-petal text-white shadow-[0_8px_20px_-8px_rgba(225,29,116,0.7)]" : "text-candle-muted"
            } ${!hasPartner ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <Wifi className="size-3.5" /> Long distance
          </button>
        </div>
        {mode === "online" && !hasPartner && (
          <p className="text-[11px] text-rose-300/80 text-center mt-2">Pair with a partner first to play online.</p>
        )}

        <div className="mt-5 p-4 rounded-2xl bg-surface/60 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-candle-muted">Rounds</span>
            <span className="font-serif italic text-lg">{count}</span>
          </div>
          <input
            type="range"
            min={5}
            max={15}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="w-full accent-[color:var(--petal)]"
          />
          <div className="flex justify-between text-[10px] text-candle-muted mt-1">
            <span>5</span><span>15</span>
          </div>
        </div>

        <button
          onClick={mode === "online" ? onEnterOnline : onStartLocal}
          disabled={mode === "online" && !hasPartner}
          className="mt-6 w-full py-4 rounded-2xl bg-petal text-white font-serif italic text-lg shadow-[0_14px_36px_-10px_rgba(225,29,116,0.7)] hover:shadow-[0_18px_44px_-10px_rgba(225,29,116,0.85)] transition-shadow flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Sparkles className="size-4" /> {mode === "online" ? "Enter the room" : "Begin the test"}
        </button>
      </div>

      <p className="text-center text-[11px] text-candle-muted mt-4">
        {mode === "online"
          ? `${setterName} & ${guesserName} — synced live across any distance.`
          : "Best played side-by-side. Nothing is stored — this stays between you two."}
      </p>
    </div>
  );
}

function Lobby({
  partnerName, peerOnline, onIAnswer, onTheyAnswer,
}: { partnerName: string; peerOnline: boolean; onIAnswer: () => void; onTheyAnswer: () => void }) {
  return (
    <div className="animate-fade-in">
      <div className="relative rounded-[2rem] border border-petal/25 bg-gradient-to-br from-surface via-velvet to-surface p-6 shadow-[0_30px_80px_-40px_rgba(225,29,116,0.55)]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-petal text-center">Choose your role</p>
        <h2 className="font-serif italic text-xl text-center mt-2">Who answers first?</h2>
        <p className="text-sm text-candle-muted text-center mt-2">
          The other guesses each answer live. You'll swap next round.
        </p>

        <div className="grid gap-3 mt-6">
          <button
            onClick={onIAnswer}
            className="w-full p-5 rounded-2xl border border-petal/40 bg-petal/10 hover:bg-petal/15 text-left transition-all"
          >
            <p className="text-[10px] uppercase tracking-widest text-petal">Setter</p>
            <p className="font-serif italic text-lg mt-1">I'll answer about myself.</p>
            <p className="text-xs text-candle-muted mt-1">{partnerName} will try to guess me.</p>
          </button>
          <button
            onClick={onTheyAnswer}
            className="w-full p-5 rounded-2xl border border-border bg-surface/60 hover:bg-surface text-left transition-all"
          >
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">Guesser</p>
            <p className="font-serif italic text-lg mt-1">{partnerName} answers.</p>
            <p className="text-xs text-candle-muted mt-1">I'll guess how well I know them.</p>
          </button>
        </div>

        {!peerOnline && (
          <p className="text-[11px] text-candle-muted text-center mt-4">
            Waiting for {partnerName} to open the game… you can pick anyway; they'll join automatically.
          </p>
        )}
      </div>
    </div>
  );
}

function WaitingCard({ title, body, progress }: { title: string; body: string; progress?: { idx: number; total: number } }) {
  return (
    <div className="animate-fade-in">
      <div className="relative rounded-[2rem] border border-petal/25 bg-gradient-to-br from-surface via-velvet to-surface p-8 text-center shadow-[0_30px_80px_-40px_rgba(225,29,116,0.55)]">
        <div className="mx-auto size-16 rounded-full grid place-items-center border border-petal/40 bg-petal/10 mb-4 relative">
          <Sparkles className="size-6 text-petal" />
          <span className="absolute inset-0 rounded-full border border-petal/30 animate-ping" />
        </div>
        <h2 className="font-serif italic text-2xl">{title}</h2>
        <p className="text-sm text-candle-muted mt-3 leading-relaxed">{body}</p>
        {progress && (
          <div className="mt-6">
            <div className="h-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-petal to-[oklch(0.82_0.14_68)] transition-all duration-500"
                style={{ width: `${((progress.idx + 1) / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-candle-muted mt-2">
              Round {Math.min(progress.idx + 1, progress.total)} of {progress.total}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ idx, total }: { idx: number; total: number }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-candle-muted mb-2">
        <span>Round {idx + 1}</span>
        <span>{total} total</span>
      </div>
      <div className="h-1 rounded-full bg-border overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-petal to-[oklch(0.82_0.14_68)] transition-all duration-500"
          style={{ width: `${((idx + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function OptionCard({
  label, index, onClick, state,
}: {
  label: string; index: number; onClick: () => void;
  state: "idle" | "picked" | "correct" | "wrong" | "reveal-truth" | "dim";
}) {
  const letter = "ABCD"[index];
  const base = "relative w-full text-left p-4 rounded-2xl border transition-all duration-300 group overflow-hidden";
  const map: Record<typeof state, string> = {
    idle: "bg-surface/70 border-border hover:border-petal/60 hover:bg-surface",
    picked: "bg-petal/15 border-petal shadow-[0_10px_30px_-12px_rgba(225,29,116,0.7)]",
    correct: "bg-emerald-500/15 border-emerald-400/70 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.7)]",
    wrong: "bg-rose-500/15 border-rose-400/70",
    "reveal-truth": "bg-emerald-500/10 border-emerald-400/60",
    dim: "bg-surface/40 border-border/60 opacity-50",
  };
  return (
    <button type="button" onClick={onClick} className={`${base} ${map[state]} animate-fade-in`}>
      <div className="flex items-start gap-3">
        <span className={`shrink-0 size-8 rounded-full grid place-items-center font-serif italic text-sm border ${
          state === "correct" || state === "reveal-truth" ? "border-emerald-400/80 text-emerald-300"
          : state === "wrong" ? "border-rose-400/80 text-rose-300"
          : state === "picked" ? "border-petal text-petal"
          : "border-border text-candle-muted group-hover:border-petal/50 group-hover:text-candle"
        }`}>
          {state === "correct" || state === "reveal-truth" ? <Check className="size-4" /> : letter}
        </span>
        <span className="flex-1 text-sm text-candle leading-relaxed pt-1">{label}</span>
      </div>
      <span className="pointer-events-none absolute -inset-x-8 -top-8 h-16 rotate-[8deg] bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function SetterPhase({
  q, idx, total, setterName, onPick,
}: { q: KnowMeQuestion; idx: number; total: number; setterName: string; onPick: (i: number) => void }) {
  return (
    <div className="animate-fade-in">
      <ProgressBar idx={idx} total={total} />
      <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-petal">
        <Lock className="size-3" /> {setterName}'s truth · kept secret
      </div>
      <div className="rounded-[1.75rem] border border-petal/25 bg-gradient-to-br from-surface to-velvet p-6 mb-5 shadow-[0_20px_60px_-30px_rgba(225,29,116,0.5)]">
        <p className="font-serif italic text-xl leading-snug">{q.prompt}</p>
      </div>
      <div className="grid gap-3">
        {q.options.map((opt, i) => (
          <OptionCard key={i} label={opt} index={i} state="idle" onClick={() => onPick(i)} />
        ))}
      </div>
    </div>
  );
}

function Handoff({ setterName, guesserName, onReady }: { setterName: string; guesserName: string; onReady: () => void }) {
  return (
    <div className="animate-fade-in text-center">
      <div className="rounded-[2rem] border border-petal/25 bg-gradient-to-br from-surface via-velvet to-surface p-8 shadow-[0_30px_80px_-40px_rgba(225,29,116,0.55)]">
        <div className="mx-auto size-16 rounded-full grid place-items-center border border-petal/40 bg-petal/10 mb-4">
          <Sparkles className="size-6 text-petal" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Sealed</p>
        <h2 className="font-serif italic text-2xl mt-2">{setterName}'s answers are locked.</h2>
        <p className="text-sm text-candle-muted mt-3 leading-relaxed">
          Hand the phone to <span className="text-candle">{guesserName}</span> — it's their turn.
        </p>
        <button
          onClick={onReady}
          className="mt-6 w-full py-4 rounded-2xl bg-petal text-white font-serif italic text-lg shadow-[0_14px_36px_-10px_rgba(225,29,116,0.7)] hover:shadow-[0_18px_44px_-10px_rgba(225,29,116,0.85)] transition-shadow"
        >
          I'm ready — let me guess
        </button>
      </div>
    </div>
  );
}

function GuesserPhase({
  q, idx, total, guesserName, setterName, answer, guess, revealed, onPick, onNext,
}: {
  q: KnowMeQuestion; idx: number; total: number;
  guesserName: string; setterName: string;
  answer: number | undefined; guess: number | undefined; revealed: boolean;
  onPick: (i: number) => void; onNext: () => void;
}) {
  const isLast = idx + 1 >= total;
  const gotIt = revealed && guess === answer;
  return (
    <div className="animate-fade-in">
      <ProgressBar idx={idx} total={total} />
      <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-petal">
        <Heart className="size-3" /> {guesserName} guessing about {setterName}
      </div>
      <div className="rounded-[1.75rem] border border-petal/25 bg-gradient-to-br from-surface to-velvet p-6 mb-5 shadow-[0_20px_60px_-30px_rgba(225,29,116,0.5)]">
        <p className="font-serif italic text-xl leading-snug">{q.prompt}</p>
      </div>
      <div className="grid gap-3">
        {q.options.map((opt, i) => {
          let state: "idle" | "picked" | "correct" | "wrong" | "reveal-truth" | "dim" = "idle";
          if (revealed) {
            if (i === answer) state = "reveal-truth";
            else if (i === guess) state = "wrong";
            else state = "dim";
            if (i === answer && i === guess) state = "correct";
          } else if (i === guess) {
            state = "picked";
          }
          return (
            <OptionCard key={i} label={opt} index={i} state={state} onClick={() => onPick(i)} />
          );
        })}
      </div>

      {revealed && typeof answer === "number" && (
        <div className={`mt-6 p-4 rounded-2xl border animate-fade-in text-center ${
          gotIt ? "border-emerald-400/50 bg-emerald-500/10" : "border-rose-400/40 bg-rose-500/10"
        }`}>
          <p className="font-serif italic text-lg">
            {gotIt ? "You know them." : "Not quite — but now you do."}
          </p>
          <p className="text-xs text-candle-muted mt-1">
            {setterName} said <span className="text-candle">"{q.options[answer]}"</span>.
          </p>
          <button
            onClick={onNext}
            className="mt-4 w-full py-3 rounded-2xl bg-petal text-white font-serif italic shadow-[0_10px_30px_-10px_rgba(225,29,116,0.7)] hover:shadow-[0_14px_36px_-10px_rgba(225,29,116,0.85)] transition-shadow"
          >
            {isLast ? "See the verdict" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}

function verdictFor(pct: number, guesser: string, setter: string) {
  if (pct >= 90) return { title: "Soulbound.", body: `${guesser} reads ${setter} like a favorite book.` };
  if (pct >= 70) return { title: "Deeply known.", body: `${guesser} has been paying beautiful attention.` };
  if (pct >= 50) return { title: "Getting there.", body: `Some pages of ${setter} are still to be turned.` };
  if (pct >= 30) return { title: "A gentle start.", body: `Plenty of ${setter} left to discover.` };
  return { title: "Barely met.", body: `The story of ${setter} is only just opening.` };
}

function Result({
  score, total, pct, setterName, guesserName, onRematch, onExit,
}: {
  score: number; total: number; pct: number;
  setterName: string; guesserName: string;
  onRematch: () => void; onExit: () => void;
}) {
  const v = verdictFor(pct, guesserName, setterName);
  return (
    <div className="animate-fade-in">
      <div className="relative rounded-[2rem] border border-petal/30 bg-gradient-to-br from-surface via-velvet to-surface p-7 shadow-[0_30px_80px_-30px_rgba(225,29,116,0.6)] overflow-hidden text-center">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-64 rounded-full blur-3xl opacity-40 pointer-events-none"
             style={{ background: "radial-gradient(circle, oklch(0.82 0.14 68 / 0.55), transparent 70%)" }} />
        <p className="text-[10px] uppercase tracking-[0.32em] text-petal relative">The verdict</p>
        <div className="mt-4 relative">
          <div className="mx-auto w-40 h-40 rounded-full grid place-items-center border border-petal/40 bg-velvet/60 relative"
               style={{ boxShadow: "inset 0 0 30px rgba(225,29,116,0.15), 0 20px 60px -20px rgba(225,29,116,0.5)" }}>
            <div className="absolute inset-2 rounded-full border border-petal/20" />
            <div className="text-center">
              <p className="font-serif italic text-5xl bg-gradient-to-b from-[oklch(0.92_0.12_68)] to-petal bg-clip-text text-transparent">
                {score}<span className="text-candle-muted text-2xl">/{total}</span>
              </p>
              <p className="text-[10px] uppercase tracking-widest text-candle-muted mt-1">{pct}%</p>
            </div>
          </div>
        </div>
        <h2 className="font-serif italic text-2xl mt-6 relative">{v.title}</h2>
        <p className="text-sm text-candle-muted mt-2 relative">{v.body}</p>

        <div className="grid grid-cols-2 gap-3 mt-6 relative">
          <button
            onClick={onExit}
            className="py-3 rounded-2xl border border-border text-candle-muted hover:text-candle hover:border-petal/40 transition-all text-sm"
          >
            Exit
          </button>
          <button
            onClick={onRematch}
            className="py-3 rounded-2xl bg-petal text-white font-serif italic shadow-[0_10px_30px_-10px_rgba(225,29,116,0.7)] hover:shadow-[0_14px_36px_-10px_rgba(225,29,116,0.85)] transition-shadow text-sm"
          >
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
