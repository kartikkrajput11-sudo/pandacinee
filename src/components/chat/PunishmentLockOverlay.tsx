import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Send, Sparkles, Palette } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { uploadChatMedia } from "@/lib/chat";
import { VoiceRecorder } from "./VoiceRecorder";
import { typeMeta, type PunishmentLock } from "@/lib/punishment";
import { generateLoveQuiz } from "@/lib/games.functions";

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
    <div className="fixed inset-0 z-40 bg-velvet/95 backdrop-blur flex flex-col items-center justify-start pt-14 px-5 overflow-y-auto animate-fade-in">
      {celebrate && <Confetti />}

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="size-16 rounded-full bg-petal-soft border border-petal/40 flex items-center justify-center mb-3 animate-pulse">
            <Lock className="size-7 text-petal" />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Chat locked by {partnerName}</p>
          <h2 className="font-serif italic text-2xl mt-1">{meta.emoji} {meta.label}</h2>
          <p className="mt-2 text-candle text-lg">"{lock.prompt}"</p>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-candle-muted mb-1">
            <span>Progress</span>
            <span>
              {lock.progress} / {lock.required_count}
              {remainingLabel ? ` · ⏳ ${remainingLabel}` : ""}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-petal to-petal-soft transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {celebrate ? (
          <div className="text-center py-6">
            <p className="text-5xl mb-3">🎉</p>
            <p className="font-serif italic text-2xl text-candle">Punishment completed!</p>
            <p className="text-candle-muted text-sm mt-1">Unlocking chat…</p>
          </div>
        ) : (
          <>
            {(lock.type === "write" || lock.type === "compliment" || lock.type === "funny") && (
              <div className="space-y-2">
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
                  className="w-full bg-surface border border-border rounded-2xl px-4 py-3 text-sm text-candle resize-none"
                />
                <button
                  onClick={
                    lock.type === "write"
                      ? submitWrite
                      : lock.type === "compliment"
                        ? submitCompliment
                        : submitFunny
                  }
                  className="w-full py-3 rounded-full bg-petal text-velvet text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Send className="size-4" /> Submit
                </button>
              </div>
            )}

            {lock.type === "photo" && (
              <>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-4 rounded-2xl bg-petal text-velvet text-sm font-semibold"
                >
                  📸 Send photo
                </button>
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
                  className="w-full py-3 rounded-2xl bg-surface border border-border text-sm text-candle flex items-center justify-center gap-2"
                >
                  <Palette className="size-4 text-petal" /> Open Paint Together
                </Link>
                <button
                  onClick={celebrateAndClose}
                  className="w-full py-3 rounded-full bg-petal text-velvet text-sm font-semibold"
                >
                  I finished my drawing ✨
                </button>
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

        <p className="text-[10px] text-candle-muted text-center mt-6">
          🕊️ Playful & consensual only. Either partner can disable this in Settings.
        </p>
      </div>
    </div>
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
