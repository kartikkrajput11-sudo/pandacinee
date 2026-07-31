import { useEffect, useState } from "react";
import { MovableAffection } from "./MovableAffection";
import pandaBoop from "@/assets/panda-boop-sticker.png";

/**
 * Boop overlay — playful nose-to-nose panda sticker with a quick
 * bounce, pink bloom and radiating tap ripples.
 */

type Burst = { id: number };

export function BoopOverlay({ trigger }: { trigger: number }) {
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
          {/* Pink bloom */}
          <div
            className="absolute inset-0 animate-hug-bloom"
            style={{
              background:
                "radial-gradient(closest-side at 50% 50%, hsl(340 78% 68% / 0.30), hsl(20 70% 60% / 0.10) 45%, transparent 72%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Tap ripples */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="absolute size-24 rounded-full border border-petal/50 animate-headpat-ripple" />
            <span
              className="absolute size-24 rounded-full border border-candle/40 animate-headpat-ripple"
              style={{ animationDelay: "160ms" }}
            />
            <span
              className="absolute size-24 rounded-full border border-petal/30 animate-headpat-ripple"
              style={{ animationDelay: "320ms" }}
            />
          </div>

          {/* Sticker with a bouncy pop */}
          <MovableAffection tint="gold">
            <img
              src={pandaBoop}
              alt="two pandas booping noses"
              width={240}
              height={240}
              className="animate-kiss-imprint select-none"
              style={{
                width: 240,
                height: 240,
                filter: "drop-shadow(0 14px 26px hsl(340 40% 20% / 0.45))",
              }}
              draggable={false}
            />
          </MovableAffection>

          {/* Tiny sparks around */}
          <div className="absolute inset-0 flex items-center justify-center">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2 + 0.3;
              const dx = Math.cos(angle) * 96;
              const dy = Math.sin(angle) * 96;
              return (
                <span
                  key={i}
                  className="absolute size-1.5 rounded-full bg-petal animate-headpat-spark"
                  style={{
                    ["--dx" as string]: `${dx}px`,
                    ["--dy" as string]: `${dy}px`,
                    animationDelay: `${180 + i * 40}ms`,
                    boxShadow: "0 0 8px hsl(340 90% 75% / 0.9)",
                  }}
                />
              );
            })}
          </div>

          {/* Caption */}
          <div className="absolute inset-x-0 top-[calc(50%+140px)] flex flex-col items-center gap-2 animate-kiss-caption">
            <div className="flex items-center gap-3 text-candle/80">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-candle/50" />
              <span className="size-1 rotate-45 bg-candle/60" />
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-candle/50" />
            </div>
            <p className="font-serif italic text-sm text-candle/90 tracking-wide">
              boop! 👉
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
