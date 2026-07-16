import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Send, Sparkles, Palette, HeartHandshake, Timer, Check } from "lucide-react";

// Normalize for locked-chat matching: lowercase, strip punctuation, collapse whitespace.
// Capital letters and punctuation are forgiven — only the sequence of words must match.
function normalizeWords(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { uploadChatMedia } from "@/lib/chat";
import { VoiceRecorder } from "./VoiceRecorder";
import { typeMeta, type PunishmentLock } from "@/lib/punishment";
import { generateLoveQuiz } from "@/lib/games.functions";

const PLEAS = [
  "Please, my love… have mercy 💌",
  "I'll be so good — one chance? 🥺",
  "I miss you already 💔",
  "One kiss to soften your heart? 💋",
];

type Props = {
  lock: PunishmentLock;
  meId: string;
  partnerId: string;
  partnerName: string;
  onIncrement: (lockId: string, current: number, next: number) => Promise<PunishmentLock | null>;
  onComplete: (lockId: string) => Promise<void>;
};

export function PunishmentLockOverlay({
  lock,
  meId,
  partnerId,
  partnerName,
  onIncrement,
  onComplete,
}: Props) {
  const meta = typeMeta(lock.type);
  const [celebrate, setCelebrate] = useState(false);
  const [entry, setEntry] = useState("");
  const seen = useRef<Set<string>>(new Set());

  // Countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remainingMs = lock.expires_at ? new Date(lock.expires_at).getTime() - now : null;
  const remainingLabel = useMemo(() => {
    if (remainingMs == null) return null;
    if (remainingMs <= 0) return "expiring…";
    const s = Math.floor(remainingMs / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }, [remainingMs]);

  const totalMs = lock.max_duration_seconds ? lock.max_duration_seconds * 1000 : null;
  const timePct = totalMs && remainingMs != null
    ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))
    : null;

  const [pleaCooldown, setPleaCooldown] = useState(0);
  useEffect(() => {
    if (pleaCooldown <= 0) return;
    const t = window.setTimeout(() => setPleaCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [pleaCooldown]);

  async function sendPlea() {
    if (pleaCooldown > 0) return;
    const msg = PLEAS[Math.floor(Math.random() * PLEAS.length)];
    try {
      await supabase.from("messages").insert({
        sender_id: meId,
        receiver_id: partnerId,
        content: msg,
        type: "text" as never,
      });
      toast.success("Plea sent 💌");
      setPleaCooldown(30);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
    }
  }

  function copyPrompt() {
    navigator.clipboard.writeText(lock.prompt).then(
      () => toast.success("Prompt copied"),
      () => toast.error("Copy failed"),
    );
  }

  async function celebrateAndClose() {
    setCelebrate(true);
    await onComplete(lock.id);
    toast.success("Chat unlocked successfully 🎉");
  }

  async function bump() {
    const next = Math.min(lock.progress + 1, lock.required_count);
    const row = await onIncrement(lock.id, lock.progress, next);
    if (!row) {
      // stale — realtime will refresh
      return;
    }
    if (next >= lock.required_count) {
      await celebrateAndClose();
    }
  }

  // WRITE: exact-match, N times
  async function submitWrite() {
    const val = entry.trim();
    if (!val) return;
    const target = lock.prompt.trim();
    if (val.toLowerCase() !== target.toLowerCase()) {
      toast.error(`Type exactly: "${target}"`);
      return;
    }
    setEntry("");
    await bump();
  }

  // COMPLIMENT: unique entries, min 5 chars
  async function submitCompliment() {
    const val = entry.trim();
    if (val.length < 5) return toast.error("At least 5 characters");
    const key = val.toLowerCase();
    if (seen.current.has(key)) return toast.error("Try a fresh one ❤️");
    seen.current.add(key);
    setEntry("");
    await bump();
  }

  // FUNNY: single entry, min 10 chars
  async function submitFunny() {
    const val = entry.trim();
    if (val.length < 10) return toast.error("Give it a bit more ✨");
    setEntry("");
    await bump();
  }

  // PHOTO
  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = await uploadChatMedia(file, meId, "image", ext);
      // send message
      await supabase.from("messages").insert({
        sender_id: meId,
        receiver_id: partnerId,
        content: `📸 ${lock.prompt}`,
        type: "image" as never,
        media_url: path,
        media_meta: { name: file.name, size: file.size, mime: file.type } as never,
      });
      await celebrateAndClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    }
  }

  // VOICE
  async function handleVoice(path: string, ms: number) {
    try {
      await supabase.from("messages").insert({
        sender_id: meId,
        receiver_id: partnerId,
        content: `🎤 ${lock.prompt}`,
        type: "voice" as never,
        media_url: path,
        media_meta: { duration_ms: ms } as never,
      });
      await celebrateAndClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  // QUIZ
  const [quiz, setQuiz] = useState<{ q: string; options: string[]; answer: number }[] | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [qBusy, setQBusy] = useState(false);
  useEffect(() => {
    if (lock.type !== "quiz" || quiz) return;
    setQBusy(true);
    generateLoveQuiz({ data: {} })
      .then((res) => setQuiz(res.quiz.questions))
      .catch(() => {
        setQuiz([
          { q: "Their comfort snack?", options: ["Chocolate", "Chips", "Ice cream", "Noodles"], answer: 2 },
          { q: "Their morning mood?", options: ["Sunshine", "Grumpy", "Sleepy", "Chatty"], answer: 2 },
          { q: "Love language?", options: ["Words", "Touch", "Gifts", "Time"], answer: 3 },
          { q: "Dream trip?", options: ["Beach", "Mountains", "City", "Countryside"], answer: 0 },
          { q: "Ideal weekend?", options: ["Cozy in", "Wild out", "Nature", "Cafés"], answer: 0 },
        ]);
      })
      .finally(() => setQBusy(false));
  }, [lock.type, quiz]);

  async function answerQuiz(i: number) {
    if (!quiz) return;
    const q = quiz[qIdx];
    if (i === q.answer) {
      await bump();
      setQIdx((n) => n + 1);
    } else {
      toast.error("Not quite — try again 💜");
    }
  }

  const pct = Math.round((lock.progress / lock.required_count) * 100);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-start pt-14 px-5 overflow-y-auto animate-fade-in">
      {/* Layered luxury backdrop */}
      <div className="fixed inset-0 -z-10 bg-velvet" />
      <div
        className="fixed inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(236,72,153,0.22), transparent 70%), radial-gradient(50% 50% at 100% 100%, rgba(217,164,102,0.14), transparent 70%), radial-gradient(40% 40% at 0% 80%, rgba(120,80,200,0.14), transparent 70%)",
        }}
      />
      <div
        className="fixed inset-0 -z-10 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* Ambient drifting petals */}
      <FloatingPetals />
      {celebrate && <Confetti />}

      <div className="w-full max-w-md relative">
        {/* Corner filigree ornaments */}
        <FiligreeCorner className="absolute -top-1 -left-1" />
        <FiligreeCorner className="absolute -top-1 -right-1 scale-x-[-1]" />

        <div className="flex flex-col items-center text-center mb-6">
          {/* Wax-seal style emblem with orbiting sparks */}
          <div className="relative mb-4">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-70"
              style={{ background: "radial-gradient(circle, rgba(236,72,153,0.55), transparent 70%)" }}
            />
            {/* Rotating rune ring */}
            <div
              className="absolute -inset-3 rounded-full opacity-50 pointer-events-none"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, hsl(38 60% 68% / 0.6) 40deg, transparent 80deg, transparent 180deg, hsl(340 65% 60% / 0.5) 220deg, transparent 260deg)",
                mask: "radial-gradient(circle, transparent 55%, black 56%, black 66%, transparent 67%)",
                WebkitMask: "radial-gradient(circle, transparent 55%, black 56%, black 66%, transparent 67%)",
                animation: "spinRing 12s linear infinite",
              }}
            />
            {/* Countdown ring (only if timed) */}
            {timePct != null && (
              <svg
                className="absolute -inset-2 pointer-events-none"
                viewBox="0 0 100 100"
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(38 55% 62% / 0.15)" strokeWidth="1.5" />
                <circle
                  cx="50" cy="50" r="46" fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${(timePct / 100) * 289} 289`}
                  style={{ transition: "stroke-dasharray 1s linear", filter: "drop-shadow(0 0 4px rgba(236,72,153,0.6))" }}
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(38 70% 75%)" />
                    <stop offset="100%" stopColor="hsl(340 65% 60%)" />
                  </linearGradient>
                </defs>
              </svg>
            )}
            <div
              className="relative size-20 rounded-full flex items-center justify-center"
              style={{
                background:
                  "conic-gradient(from 210deg, hsl(38 55% 62%), hsl(340 55% 45%), hsl(285 45% 32%), hsl(38 55% 62%))",
                boxShadow:
                  "0 20px 50px -20px rgba(236,72,153,0.55), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -6px 12px rgba(0,0,0,0.35)",
              }}
            >
              <div className="size-[68px] rounded-full bg-velvet/85 backdrop-blur border border-white/10 flex items-center justify-center">
                <Lock className="size-6 text-petal" strokeWidth={1.6} />
              </div>
            </div>
            {/* Twinkles */}
            <Sparkles className="absolute -top-1 -right-2 size-3.5 text-[hsl(38_70%_75%)] animate-pulse" />
            <Sparkles className="absolute -bottom-1 -left-2 size-3 text-petal/80 animate-pulse [animation-delay:600ms]" />
          </div>

          {/* Ornate divider with center diamond */}
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-petal/60" />
            <span className="size-1 rotate-45 bg-petal/70" />
            <p className="text-[9px] uppercase tracking-[0.42em] text-petal">
              Sealed by {partnerName}
            </p>
            <span className="size-1 rotate-45 bg-petal/70" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-petal/60" />
          </div>

          <h2 className="font-serif italic text-2xl text-candle">
            <span className="mr-1">{meta.emoji}</span>
            {meta.label}
          </h2>

          {/* Prompt in decorative quotes */}
          <div className="relative mt-4 px-6">
            <span
              className="absolute -left-1 -top-3 font-serif italic text-5xl leading-none select-none"
              style={{ color: "hsl(38 55% 62% / 0.55)" }}
            >
              &ldquo;
            </span>
            <p className="font-serif italic text-lg text-candle/95 leading-snug">
              {lock.prompt}
            </p>
            <span
              className="absolute -right-1 -bottom-5 font-serif italic text-5xl leading-none select-none"
              style={{ color: "hsl(38 55% 62% / 0.55)" }}
            >
              &rdquo;
            </span>
          </div>

          {/* Copy prompt chip */}
          <button
            onClick={copyPrompt}
            className="mt-5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-candle-muted hover:text-petal hover:border-petal/40 transition-colors"
          >
            <Copy className="size-3" /> Copy prompt
          </button>

          {/* Fleuron scroll divider */}
          <div className="flex items-center gap-3 mt-6 w-full">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-petal/30 to-petal/40" />
            <span className="text-petal/70 text-sm">❦</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-petal/30 to-petal/40" />
          </div>
        </div>



        {/* Progress rail — champagne */}
        <div className="mb-4 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm px-4 py-3">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.28em] text-candle-muted mb-2">
            <span>Progress</span>
            <span className="tabular-nums text-candle/85 flex items-center gap-1.5">
              {lock.progress} / {lock.required_count}
              {remainingLabel && (
                <span className="ml-2 text-petal flex items-center gap-1">
                  <Timer className="size-3" /> {remainingLabel}
                </span>
              )}
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background:
                  "linear-gradient(90deg, hsl(38 55% 62%), hsl(340 65% 60%), hsl(38 55% 62%))",
                boxShadow: "0 0 12px rgba(236,72,153,0.55)",
              }}
            />
          </div>
          {/* Step dots (only when reasonable) */}
          {meta.countable && lock.required_count <= 20 && (
            <div className="flex items-center justify-between gap-1 mt-3">
              {Array.from({ length: lock.required_count }).map((_, i) => {
                const done = i < lock.progress;
                return (
                  <span
                    key={i}
                    className="flex-1 h-1 rounded-full transition-all"
                    style={{
                      background: done
                        ? "linear-gradient(90deg, hsl(38 60% 68%), hsl(340 65% 60%))"
                        : "rgba(255,255,255,0.06)",
                      boxShadow: done ? "0 0 6px rgba(236,72,153,0.5)" : undefined,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Plea row — always available */}
        <div className="mb-5 flex justify-center">
          <button
            onClick={sendPlea}
            disabled={pleaCooldown > 0}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 text-candle hover:border-petal/50 hover:text-petal transition-colors disabled:opacity-50"
          >
            <HeartHandshake className="size-3.5 text-petal" />
            {pleaCooldown > 0 ? `Wait ${pleaCooldown}s` : `Beg ${partnerName} for mercy`}
          </button>
        </div>



        {celebrate ? (
          <div className="text-center py-6">
            <p className="text-5xl mb-3">🎉</p>
            <p className="font-serif italic text-2xl text-candle">Punishment completed!</p>
            <p className="text-candle-muted text-sm mt-1">Unlocking chat…</p>
          </div>
        ) : (
          <>
            {(lock.type === "write" || lock.type === "compliment" || lock.type === "funny") && (() => {
              const minLen = lock.type === "compliment" ? 5 : lock.type === "funny" ? 10 : 0;
              const target = lock.prompt.trim().toLowerCase();
              const val = entry.trim();
              const writeMatch = lock.type === "write" && val.length > 0
                ? (val.toLowerCase() === target
                    ? "match"
                    : target.startsWith(val.toLowerCase())
                      ? "progress"
                      : "mismatch")
                : null;
              return (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      value={entry}
                      onChange={(e) => setEntry(e.target.value)}
                      placeholder={
                        lock.type === "write"
                          ? `Type exactly: "${lock.prompt}"`
                          : lock.type === "compliment"
                            ? "A unique compliment…"
                            : "Type your entry…"
                      }
                      rows={lock.type === "funny" ? 4 : 2}
                      className={`w-full bg-white/[0.03] border rounded-2xl px-4 py-3 text-sm text-candle resize-none placeholder:text-candle-muted/60 outline-none transition-colors ${
                        writeMatch === "match"
                          ? "border-emerald-400/60"
                          : writeMatch === "mismatch"
                            ? "border-rose-400/60"
                            : "border-white/10 focus:border-petal/50"
                      }`}
                    />
                    {/* Feedback chip */}
                    <div className="absolute right-3 bottom-3 flex items-center gap-2 text-[10px] tracking-wide">
                      {lock.type === "write" && writeMatch === "match" && (
                        <span className="flex items-center gap-1 text-emerald-300">
                          <Check className="size-3" /> Perfect
                        </span>
                      )}
                      {lock.type === "write" && writeMatch === "progress" && (
                        <span className="text-petal/80 tabular-nums">
                          {val.length} / {target.length}
                        </span>
                      )}
                      {lock.type === "write" && writeMatch === "mismatch" && (
                        <span className="text-rose-300">Off script</span>
                      )}
                      {lock.type !== "write" && (
                        <span className={`tabular-nums ${val.length < minLen ? "text-candle-muted" : "text-emerald-300"}`}>
                          {val.length}{minLen ? ` / ${minLen}+` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <LuxuryButton
                    onClick={
                      lock.type === "write"
                        ? submitWrite
                        : lock.type === "compliment"
                          ? submitCompliment
                          : submitFunny
                    }
                  >
                    <Send className="size-3.5" /> Submit
                  </LuxuryButton>
                </div>
              );
            })()}


            {lock.type === "photo" && (
              <>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                <LuxuryButton onClick={() => fileRef.current?.click()}>📸 Send photo</LuxuryButton>
              </>
            )}

            {lock.type === "voice" && (
              <div className="flex justify-center">
                <VoiceRecorder userId={meId} onSend={handleVoice} />
              </div>
            )}

            {lock.type === "draw" && (
              <div className="space-y-2">
                <Link
                  to="/app/paint"
                  className="w-full py-3 rounded-full bg-white/[0.03] border border-white/10 hover:border-petal/40 text-sm text-candle flex items-center justify-center gap-2 transition-colors"
                >
                  <Palette className="size-4 text-petal" /> Open Paint Together
                </Link>
                <LuxuryButton onClick={celebrateAndClose}>I finished my drawing ✨</LuxuryButton>
              </div>
            )}

            {lock.type === "quiz" && (
              <div>
                {qBusy && !quiz && (
                  <div className="text-center py-6 text-candle-muted text-sm">
                    <Sparkles className="size-5 text-petal mx-auto animate-pulse mb-2" />
                    Loading quiz…
                  </div>
                )}
                {quiz && qIdx < quiz.length && (
                  <div className="rounded-3xl bg-surface border border-border p-4">
                    <p className="text-[10px] uppercase tracking-widest text-petal mb-2">
                      Q {qIdx + 1} / {quiz.length}
                    </p>
                    <p className="font-serif italic text-lg text-candle mb-3">{quiz[qIdx].q}</p>
                    <div className="space-y-2">
                      {quiz[qIdx].options.map((o, i) => (
                        <button
                          key={i}
                          onClick={() => answerQuiz(i)}
                          className="w-full text-left rounded-2xl border border-border bg-velvet px-4 py-2.5 text-sm text-candle hover:border-petal/50"
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <p className="text-[10px] text-candle-muted text-center mt-6 tracking-wide">
          🕊️ Playful & consensual only. Either partner can disable this in Settings.
        </p>
      </div>
    </div>
  );
}

function LuxuryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full py-3 rounded-full text-[11px] uppercase tracking-[0.28em] font-medium text-velvet overflow-hidden active:scale-[0.99] transition-transform"
      style={{
        background: "linear-gradient(135deg, hsl(38 62% 68%) 0%, hsl(340 65% 60%) 55%, hsl(38 62% 68%) 100%)",
        boxShadow:
          "0 12px 30px -12px rgba(236,72,153,0.6), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.15)",
      }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15), transparent 60%)" }}
      />
    </button>
  );
}

function Confetti() {
  const bits = Array.from({ length: 40 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 1.2 + Math.random() * 1.4;
        const emoji = ["💜", "🎉", "🌸", "💫", "❤️", "🐼"][i % 6];
        return (
          <span
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${left}%`,
              top: `-5%`,
              animation: `fall ${duration}s ${delay}s linear forwards`,
            }}
          >
            {emoji}
          </span>
        );
      })}
      <style>{`
        @keyframes fall {
          to { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function FiligreeCorner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none w-16 h-16 opacity-70 ${className}`}
      viewBox="0 0 64 64"
      fill="none"
    >
      <defs>
        <linearGradient id="filGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(38 70% 78%)" />
          <stop offset="100%" stopColor="hsl(340 55% 55%)" />
        </linearGradient>
      </defs>
      <path
        d="M2 2 L26 2 M2 2 L2 26 M2 2 Q22 6 26 22 M2 2 Q6 22 22 26 M14 4 Q18 10 14 14 Q10 10 14 4 Z"
        stroke="url(#filGold)"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="14" cy="14" r="1.4" fill="url(#filGold)" />
    </svg>
  );
}

function FloatingPetals() {
  const petals = Array.from({ length: 14 });
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {petals.map((_, i) => {
        const left = (i * 97) % 100;
        const size = 8 + ((i * 13) % 10);
        const delay = (i * 0.7) % 6;
        const duration = 14 + ((i * 3) % 10);
        const drift = (i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 4);
        const hue = i % 3 === 0 ? 38 : 335;
        const sat = i % 3 === 0 ? 60 : 65;
        return (
          <span
            key={i}
            className="absolute rounded-full blur-[1px]"
            style={{
              left: `${left}%`,
              top: "-8%",
              width: size,
              height: size,
              background: `radial-gradient(circle at 35% 30%, hsl(${hue} ${sat}% 78% / 0.9), hsl(${hue} ${sat}% 55% / 0.35))`,
              boxShadow: `0 0 12px hsl(${hue} ${sat}% 60% / 0.35)`,
              animation: `petalDrift ${duration}s ${delay}s linear infinite`,
              // @ts-expect-error css var
              "--drift": `${drift}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes petalDrift {
          0% { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.9; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(360deg); opacity: 0; }
        }
        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

