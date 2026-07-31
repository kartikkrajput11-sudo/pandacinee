import { useEffect, useState } from "react";
import { Lock, Hourglass, Mail } from "lucide-react";
import { formatUnlockCountdown, moodById } from "@/lib/rituals";

/** Love Letter — sealed envelope that tears open with a wax seal. */
export function LoveLetterCard({ content, mine }: { content: string; mine: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-64">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left rounded-3xl border border-gilt/35 bg-gradient-to-b from-surface-elevated to-surface overflow-hidden transition-transform active:scale-[0.98]"
        style={{ boxShadow: "0 12px 34px hsl(38 60% 30% / 0.25)" }}
      >
        <div className="relative px-4 pt-4 pb-3">
          <p className="text-[8px] uppercase tracking-[0.32em] text-gilt/85">Love letter</p>
          {!open ? (
            <div className="relative mt-3 h-24 flex items-center justify-center">
              <Mail className="size-10 text-gilt/70" />
              <span
                className="absolute -bottom-1 size-9 rounded-full flex items-center justify-center text-sm animate-affection-bloom"
                style={{ background: "radial-gradient(circle at 30% 30%, hsl(342 70% 55%), hsl(342 60% 34%))" }}
              >
                🐼
              </span>
            </div>
          ) : (
            <p className="mt-3 font-serif italic text-sm leading-relaxed text-candle whitespace-pre-wrap break-words animate-fade-in">
              {content}
            </p>
          )}
          <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-candle-muted">
            {open ? "tap to seal" : mine ? "sealed — they can open it" : "tap to break the seal"}
          </p>
        </div>
      </button>
    </div>
  );
}

/** Time Capsule — locked until its unlock date passes. */
export function TimeCapsuleCard({
  content,
  unlockAt,
}: {
  content: string;
  unlockAt: string;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const remaining = formatUnlockCountdown(unlockAt);
  const locked = !!remaining;

  return (
    <div className="w-64 rounded-3xl border border-petal/30 bg-surface-elevated/90 overflow-hidden">
      <div className="px-4 py-3.5">
        <p className="text-[8px] uppercase tracking-[0.32em] text-petal/80 flex items-center gap-1.5">
          <Hourglass className="size-3" /> Time capsule
        </p>
        {locked ? (
          <div className="mt-3 flex flex-col items-center gap-2 py-3">
            <Lock className="size-7 text-petal/70 animate-affection-bloom" />
            <p className="text-xs text-candle-muted">opens in {remaining}</p>
            <p className="text-[10px] text-candle-muted/70">
              {new Date(unlockAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="mt-2.5 text-sm leading-relaxed text-candle whitespace-pre-wrap break-words animate-fade-in">
            {content}
          </p>
        )}
      </div>
    </div>
  );
}

/** Confession — a prompt card with the answer underneath. */
export function ConfessionCard({ prompt, content }: { prompt: string; content: string }) {
  return (
    <div className="w-64 rounded-3xl border border-gilt/30 bg-surface-elevated/90 overflow-hidden">
      <div className="px-4 py-3.5">
        <p className="text-[8px] uppercase tracking-[0.32em] text-gilt/85">Confession jar</p>
        <p className="mt-2 font-serif italic text-[13px] text-candle-muted">{prompt}</p>
        <p className="mt-2 text-sm leading-relaxed text-candle whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  );
}

/** Mood Ring — a mood announcement that also tints the chat. */
export function MoodCard({ moodId, note }: { moodId: string; note?: string }) {
  const mood = moodById(moodId);
  if (!mood) return null;
  return (
    <div
      className="w-56 rounded-3xl border overflow-hidden"
      style={{
        borderColor: `hsl(${mood.hue} / 0.4)`,
        background: `linear-gradient(160deg, hsl(${mood.hue} / 0.22), transparent)`,
      }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        <span className="text-3xl animate-affection-float">{mood.emoji}</span>
        <div>
          <p className="text-[8px] uppercase tracking-[0.32em] text-candle-muted">Mood ring</p>
          <p className="text-sm text-candle font-medium">{mood.label}</p>
          <p className="text-[11px] text-candle-muted italic">{note || mood.note}</p>
        </div>
      </div>
    </div>
  );
}
