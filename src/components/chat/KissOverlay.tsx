import { useEffect, useState } from "react";

type KissBurst = { id: number };

/**
 * Lipstick imprint on velvet — a hand-drawn kiss mark in petal ink,
 * with a soft bloom and slow, sensual timing. Matches the site's
 * velvet/petal/champagne palette.
 */
function LipMark({ size = 160, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 100 80"
      width={size}
      height={size * 0.8}
      style={{ opacity }}
      aria-hidden
    >
      <defs>
        <radialGradient id="lipInk" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="hsl(340 78% 62%)" />
          <stop offset="55%" stopColor="hsl(340 65% 48%)" />
          <stop offset="100%" stopColor="hsl(340 55% 32%)" />
        </radialGradient>
        <filter id="lipBleed" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <filter id="lipGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Soft outer bloom */}
      <g filter="url(#lipGlow)" opacity="0.55">
        <path
          d="M50 22 C 40 6, 18 8, 14 26 C 12 38, 28 52, 50 60 C 72 52, 88 38, 86 26 C 82 8, 60 6, 50 22 Z"
          fill="hsl(340 70% 55%)"
        />
      </g>

      {/* Upper lip */}
      <path
        d="M50 24
           C 46 14, 36 10, 28 14
           C 20 18, 16 26, 18 30
           C 22 26, 30 24, 36 28
           C 42 30, 46 30, 50 26
           C 54 30, 58 30, 64 28
           C 70 24, 78 26, 82 30
           C 84 26, 80 18, 72 14
           C 64 10, 54 14, 50 24 Z"
        fill="url(#lipInk)"
        filter="url(#lipBleed)"
      />

      {/* Lower lip */}
      <path
        d="M18 32
           C 22 46, 34 58, 50 62
           C 66 58, 78 46, 82 32
           C 74 34, 64 32, 58 30
           C 54 32, 46 32, 42 30
           C 36 32, 26 34, 18 32 Z"
        fill="url(#lipInk)"
        filter="url(#lipBleed)"
      />

      {/* Cupid's bow highlight */}
      <path
        d="M46 22 C 48 20, 52 20, 54 22"
        stroke="hsl(340 90% 82%)"
        strokeWidth="0.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* Micro creases on lower lip */}
      {[28, 36, 44, 52, 60, 68].map((x) => (
        <path
          key={x}
          d={`M${x} 36 Q ${x + 1} ${44 + (x % 3)} ${x + 2} 50`}
          stroke="hsl(340 40% 22%)"
          strokeWidth="0.35"
          fill="none"
          opacity="0.35"
        />
      ))}
    </svg>
  );
}

export function KissOverlay({ trigger, emoji }: { trigger: number; emoji: string }) {
  const [bursts, setBursts] = useState<KissBurst[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const id = Date.now();
    setBursts((b) => [...b, { id }]);
    const t = window.setTimeout(() => {
      setBursts((b) => b.filter((x) => x.id !== id));
    }, 3200);
    return () => window.clearTimeout(t);
    // emoji intentionally unused — the lip mark carries the meaning
  }, [trigger]);

  if (bursts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          {/* Vignette bloom in petal ink */}
          <div
            className="absolute inset-0 animate-kiss-vignette"
            style={{
              background:
                "radial-gradient(closest-side at 50% 50%, hsl(340 65% 48% / 0.28), hsl(340 55% 32% / 0.10) 45%, transparent 72%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Champagne sheen sweep */}
          <div
            className="absolute inset-0 animate-kiss-sheen"
            style={{
              background:
                "linear-gradient(115deg, transparent 40%, hsl(38 65% 72% / 0.14) 50%, transparent 60%)",
            }}
          />

          {/* The imprint — center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-kiss-imprint origin-center">
              <div
                style={{
                  filter:
                    "drop-shadow(0 8px 24px hsl(340 70% 40% / 0.55)) drop-shadow(0 2px 6px hsl(340 60% 20% / 0.6))",
                }}
              >
                <LipMark size={200} />
              </div>
            </div>
          </div>

          {/* Faint filigree caption */}
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

          {/* Small trailing imprints drifting up — restrained, no emoji spam */}
          <div className="absolute inset-0 flex items-end justify-center pb-24">
            {Array.from({ length: 5 }).map((_, i) => {
              const kx = (i - 2) * 60 + (Math.random() - 0.5) * 30;
              const kr = (Math.random() - 0.5) * 40;
              const delay = 400 + i * 180;
              const size = 34 + Math.random() * 22;
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
                  <LipMark size={size} opacity={0.55} />
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
