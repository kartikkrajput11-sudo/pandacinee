import { useEffect, useState } from "react";
import pandaHandhold from "@/assets/panda-handhold-sticker.png";

/**
 * Handhold overlay — pandas-holding-hands sticker with a lavender bloom
 * and floating pearl-string sparkles. Mirrors HugOverlay in feel.
 */

type Burst = { id: number };

export function HandholdOverlay({ trigger }: { trigger: number }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const id = Date.now();
    setBursts((b) => [...b, { id }]);
    const t = window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2800);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (bursts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          {/* Lavender bloom */}
          <div
            className="absolute inset-0 animate-hug-bloom"
            style={{
              background:
                "radial-gradient(closest-side at 50% 50%, hsl(275 65% 68% / 0.28), hsl(320 45% 55% / 0.10) 45%, transparent 72%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Sticker */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={pandaHandhold}
              alt="two pandas holding hands"
              width={260}
              height={260}
              className="animate-kiss-imprint select-none"
              style={{
                width: 260,
                height: 260,
                filter: "drop-shadow(0 14px 30px hsl(275 40% 20% / 0.45))",
              }}
              draggable={false}
            />
          </div>

          {/* Pearl-string sparkles */}
          <div className="absolute inset-0 flex items-center justify-center">
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i / 10) * Math.PI * 2;
              const dx = Math.cos(angle) * 110;
              const dy = Math.sin(angle) * 110;
              return (
                <span
                  key={i}
                  className="absolute size-1.5 rounded-full bg-candle animate-headpat-spark"
                  style={{
                    ["--dx" as string]: `${dx}px`,
                    ["--dy" as string]: `${dy}px`,
                    animationDelay: `${240 + i * 45}ms`,
                    boxShadow: "0 0 8px hsl(275 80% 78% / 0.9)",
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
              fingers laced softly
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
