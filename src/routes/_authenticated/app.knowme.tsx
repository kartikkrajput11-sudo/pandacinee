import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Lock, Sparkles, RotateCcw, Heart } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { pickQuestions, type KnowMeQuestion } from "@/lib/knowme";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/app/knowme")({
  component: KnowMePage,
  head: () => ({
    meta: [
      { title: "How Well Do You Know Me? — PandaCine" },
      { name: "description", content: "A pass-and-play quiz to see how deeply your panda knows you." },
    ],
  }),
});

type Phase = "intro" | "setter" | "handoff" | "guesser" | "result";

function KnowMePage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(8);
  const [seed, setSeed] = useState(() => Date.now());
  const questions = useMemo<KnowMeQuestion[]>(() => pickQuestions(count, seed), [count, seed]);

  const [answers, setAnswers] = useState<number[]>([]); // setter's truthful picks
  const [guesses, setGuesses] = useState<number[]>([]); // guesser's picks
  const [idx, setIdx] = useState(0);
  const [revealIdx, setRevealIdx] = useState<number | null>(null);

  const setterName = me?.display_name ?? "You";
  const guesserName = partner?.display_name ?? "your panda";

  function resetAll() {
    setPhase("intro");
    setAnswers([]);
    setGuesses([]);
    setIdx(0);
    setRevealIdx(null);
    setSeed(Date.now());
  }

  function startMatch() {
    setAnswers([]);
    setGuesses([]);
    setIdx(0);
    setRevealIdx(null);
    setPhase("setter");
  }

  function pickSetter(optIdx: number) {
    sfx.pop?.();
    const next = [...answers, optIdx];
    setAnswers(next);
    if (next.length >= questions.length) {
      setIdx(0);
      setPhase("handoff");
    } else {
      setIdx(next.length);
    }
  }

  function pickGuess(optIdx: number) {
    if (revealIdx === idx) return;
    const next = [...guesses];
    next[idx] = optIdx;
    setGuesses(next);
    setRevealIdx(idx);
    if (optIdx === answers[idx]) sfx.correct?.();
    else sfx.wrong?.();
  }

  function nextGuess() {
    if (idx + 1 >= questions.length) {
      setPhase("result");
    } else {
      setIdx(idx + 1);
      setRevealIdx(null);
    }
  }

  const score = guesses.reduce((acc, g, i) => (g === answers[i] ? acc + 1 : acc), 0);
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  // ---- Shared shell ----
  return (
    <div className="min-h-dvh bg-gradient-to-b from-velvet via-surface to-velvet">
      {/* Ambient blooms */}
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

        {phase === "intro" && (
          <Intro
            count={count}
            setCount={setCount}
            onStart={startMatch}
            setterName={setterName}
            guesserName={guesserName}
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
            questions={questions}
            answers={answers}
            guesses={guesses}
            setterName={setterName}
            guesserName={guesserName}
            onRematch={() => { setSeed(Date.now()); startMatch(); }}
            onExit={() => navigate({ to: "/app/play" })}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Phases ----------

function Intro({
  count, setCount, onStart, setterName, guesserName,
}: { count: number; setCount: (n: number) => void; onStart: () => void; setterName: string; guesserName: string }) {
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
          <span className="text-candle">{setterName}</span> answers truthfully in secret,
          then hands the phone to <span className="text-candle">{guesserName}</span> to guess each one.
        </p>

        <div className="mt-6 p-4 rounded-2xl bg-surface/60 border border-border">
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
          onClick={onStart}
          className="mt-6 w-full py-4 rounded-2xl bg-petal text-white font-serif italic text-lg shadow-[0_14px_36px_-10px_rgba(225,29,116,0.7)] hover:shadow-[0_18px_44px_-10px_rgba(225,29,116,0.85)] transition-shadow flex items-center justify-center gap-2"
        >
          <Sparkles className="size-4" /> Begin the test
        </button>
      </div>

      <p className="text-center text-[11px] text-candle-muted mt-4">
        Best played side-by-side. Nothing is stored — this stays between you two.
      </p>
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
          Hand the phone to <span className="text-candle">{guesserName}</span> — it's their turn to see how well they know you.
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
  answer: number; guess: number | undefined; revealed: boolean;
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

      {revealed && (
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
  score, total, pct, questions, answers, guesses, setterName, guesserName, onRematch, onExit,
}: {
  score: number; total: number; pct: number;
  questions: KnowMeQuestion[]; answers: number[]; guesses: number[];
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

        <div className="mt-6 flex gap-3 relative">
          <button
            onClick={onRematch}
            className="flex-1 py-3 rounded-2xl bg-petal text-white font-serif italic shadow-[0_10px_30px_-10px_rgba(225,29,116,0.7)] hover:shadow-[0_14px_36px_-10px_rgba(225,29,116,0.85)] transition-shadow"
          >
            Play again
          </button>
          <button
            onClick={onExit}
            className="flex-1 py-3 rounded-2xl border border-border bg-surface/60 text-candle font-serif italic hover:border-petal/40 transition-colors"
          >
            Back to games
          </button>
        </div>
      </div>

      {/* Detail scroll */}
      <div className="mt-6 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted px-1">The answers</p>
        {questions.map((q, i) => {
          const right = guesses[i] === answers[i];
          return (
            <div key={q.id} className="p-4 rounded-2xl border border-border bg-surface/60">
              <p className="text-sm text-candle-muted mb-2">{q.prompt}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-200">
                  {setterName}: {q.options[answers[i]]}
                </span>
                <span className={`px-2 py-1 rounded-full border ${
                  right
                    ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                    : "bg-rose-500/15 border-rose-400/40 text-rose-200"
                }`}>
                  {guesserName}: {q.options[guesses[i]] ?? "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
