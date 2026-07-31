import { useEffect, useState } from "react";
import { MovableAffection } from "./MovableAffection";
import pandaHug from "@/assets/panda-hug-sticker.png";

/**
 * Hug overlay — a warm panda-hug sticker pops in the center with
 * a soft champagne bloom and floating hearts.
 */

type Burst = { id: number };

export function HugOverlay({ trigger }: { trigger: number }) {
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
          {/* Warm ambient bloom */}
          <div
            className="absolute inset-0 animate-hug-bloom"
            style={{
              background:
                "radial-gradient(closest-side at 50% 50%, hsl(38 65% 62% / 0.28), hsl(340 55% 45% / 0.12) 45%, transparent 72%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Panda sticker */}
          <MovableAffection tint="rose">
            <img
              src={pandaHug}
              alt="two pandas hugging"
              width={260}
              height={260}
              className="animate-kiss-imprint select-none"
              style={{
                width: 260,
                height: 260,
                filter: "drop-shadow(0 14px 30px hsl(340 40% 20% / 0.45))",
              }}
              draggable={false}
            />
          </MovableAffection>

          {/* Caption */}
          <div className="absolute inset-x-0 top-[calc(50%+140px)] flex flex-col items-center gap-2 animate-kiss-caption">
            <div className="flex items-center gap-3 text-candle/80">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-candle/50" />
              <span className="size-1 rotate-45 bg-candle/60" />
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-candle/50" />
            </div>
            <p className="font-serif italic text-sm text-candle/90 tracking-wide">
              a warm hug
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
