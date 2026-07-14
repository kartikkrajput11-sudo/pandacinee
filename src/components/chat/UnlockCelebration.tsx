import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";

/**
 * Full-screen unlock celebration: blurred backdrop, two "LOCKED" ribbons
 * tearing apart, lock swaps to an open lock with a bloom, then confetti.
 *
 * `trigger` is a monotonically increasing number/id — every time it changes
 * to a truthy value, the animation plays for ~2.4s.
 */
export function UnlockCelebration({
  trigger,
  onDone,
}: {
  trigger: number | string | null;
  onDone?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<"idle" | "tear" | "open" | "shower">("idle");

  useEffect(() => {
    if (!trigger) return;
    setPlaying(true);
    setPhase("tear");
    const t1 = window.setTimeout(() => setPhase("open"), 650);
    const t2 = window.setTimeout(() => setPhase("shower"), 1050);
    const t3 = window.setTimeout(() => {
      setPlaying(false);
      setPhase("idle");
      onDone?.();
    }, 2500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [trigger, onDone]);

  if (!playing) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center overflow-hidden animate-uc-fade-in">
      {/* blurred backdrop */}
      <div className="absolute inset-0 bg-velvet/70 backdrop-blur-xl" />

      {/* radial bloom behind lock */}
      <div
        className={`absolute size-[70vmin] rounded-full blur-3xl transition-opacity duration-700 ${
          phase === "open" || phase === "shower" ? "opacity-100" : "opacity-40"
        }`}
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--petal) 55%, transparent) 0%, transparent 65%)",
          animation: "uc-bloom 2.4s ease-out both",
        }}
      />

      {/* ribbons — top strip + bottom strip that split apart in phase 'tear' */}
      <Ribbon side="top" torn={phase !== "idle"} />
      <Ribbon side="bottom" torn={phase !== "idle"} />

      {/* lock */}
      <div className="relative size-40 flex items-center justify-center">
        <div
          className={`absolute inset-0 rounded-full border border-petal/50 bg-surface/70 backdrop-blur ${
            phase === "open" || phase === "shower" ? "animate-uc-pop" : ""
          }`}
        />
        <div className="relative">
          {phase !== "open" && phase !== "shower" ? (
            <Lock
              className="size-16 text-petal drop-shadow-[0_0_24px_rgba(255,120,180,0.55)]"
              strokeWidth={1.6}
            />
          ) : (
            <Unlock
              key="unlock"
              className="size-16 text-petal drop-shadow-[0_0_28px_rgba(255,120,180,0.75)] animate-uc-unlock"
              strokeWidth={1.6}
            />
          )}
        </div>

        {/* soft "unlocked" label under lock */}
        {(phase === "open" || phase === "shower") && (
          <p className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.35em] text-petal font-semibold animate-uc-label">
            Unlocked
          </p>
        )}
      </div>

      {/* confetti shower */}
      {phase === "shower" && <Confetti />}

      <style>{`
        @keyframes uc-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-uc-fade-in { animation: uc-fade-in 220ms ease-out both; }

        @keyframes uc-bloom {
          0% { transform: scale(0.6); opacity: 0.2; }
          40% { opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        @keyframes uc-pop {
          0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255,120,180,0.6); }
          60% { transform: scale(1.08); box-shadow: 0 0 60px 8px rgba(255,120,180,0.35); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,120,180,0); }
        }
        .animate-uc-pop { animation: uc-pop 700ms ease-out both; }

        @keyframes uc-unlock {
          0% { transform: scale(0.6) rotate(-12deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        .animate-uc-unlock { animation: uc-unlock 520ms cubic-bezier(.2,.9,.3,1.2) both; }

        @keyframes uc-label {
          from { opacity: 0; transform: translate(-50%, 6px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-uc-label { animation: uc-label 400ms ease-out 100ms both; }

        @keyframes uc-ribbon-in-top {
          from { transform: translate(-50%, -140%) rotate(-8deg); opacity: 0; }
          to   { transform: translate(-50%, -50%) rotate(-8deg); opacity: 1; }
        }
        @keyframes uc-ribbon-in-bottom {
          from { transform: translate(-50%, 40%) rotate(6deg); opacity: 0; }
          to   { transform: translate(-50%, -50%) rotate(6deg); opacity: 1; }
        }
        @keyframes uc-tear-top {
          0%   { transform: translate(-50%, -50%) rotate(-8deg) scaleY(1); }
          20%  { transform: translate(-52%, -52%) rotate(-9deg) scaleY(1); }
          100% { transform: translate(-160%, -180%) rotate(-28deg) scaleY(0.85); opacity: 0; }
        }
        @keyframes uc-tear-bottom {
          0%   { transform: translate(-50%, -50%) rotate(6deg) scaleY(1); }
          20%  { transform: translate(-48%, -48%) rotate(7deg) scaleY(1); }
          100% { transform: translate(60%, 180%) rotate(26deg) scaleY(0.85); opacity: 0; }
        }
        .uc-ribbon-top { animation: uc-ribbon-in-top 340ms ease-out both, uc-tear-top 900ms cubic-bezier(.4,.1,.6,1) 550ms both; }
        .uc-ribbon-bottom { animation: uc-ribbon-in-bottom 340ms ease-out both, uc-tear-bottom 900ms cubic-bezier(.4,.1,.6,1) 550ms both; }

        @keyframes uc-fall {
          0% { transform: translateY(0) rotate(0); opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function Ribbon({ side, torn }: { side: "top" | "bottom"; torn: boolean }) {
  // torn edge is faked with a repeating conic gradient on the edge
  const isTop = side === "top";
  return (
    <div
      className={`absolute left-1/2 top-1/2 ${
        torn ? (isTop ? "uc-ribbon-top" : "uc-ribbon-bottom") : "opacity-0"
      }`}
      style={{
        width: "160vw",
        maxWidth: "1400px",
      }}
    >
      <div
        className="relative h-14 flex items-center justify-center text-velvet font-semibold tracking-[0.5em] text-sm shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--petal) 92%, white 8%), color-mix(in oklab, var(--petal) 70%, black 8%))",
          clipPath: isTop
            ? "polygon(0 0, 100% 0, 100% 92%, 98% 100%, 94% 90%, 90% 100%, 86% 90%, 82% 100%, 78% 90%, 74% 100%, 70% 90%, 66% 100%, 62% 90%, 58% 100%, 54% 90%, 50% 100%, 46% 90%, 42% 100%, 38% 90%, 34% 100%, 30% 90%, 26% 100%, 22% 90%, 18% 100%, 14% 90%, 10% 100%, 6% 90%, 2% 100%, 0 92%)"
            : "polygon(0 8%, 2% 0, 6% 10%, 10% 0, 14% 10%, 18% 0, 22% 10%, 26% 0, 30% 10%, 34% 0, 38% 10%, 42% 0, 46% 10%, 50% 0, 54% 10%, 58% 0, 62% 10%, 66% 0, 70% 10%, 74% 0, 78% 10%, 82% 0, 86% 10%, 90% 0, 94% 10%, 98% 0, 100% 8%, 100% 100%, 0 100%)",
        }}
      >
        {/* repeating "LOCKED" text */}
        <div className="flex gap-8 whitespace-nowrap overflow-hidden px-4">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="flex items-center gap-3">
              <span>🔒</span>
              <span>LOCKED</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 42 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.35;
        const duration = 1.2 + Math.random() * 1.5;
        const emoji = ["💜", "🎉", "🌸", "💫", "❤️", "🐼", "✨"][i % 7];
        return (
          <span
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${left}%`,
              top: `-6%`,
              animation: `uc-fall ${duration}s ${delay}s linear forwards`,
            }}
          >
            {emoji}
          </span>
        );
      })}
    </div>
  );
}
