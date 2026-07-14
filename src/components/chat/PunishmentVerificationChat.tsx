import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Send, ImageIcon, Video as VideoIcon, X, Check, RotateCcw, Palette, Mic } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { uploadChatMedia } from "@/lib/chat";
import { typeMeta, type PunishmentLock } from "@/lib/punishment";
import { VoiceRecorder } from "./VoiceRecorder";
import { usePunishmentVerification, wipePunishment, type VerificationMessage } from "@/hooks/usePunishmentVerification";
import { UnlockCelebration } from "./UnlockCelebration";

type Props = {
  lock: PunishmentLock;
  meId: string;
  partnerName: string;
  iAmLocked: boolean; // target
  iAmLocker: boolean; // reviewer
  onClose: () => void;
  onCancel?: () => Promise<void>;
};

const CARD_TEMPLATES = [
  { id: "sorry",    label: "Sorry",       emoji: "🥺", bg: "from-pink-400 to-rose-500", title: "I'm sorry ❤️" },
  { id: "thanks",   label: "Thank you",   emoji: "🌷", bg: "from-amber-300 to-pink-400", title: "Thank you 🌷" },
  { id: "love",     label: "Love note",   emoji: "💌", bg: "from-fuchsia-400 to-purple-500", title: "For you 💌" },
  { id: "flowers",  label: "Flowers",     emoji: "💐", bg: "from-rose-300 to-fuchsia-400", title: "A bouquet 💐" },
];

export function PunishmentVerificationChat({ lock, meId, partnerName, iAmLocked, iAmLocker, onClose, onCancel }: Props) {
  const meta = typeMeta(lock.type);
  const { messages, sendMessage, reviewMessage } = usePunishmentVerification(lock.id, meId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [retryFor, setRetryFor] = useState<VerificationMessage | null>(null);
  const [retryNote, setRetryNote] = useState("");
  const [celebrateTick, setCelebrateTick] = useState(0);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const pendingSubmission = useMemo(
    () => [...messages].reverse().find((m) => m.submission && m.approved === null) ?? null,
    [messages],
  );
  const latestRetry = useMemo(
    () => [...messages].reverse().find((m) => m.approved === false),
    [messages],
  );

  // Temporary "note" chat cap — the locked partner only gets 10 sends here,
  // so the verification chat itself feels locked.
  const LOCKED_MSG_LIMIT = 10;
  const lockedMsgsUsed = useMemo(
    () => messages.filter((m) => m.sender_id === meId).length,
    [messages, meId],
  );
  const lockedMsgsLeft = Math.max(0, LOCKED_MSG_LIMIT - lockedMsgsUsed);
  const lockedOut = iAmLocked && lockedMsgsLeft === 0;

  const submissionKindFor = (type: string): "text" | "image" | "video" | "voice" | "card" | "drawing" => {
    switch (type) {
      case "photo":    return "image";
      case "video":    return "video";
      case "voice":    return "voice";
      case "card":     return "card";
      case "draw":     return "drawing";
      case "creative": return "text";
      case "activity": return "video";
      default:         return "text";
    }
  };
  const requiredKind = submissionKindFor(lock.type);

  async function sendText(asSubmission: boolean) {
    const val = text.trim();
    if (!val) return;
    if (iAmLocked && lockedOut) {
      toast.error(`You've used all ${LOCKED_MSG_LIMIT} notes — finish your ${lock.type} challenge to unlock.`);
      return;
    }
    setSending(true);
    try {
      await sendMessage({ kind: "text", content: val, submission: asSubmission });
      setText("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) return toast.error("Keep it under 60MB");
    if (iAmLocked && lockedOut) return toast.error(`You've used all ${LOCKED_MSG_LIMIT} notes.`);
    setSending(true);
    try {
      const ext = (file.name.split(".").pop() || (kind === "image" ? "jpg" : "mp4")).toLowerCase();
      const path = await uploadChatMedia(file, meId, kind, ext);
      await sendMessage({
        kind,
        media_url: path,
        media_meta: { name: file.name, size: file.size, mime: file.type },
        submission: kind === requiredKind || (requiredKind === "video" && kind === "video") || (requiredKind === "image" && kind === "image"),
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setSending(false);
    }
  }

  async function handleVoice(path: string, ms: number) {
    setVoiceOpen(false);
    if (iAmLocked && lockedOut) { toast.error(`You've used all ${LOCKED_MSG_LIMIT} notes.`); return; }
    try {
      await sendMessage({
        kind: "voice",
        media_url: path,
        media_meta: { duration_ms: ms },
        submission: requiredKind === "voice",
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  async function sendCard(t: (typeof CARD_TEMPLATES)[number], note: string) {
    setCardOpen(false);
    if (iAmLocked && lockedOut) return toast.error(`You've used all ${LOCKED_MSG_LIMIT} notes.`);
    try {
      await sendMessage({
        kind: "card",
        content: note.trim() || t.title,
        media_meta: { template: t.id, title: t.title, emoji: t.emoji, bg: t.bg },
        submission: requiredKind === "card",
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  async function approve(message: VerificationMessage) {
    try {
      await reviewMessage(message.id, true);
      setCelebrateTick((n) => n + 1);
      toast.success(`Punishment approved — chat unlocked 🎉`);
      window.setTimeout(async () => {
        await wipePunishment(lock.id);
        onClose();
      }, 2400);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function askRetry(message: VerificationMessage, feedback: string) {
    try {
      await reviewMessage(message.id, false, feedback || null);
      setRetryFor(null);
      setRetryNote("");
      toast("Asked for a retry");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-velvet/95 backdrop-blur flex flex-col animate-fade-in">
      <UnlockCelebration trigger={celebrateTick || null} />

      {/* Header */}
      <header className="px-4 pt-6 pb-3 border-b border-border bg-velvet/80 backdrop-blur">
        <div className="flex items-center gap-2 mb-2">
          <div className="size-9 rounded-full bg-petal-soft border border-petal/40 flex items-center justify-center">
            <Lock className="size-4 text-petal" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-petal">
              {iAmLocked ? `Locked by ${partnerName}` : `You locked ${partnerName}`}
            </p>
            <h2 className="font-serif italic text-base leading-tight truncate">
              {meta.emoji} {meta.label} · Verification
            </h2>
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
            aria-label="Hide verification chat"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="rounded-2xl bg-surface border border-border p-3">
          <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-0.5">Current punishment</p>
          <p className="text-sm text-candle">"{lock.prompt}"</p>
          {pendingSubmission ? (
            <p className="text-[11px] text-amber-300 mt-1">⏳ Awaiting {iAmLocker ? "your review" : `${partnerName}'s review`}</p>
          ) : latestRetry ? (
            <p className="text-[11px] text-petal mt-1">↻ Retry requested{latestRetry.feedback ? ` — "${latestRetry.feedback}"` : ""}</p>
          ) : (
            <p className="text-[11px] text-candle-muted mt-1">Only punishment-related messages allowed.</p>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-candle-muted text-sm py-10">
            {iAmLocked
              ? `Send your submission to complete the challenge.`
              : `Waiting for ${partnerName} to submit…`}
          </div>
        )}
        {messages.map((m) => (
          <VerifBubble
            key={m.id}
            m={m}
            mine={m.sender_id === meId}
            iAmLocker={iAmLocker}
            onApprove={() => approve(m)}
            onRetry={() => setRetryFor(m)}
          />
        ))}
      </div>

      {/* Composer */}
      {iAmLocked && (
        <div className="px-3 pb-3 pt-2 border-t border-border bg-surface/60 backdrop-blur">
          <div className="flex items-end gap-2">
            <div className="flex gap-1">
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, "image")} />
              <input ref={vidRef} type="file" accept="video/*" capture={requiredKind === "video" ? "user" : undefined} className="hidden" onChange={(e) => handleFile(e, "video")} />
              <button
                onClick={() => imgRef.current?.click()}
                className="size-10 rounded-full bg-velvet border border-border flex items-center justify-center text-candle"
                aria-label="Send image"
              >
                <ImageIcon className="size-4" />
              </button>
              <button
                onClick={() => vidRef.current?.click()}
                className="size-10 rounded-full bg-velvet border border-border flex items-center justify-center text-candle"
                aria-label="Send video"
              >
                <VideoIcon className="size-4" />
              </button>
              <button
                onClick={() => setVoiceOpen((v) => !v)}
                className={`size-10 rounded-full border flex items-center justify-center ${voiceOpen ? "bg-petal border-petal text-velvet" : "bg-velvet border-border text-candle"}`}
                aria-label="Voice note"
              >
                <Mic className="size-4" />
              </button>
              <button
                onClick={() => setCardOpen(true)}
                className="size-10 rounded-full bg-velvet border border-border flex items-center justify-center text-candle"
                aria-label="Send a card"
              >
                💌
              </button>
              {(lock.type === "draw" || lock.type === "creative") && (
                <Link
                  to="/app/paint"
                  className="size-10 rounded-full bg-velvet border border-border flex items-center justify-center text-candle"
                  aria-label="Open Paint Together"
                  title="Open Paint Together"
                >
                  <Palette className="size-4" />
                </Link>
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder={requiredKind === "text" ? "Write your submission…" : "Add a note (optional)…"}
              className="flex-1 bg-velvet border border-border rounded-2xl px-3 py-2 text-sm text-candle resize-none max-h-24"
            />
            <button
              onClick={() => sendText(requiredKind === "text")}
              disabled={sending || !text.trim()}
              className="size-10 rounded-full bg-petal text-velvet disabled:opacity-50 flex items-center justify-center"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </div>

          {voiceOpen && (
            <div className="mt-2 w-full rounded-2xl border border-petal/40 bg-petal-soft/20 p-2 flex items-stretch">
              <VoiceRecorder userId={meId} onSend={handleVoice} />
            </div>
          )}

          {pendingSubmission ? (
            <p className="text-[11px] text-center text-candle-muted mt-2">
              ⏳ Submission sent — waiting for approval.
            </p>
          ) : (
            <p className="text-[11px] text-center text-candle-muted mt-2">
              Submission type expected: <span className="text-petal">{requiredKind}</span>
            </p>
          )}
        </div>
      )}

      {iAmLocker && (
        <div className="px-3 pb-3 pt-2 border-t border-border bg-surface/60 backdrop-blur">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder="Feedback or encouragement…"
              className="flex-1 bg-velvet border border-border rounded-2xl px-3 py-2 text-sm text-candle resize-none max-h-24"
            />
            <button
              onClick={() => sendText(false)}
              disabled={sending || !text.trim()}
              className="size-10 rounded-full bg-petal text-velvet disabled:opacity-50 flex items-center justify-center"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </div>
          {onCancel && (
            <button
              onClick={async () => {
                if (!confirm("Cancel this punishment and unlock chat?")) return;
                await onCancel();
                await wipePunishment(lock.id);
                onClose();
              }}
              className="w-full mt-2 py-2 rounded-full bg-velvet border border-border text-xs text-candle-muted"
            >
              Cancel punishment & unlock
            </button>
          )}
        </div>
      )}

      {/* Card templates modal */}
      {cardOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full sm:max-w-md bg-surface border border-border rounded-3xl p-5">
            <div className="flex items-center mb-3">
              <h3 className="font-serif italic text-lg flex-1">Send a card 💌</h3>
              <button onClick={() => setCardOpen(false)} className="text-candle-muted"><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {CARD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => sendCard(t, text)}
                  className={`aspect-[4/3] rounded-2xl bg-gradient-to-br ${t.bg} p-3 text-left flex flex-col justify-between text-white shadow-lg hover:scale-[1.02] transition`}
                >
                  <span className="text-3xl">{t.emoji}</span>
                  <span className="font-serif italic text-lg">{t.title}</span>
                </button>
              ))}
            </div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={120}
              placeholder="Add a short note (optional)…"
              className="w-full bg-velvet border border-border rounded-2xl px-3 py-2 text-sm text-candle"
            />
          </div>
        </div>
      )}

      {/* Retry feedback modal */}
      {retryFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full sm:max-w-md bg-surface border border-border rounded-3xl p-5">
            <h3 className="font-serif italic text-lg mb-3">Ask for a retry</h3>
            <textarea
              value={retryNote}
              onChange={(e) => setRetryNote(e.target.value)}
              rows={3}
              placeholder="What should they change? (optional)"
              className="w-full bg-velvet border border-border rounded-2xl px-3 py-2 text-sm text-candle resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setRetryFor(null); setRetryNote(""); }}
                className="flex-1 py-2.5 rounded-full bg-velvet border border-border text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => askRetry(retryFor, retryNote)}
                className="flex-1 py-2.5 rounded-full bg-petal text-velvet text-sm font-semibold"
              >
                Ask retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifBubble({
  m, mine, iAmLocker, onApprove, onRetry,
}: {
  m: VerificationMessage;
  mine: boolean;
  iAmLocker: boolean;
  onApprove: () => void;
  onRetry: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!m.media_url) return;
    (async () => {
      const { data } = await supabase.storage.from("chat-media").createSignedUrl(m.media_url!, 3600);
      if (active && data?.signedUrl) setSignedUrl(data.signedUrl);
    })();
    return () => { active = false; };
  }, [m.media_url]);

  const reviewable = m.submission && m.approved === null && iAmLocker;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 border ${
        m.submission
          ? "border-petal/50 bg-petal-soft/20"
          : mine
            ? "border-border bg-petal/20"
            : "border-border bg-surface"
      }`}>
        {m.submission && (
          <p className="text-[9px] uppercase tracking-widest text-petal mb-1">
            Submission {m.approved === true ? "· approved" : m.approved === false ? "· retry" : "· pending"}
          </p>
        )}

        {m.kind === "text" && <p className="text-sm text-candle whitespace-pre-wrap">{m.content}</p>}

        {m.kind === "image" && signedUrl && (
          <img src={signedUrl} alt="submission" className="rounded-xl max-h-72 object-cover" />
        )}
        {m.kind === "video" && signedUrl && (
          <video src={signedUrl} controls className="rounded-xl max-h-72" />
        )}
        {m.kind === "voice" && signedUrl && (
          <audio src={signedUrl} controls className="w-56" />
        )}
        {m.kind === "card" && (() => {
          const meta = (m.media_meta ?? {}) as { bg?: string; emoji?: string; title?: string };
          return (
            <div className={`rounded-2xl bg-gradient-to-br ${meta.bg ?? "from-pink-400 to-rose-500"} p-4 min-w-[220px] text-white`}>
              <div className="text-3xl">{meta.emoji ?? "💌"}</div>
              <div className="font-serif italic text-lg">{meta.title ?? "For you"}</div>
              {m.content && <div className="text-sm mt-1 opacity-90">{m.content}</div>}
            </div>
          );
        })()}
        {m.kind === "drawing" && signedUrl && (
          <img src={signedUrl} alt="drawing" className="rounded-xl max-h-72 object-cover" />
        )}
        {m.kind === "drawing" && !signedUrl && m.content && (
          <p className="text-sm text-candle">🖌️ {m.content}</p>
        )}

        {m.content && (m.kind === "image" || m.kind === "video") && (
          <p className="text-xs text-candle-muted mt-1">{m.content}</p>
        )}

        {m.feedback && m.approved === false && (
          <p className="text-[11px] text-petal mt-1">↻ {m.feedback}</p>
        )}

        {reviewable && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={onApprove}
              className="flex-1 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center justify-center gap-1"
            >
              <Check className="size-3" /> Approve
            </button>
            <button
              onClick={onRetry}
              className="flex-1 py-1.5 rounded-full bg-velvet border border-border text-xs flex items-center justify-center gap-1"
            >
              <RotateCcw className="size-3" /> Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 40 });
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
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
              animation: `pv-fall ${duration}s ${delay}s linear forwards`,
            }}
          >
            {emoji}
          </span>
        );
      })}
      <style>{`@keyframes pv-fall { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0.8; } }`}</style>
    </div>
  );
}
