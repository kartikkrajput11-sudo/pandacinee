import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

/**
 * Neutral, luxurious "kiss" overlay — a wax-seal insignia stamps down
 * with an ink bloom and drifting hearts. Matches the site's velvet /
 * champagne / petal palette. No lipstick, no emoji spam.
 */

type Burst = { id: number };

function WaxSeal({ size = 180 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id="sealFill" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="hsl(340 78% 68%)" />
          <stop offset="45%" stopColor="hsl(340 62% 48%)" />
          <stop offset="100%" stopColor="hsl(340 55% 26%)" />
        </radialGradient>
        <radialGradient id="sealRim" cx="50%" cy="50%" r="50%">
          <stop offset="85%" stopColor="hsl(38 65% 68%)" stopOpacity="0" />
          <stop offset="95%" stopColor="hsl(38 65% 72%)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(38 45% 55%)" stopOpacity="0.4" />
        </radialGradient>
        <filter id="sealBleed" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {/* Wax body with soft splash edge */}
      <g filter="url(#sealBleed)">
        <path
          d="M50 6
             C 62 8, 74 4, 82 14
             C 92 22, 92 38, 90 50
             C 96 60, 92 76, 80 84
             C 70 94, 56 90, 50 94
             C 44 92, 30 96, 20 86
             C 8 78, 6 62, 12 52
             C 6 40, 10 22, 20 14
             C 30 6, 40 10, 50 6 Z"
          fill="url(#sealFill)"
        />
      </g>

      {/* Champagne rim */}
      <circle cx="50" cy="50" r="38" fill="url(#sealRim)" />

      {/* Inner emblem: heart in filigree */}
      <g transform="translate(50 50)">
        <circle r="30" fill="none" stroke="hsl(38 65% 72% / 0.55)" strokeWidth="0.6" />
        <circle r="26" fill="none" stroke="hsl(38 65% 72% / 0.35)" strokeWidth="0.4" strokeDasharray="1 2" />
        <path
          d="M0 -10
             C -8 -20, -22 -14, -22 -2
             C -22 10, -8 18, 0 24
             C 8 18, 22 10, 22 -2
             C 22 -14, 8 -20, 0 -10 Z"
          fill="hsl(38 70% 78%)"
          opacity="0.95"
        />
        {/* Fleuron dots */}
        {[0, 90, 180, 270].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <circle cx="0" cy="-30" r="1.2" fill="hsl(38 65% 72%)" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function KissOverlay({ trigger }: { trigger: number; emoji?: string }) {
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
          {/* Ink bloom */}
          <div
            className="absolute inset-0 animate-kiss-vignette"
            style={{
              background:
                "radial-gradient(closest-side at 50% 50%, hsl(340 65% 48% / 0.28), hsl(340 55% 32% / 0.10) 45%, transparent 72%)",
              mixBlendMode: "screen",
            }}
          />
          {/* Champagne sheen */}
          <div
            className="absolute inset-0 animate-kiss-sheen"
            style={{
              background:
                "linear-gradient(115deg, transparent 40%, hsl(38 65% 72% / 0.16) 50%, transparent 60%)",
            }}
          />

          {/* Stamp */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="animate-kiss-imprint origin-center"
              style={{
                filter:
                  "drop-shadow(0 10px 26px hsl(340 70% 30% / 0.55)) drop-shadow(0 3px 8px hsl(340 60% 20% / 0.6))",
              }}
            >
              <WaxSeal size={200} />
            </div>
          </div>

          {/* Caption */}
          <div className="absolute inset-x-0 top-[calc(50%+130px)] flex flex-col items-center gap-2 animate-kiss-caption">
            <div className="flex items-center gap-3 text-petal/80">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-petal/60" />
              <span className="size-1 rotate-45 bg-petal/70" />
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-petal/60" />
            </div>
            <p className="font-serif italic text-sm text-candle/90 tracking-wide">
              sealed with a kiss
            </p>
          </div>

          {/* Drifting hearts — restrained */}
          <div className="absolute inset-0 flex items-end justify-center pb-24">
            {Array.from({ length: 6 }).map((_, i) => {
              const kx = (i - 2.5) * 55 + (Math.random() - 0.5) * 30;
              const kr = (Math.random() - 0.5) * 40;
              const delay = 300 + i * 160;
              const size = 22 + Math.random() * 20;
              return (
                <span
                  key={i}
                  className="absolute animate-kiss-drift"
                  style={{
                    ["--kx" as any]: `${kx}px`,
                    ["--kr" as any]: `${kr}deg`,
                    animationDelay: `${delay}ms`,
                  }}
                >
                  <Heart
                    className="fill-petal text-petal"
                    style={{
                      width: size,
                      height: size,
                      filter: "drop-shadow(0 3px 8px hsl(340 70% 30% / 0.55))",
                    }}
                  />
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
