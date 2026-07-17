import { useEffect, useMemo, useState } from "react";
import { Sparkles, X, Heart } from "lucide-react";

// On the 18th of every month, celebrate the owners' monthiversary.
// Site-wide gilded card that slides in once per day (dismissible).
export default function OwnersMonthiversary() {
  const [open, setOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const is18 = today.getDate() === 18;
  const dayKey = `owners-monthiversary-${today.getFullYear()}-${today.getMonth() + 1}-18`;

  useEffect(() => {
    if (!is18) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(dayKey) === "seen") return;
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, [is18, dayKey]);

  function dismiss() {
    setOpen(false);
    try { window.localStorage.setItem(dayKey, "seen"); } catch {}
  }

  if (!is18 || !open) return null;

  const monthName = today.toLocaleString(undefined, { month: "long" });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      style={{ background: "radial-gradient(circle at 50% 40%, rgba(236,72,153,0.18), rgba(10,6,14,0.85) 70%)" }}
      onClick={dismiss}
    >
      {/* Petal rain */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full animate-petal"
            style={{
              left: `${(i * 41) % 100}%`,
              top: `-10%`,
              width: 4 + ((i * 3) % 6),
              height: 4 + ((i * 3) % 6),
              background: i % 2 ? "rgba(236,72,153,0.7)" : "rgba(245,214,164,0.75)",
              filter: "blur(0.5px)",
              animationDelay: `${(i * 0.35) % 6}s`,
              animationDuration: `${8 + ((i * 2) % 6)}s`,
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-[28px] p-6 bg-[linear-gradient(180deg,rgba(30,20,35,0.96),rgba(18,12,22,0.98))] border border-petal/25 shadow-[0_40px_120px_-40px_rgba(236,72,153,0.55)] animate-fade-up"
      >
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-petal/60 to-transparent" />
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 size-8 rounded-full bg-velvet/60 border border-white/[0.06] flex items-center justify-center text-candle-muted hover:text-candle"
        >
          <X className="size-3.5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="relative size-20 rounded-full flex items-center justify-center mb-3"
            style={{ background: "radial-gradient(circle, rgba(245,214,164,0.35), transparent 70%)" }}>
            <div className="size-14 rounded-full bg-gradient-to-br from-[#f5d6a4] to-[#c8934a] flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(245,214,164,0.7)]">
              <Heart className="size-7 text-velvet" fill="currentColor" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 size-4 text-petal animate-pulse-soft" />
          </div>

          <p className="text-[10px] uppercase tracking-[0.32em] text-petal flex items-center gap-1.5">
            <Sparkles className="size-3" /> The 18th
          </p>
          <h2 className="mt-1 font-serif italic text-2xl text-candle leading-tight">
            Happy Monthiversary
          </h2>
          <p className="mt-1 text-xs text-candle-muted">
            {monthName} 18 · a little day that started everything
          </p>

          <div className="my-5 h-px w-24 bg-gradient-to-r from-transparent via-petal/50 to-transparent" />

          <p className="font-serif italic text-sm text-candle/90 leading-relaxed">
            To the two who dreamt this place —
            <br />another month of us, written in gold.
          </p>

          <button
            onClick={dismiss}
            className="mt-6 w-full py-3 rounded-full bg-petal text-velvet font-medium text-[11px] uppercase tracking-[0.24em] petal-glow"
          >
            With love ✨
          </button>
        </div>
      </div>
    </div>
  );
}
