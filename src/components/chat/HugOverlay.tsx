import { useEffect, useState } from "react";

/**
 * Hug overlay — two warm crescents sweep in from opposite sides,
 * meet in the middle, and settle into an embracing ring with a
 * champagne bloom. Neutral, no figures, matches the site palette.
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

          {/* Two embracing arcs */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 240 240" width={260} height={260} aria-hidden>
              <defs>
                <linearGradient id="hugArcL" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(38 70% 74%)" />
                  <stop offset="100%" stopColor="hsl(340 65% 60%)" />
                </linearGradient>
                <linearGradient id="hugArcR" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38 70% 74%)" />
                  <stop offset="100%" stopColor="hsl(340 65% 60%)" />
                </linearGradient>
                <filter id="hugGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>

              {/* Soft halo */}
              <circle cx="120" cy="120" r="80" fill="hsl(38 60% 60% / 0.10)" className="animate-hug-halo" />

              {/* Left arc — sweeps from far left */}
              <g className="animate-hug-arc-l" style={{ transformOrigin: "120px 120px" }}>
                <path
                  d="M120 40
                     C 60 40, 30 90, 30 120
                     C 30 150, 60 200, 120 200"
                  fill="none"
                  stroke="url(#hugArcL)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  filter="url(#hugGlow)"
                  opacity="0.65"
                />
                <path
                  d="M120 40
                     C 60 40, 30 90, 30 120
                     C 30 150, 60 200, 120 200"
                  fill="none"
                  stroke="url(#hugArcL)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>

              {/* Right arc */}
              <g className="animate-hug-arc-r" style={{ transformOrigin: "120px 120px" }}>
                <path
                  d="M120 40
                     C 180 40, 210 90, 210 120
                     C 210 150, 180 200, 120 200"
                  fill="none"
                  stroke="url(#hugArcR)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  filter="url(#hugGlow)"
                  opacity="0.65"
                />
                <path
                  d="M120 40
                     C 180 40, 210 90, 210 120
                     C 210 150, 180 200, 120 200"
                  fill="none"
                  stroke="url(#hugArcR)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>

              {/* Central warm heart pulse */}
              <g className="animate-hug-core" style={{ transformOrigin: "120px 120px" }}>
                <path
                  d="M120 100
                     C 108 84, 84 92, 84 112
                     C 84 132, 108 148, 120 158
                     C 132 148, 156 132, 156 112
                     C 156 92, 132 84, 120 100 Z"
                  fill="hsl(340 62% 55%)"
                  filter="url(#hugGlow)"
                  opacity="0.55"
                />
                <path
                  d="M120 100
                     C 108 84, 84 92, 84 112
                     C 84 132, 108 148, 120 158
                     C 132 148, 156 132, 156 112
                     C 156 92, 132 84, 120 100 Z"
                  fill="hsl(38 70% 76%)"
                />
              </g>
            </svg>
          </div>

          {/* Expanding embrace ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="animate-hug-ring rounded-full"
              style={{
                width: 180,
                height: 180,
                border: "2px solid hsl(38 65% 68% / 0.55)",
                boxShadow: "0 0 40px hsl(38 60% 60% / 0.4)",
              }}
            />
          </div>

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
