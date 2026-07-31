import { useEffect, useState } from "react";
import { MovableAffection } from "./MovableAffection";

/**
 * Anger overlay — a stormy "I'm mad at you" flare: red vignette,
 * throbbing anger mark, steam puffs and a short shake.
 */
export function AngerOverlay({ trigger }: { trigger: number }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    try {
      if ("vibrate" in navigator) navigator.vibrate?.([50, 30, 50, 30, 90]);
    } catch (err) {
      console.error("[AngerOverlay] vibrate failed", err);
    }
    const t = window.setTimeout(() => setOn(false), 6000);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (!on) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <div
        className="absolute inset-0 animate-anger-vignette"
        style={{
          background:
            "radial-gradient(closest-side at 50% 50%, transparent 40%, hsl(0 80% 45% / 0.25) 78%, hsl(0 80% 30% / 0.45))",
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-7xl animate-anger-throb select-none" style={{ filter: "drop-shadow(0 0 22px hsl(0 90% 55% / 0.7))" }}>
          😤
        </span>
        <span className="absolute -translate-x-16 -translate-y-14 text-4xl animate-anger-throb select-none">💢</span>
        <span className="absolute translate-x-16 -translate-y-12 text-3xl animate-anger-throb select-none" style={{ animationDelay: "120ms" }}>💢</span>
      </div>

      {/* Steam puffs */}
      <div className="absolute inset-0 flex items-center justify-center">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="absolute text-2xl animate-anger-steam select-none"
            style={{
              ["--dx" as string]: `${(i - 3) * 34}px`,
              ["--dy" as string]: `${-110 - (i % 3) * 40}px`,
              animationDelay: `${i * 110}ms`,
            }}
          >
            💨
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 top-[calc(50%+130px)] flex justify-center animate-kiss-caption">
        <p className="font-serif italic text-sm text-red-200/90 tracking-wide">hmph! I'm mad at you 💢</p>
      </div>
    </div>
  );
}
