import { useEffect, useState } from "react";

/**
 * HeartbeatOverlay — a live pulsing heart with concentric shockwaves.
 * Fires when the partner sends a Heartbeat Ping.
 */
export function HeartbeatOverlay({ trigger }: { trigger: number }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    try {
      if ("vibrate" in navigator) navigator.vibrate?.([90, 90, 90, 220, 90, 90]);
    } catch {
      /* haptics are optional */
    }
    const t = window.setTimeout(() => setOn(false), 3200);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (!on) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-velvet/50 backdrop-blur-md animate-fade-in" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute rounded-full border animate-heartbeat-wave"
              style={{
                width: 140,
                height: 140,
                borderColor: "hsl(342 70% 62% / 0.5)",
                animationDelay: `${i * 0.42}s`,
              }}
            />
          ))}
          <span
            className="text-[6.5rem] leading-none animate-heartbeat-pulse select-none"
            style={{ filter: "drop-shadow(0 0 34px hsl(342 80% 60% / 0.65))" }}
          >
            💗
          </span>
        </div>
      </div>
      <div className="absolute inset-x-0 top-[calc(50%+130px)] text-center animate-kiss-caption">
        <p className="font-serif italic text-sm text-petal/90">their heartbeat</p>
      </div>
    </div>
  );
}
