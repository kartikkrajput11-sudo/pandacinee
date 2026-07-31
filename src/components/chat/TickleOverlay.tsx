import { useEffect, useState } from "react";
import { MovableAffection } from "./MovableAffection";
import pandaTickle from "@/assets/panda-tickle-sticker.png";

/**
 * Tickle overlay — a feather squiggles across the screen while
 * giggles float upward.
 */
export function TickleOverlay({ trigger }: { trigger: number }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    try {
      if ("vibrate" in navigator) navigator.vibrate?.([15, 25, 15, 25, 15, 25, 15]);
    } catch (err) {
      console.error("[TickleOverlay] vibrate failed", err);
    }
    const t = window.setTimeout(() => setOn(false), 6000);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (!on) return null;

  const laughs = ["😂", "🤣", "😆", "😹", "😝"];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <div className="absolute inset-0 bg-velvet/50 backdrop-blur-md animate-fade-in" />
      <div
        className="absolute inset-0 animate-hug-bloom"
        style={{
          background:
            "radial-gradient(closest-side at 50% 50%, hsl(48 90% 70% / 0.22), hsl(340 70% 65% / 0.10) 48%, transparent 74%)",
          mixBlendMode: "screen",
        }}
      />

      <MovableAffection hint="drag the tickle">
        <img
          src={pandaTickle}
          alt="pandas tickling"
          width={260}
          height={260}
          draggable={false}
          className="animate-kiss-imprint select-none"
          style={{ width: 260, height: 260, filter: "drop-shadow(0 14px 30px hsl(340 40% 20% / 0.45))" }}
        />
      </MovableAffection>

      <div className="absolute inset-0 flex items-end justify-center pb-24">
        {laughs.map((emo, i) => (
          <span
            key={i}
            className="absolute text-3xl animate-tickle-laugh select-none"
            style={{
              left: `${28 + i * 11}%`,
              ["--rot" as string]: `${(i % 2 ? 1 : -1) * (6 + i * 3)}deg`,
              animationDelay: `${i * 160}ms`,
            }}
          >
            {emo}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 top-[calc(50%+140px)] flex justify-center animate-kiss-caption">
        <p className="font-serif italic text-sm text-candle/90 tracking-wide">tickle tickle! 🪶</p>
      </div>
    </div>
  );
}
