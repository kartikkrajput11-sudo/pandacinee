import { useEffect, useState } from "react";
import { MovableAffection } from "./MovableAffection";

/**
 * Headpat overlay — a gentle golden hand descends and pats, sending
 * soft champagne ripples and a "there, there" caption.
 */

type Burst = { id: number };

export function HeadpatOverlay({ trigger }: { trigger: number }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const id = Date.now();
    setBursts((b) => [...b, { id }]);
    const t = window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 3000);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (bursts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <div className="absolute inset-0 bg-velvet/50 backdrop-blur-md animate-fade-in" />
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          {/* Ambient champagne bloom */}
          <div
            className="absolute inset-0 animate-hug-bloom"
            style={{
              background:
                "radial-gradient(closest-side at 50% 50%, hsl(45 80% 68% / 0.28), hsl(320 45% 55% / 0.10) 45%, transparent 72%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Concentric ripples where the pat lands */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="absolute size-24 rounded-full border border-candle/40 animate-headpat-ripple" />
            <span
              className="absolute size-24 rounded-full border border-petal/50 animate-headpat-ripple"
              style={{ animationDelay: "180ms" }}
            />
            <span
              className="absolute size-24 rounded-full border border-candle/25 animate-headpat-ripple"
              style={{ animationDelay: "360ms" }}
            />
          </div>

          {/* Descending hand */}
          <MovableAffection tint="gold">
            <div
              className="animate-headpat-hand select-none text-[92px] leading-none"
              style={{
                filter: "drop-shadow(0 14px 22px hsl(340 40% 18% / 0.55)) drop-shadow(0 0 18px hsl(45 80% 65% / 0.35))",
              }}
            >
              ✋
            </div>
          </MovableAffection>

          {/* Sparkles */}
          <div className="absolute inset-0 flex items-center justify-center">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const dx = Math.cos(angle) * 90;
              const dy = Math.sin(angle) * 90;
              return (
                <span
                  key={i}
                  className="absolute size-1.5 rounded-full bg-candle animate-headpat-spark"
                  style={{
                    ["--dx" as string]: `${dx}px`,
                    ["--dy" as string]: `${dy}px`,
                    animationDelay: `${200 + i * 40}ms`,
                    boxShadow: "0 0 8px hsl(45 90% 70% / 0.9)",
                  }}
                />
              );
            })}
          </div>

          {/* Caption */}
          <div className="absolute inset-x-0 top-[calc(50%+130px)] flex flex-col items-center gap-2 animate-kiss-caption">
            <div className="flex items-center gap-3 text-candle/80">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-candle/50" />
              <span className="size-1 rotate-45 bg-candle/60" />
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-candle/50" />
            </div>
            <p className="font-serif italic text-sm text-candle/90 tracking-wide">
              there, there…
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
