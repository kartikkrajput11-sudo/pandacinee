import { useEffect, useState } from "react";

/**
 * Wink overlay — a flirty wink with a sheen sweep and drifting sparks.
 */
export function WinkOverlay({ trigger }: { trigger: number }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    try {
      if ("vibrate" in navigator) navigator.vibrate?.(30);
    } catch (err) {
      console.error("[WinkOverlay] vibrate failed", err);
    }
    const t = window.setTimeout(() => setOn(false), 2200);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (!on) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <div
        className="absolute inset-0 animate-hug-bloom"
        style={{
          background:
            "radial-gradient(closest-side at 50% 50%, hsl(340 80% 70% / 0.24), transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-wink-sheen" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-7xl animate-wink-pop select-none" style={{ filter: "drop-shadow(0 10px 24px hsl(340 40% 20% / 0.5))" }}>
          😉
        </span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <span
              key={i}
              className="absolute size-1.5 rounded-full bg-petal animate-headpat-spark"
              style={{
                ["--dx" as string]: `${Math.cos(angle) * 100}px`,
                ["--dy" as string]: `${Math.sin(angle) * 100}px`,
                animationDelay: `${150 + i * 45}ms`,
                boxShadow: "0 0 8px hsl(340 90% 75% / 0.9)",
              }}
            />
          );
        })}
      </div>
      <div className="absolute inset-x-0 top-[calc(50%+130px)] flex justify-center animate-kiss-caption">
        <p className="font-serif italic text-sm text-candle/90 tracking-wide">wink 😉</p>
      </div>
    </div>
  );
}
