import { useEffect, useState } from "react";
import { MovableAffection } from "./MovableAffection";


/**
 * Kiss overlay — a realistic soft lip imprint smooches down at
 * center with an ink bloom and a subtle sheen, then a few small
 * imprints drift up. Neutral petal/velvet palette.
 */

type Burst = { id: number };

function LipMark({ size = 180, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={{ opacity }}>
      <defs>
        <radialGradient id="lipInk" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="hsl(340 82% 58%)" />
          <stop offset="60%" stopColor="hsl(340 70% 44%)" />
          <stop offset="100%" stopColor="hsl(340 60% 28%)" />
        </radialGradient>
        <filter id="lipBleed" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <filter id="lipGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* Soft glow bleed */}
      <g filter="url(#lipGlow)" opacity="0.55">
        <path
          d="M50 42
             C 40 32, 22 30, 18 42
             C 16 50, 26 54, 34 54
             C 40 54, 46 52, 50 50
             C 54 52, 60 54, 66 54
             C 74 54, 84 50, 82 42
             C 78 30, 60 32, 50 42 Z
             M 20 54
             C 26 66, 40 72, 50 66
             C 60 72, 74 66, 80 54
             C 72 60, 60 62, 50 58
             C 40 62, 28 60, 20 54 Z"
          fill="url(#lipInk)"
        />
      </g>

      {/* Main imprint */}
      <g filter="url(#lipBleed)">
        {/* Upper lip */}
        <path
          d="M50 42
             C 40 32, 22 30, 18 42
             C 16 50, 26 54, 34 54
             C 40 54, 46 52, 50 50
             C 54 52, 60 54, 66 54
             C 74 54, 84 50, 82 42
             C 78 30, 60 32, 50 42 Z"
          fill="url(#lipInk)"
        />
        {/* Lower lip */}
        <path
          d="M 20 54
             C 26 66, 40 72, 50 66
             C 60 72, 74 66, 80 54
             C 72 60, 60 62, 50 58
             C 40 62, 28 60, 20 54 Z"
          fill="url(#lipInk)"
        />
      </g>

      {/* Micro creases on lower lip */}
      <g stroke="hsl(340 60% 30% / 0.45)" strokeWidth="0.4" fill="none">
        <path d="M32 60 C 34 63, 34 65, 33 67" />
        <path d="M40 62 C 41 65, 41 67, 40 69" />
        <path d="M50 62 C 50 66, 50 68, 50 70" />
        <path d="M60 62 C 59 65, 59 67, 60 69" />
        <path d="M68 60 C 66 63, 66 65, 67 67" />
      </g>
    </svg>
  );
}

export function KissOverlay({ trigger }: { trigger: number }) {
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

          {/* Main lip imprint — draggable */}
          <MovableAffection tint="rose">
            <div
              className="animate-kiss-imprint origin-center"
              style={{
                filter:
                  "drop-shadow(0 10px 26px hsl(340 70% 30% / 0.55)) drop-shadow(0 3px 8px hsl(340 60% 20% / 0.6))",
              }}
            >
              <LipMark size={200} />
            </div>
          </MovableAffection>


          {/* Drifting small imprints */}
          <div className="absolute inset-0 flex items-end justify-center pb-24">
            {Array.from({ length: 5 }).map((_, i) => {
              const kx = (i - 2) * 60 + (Math.random() - 0.5) * 30;
              const kr = (Math.random() - 0.5) * 40;
              const delay = 320 + i * 180;
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
                  <LipMark size={size} opacity={0.85} />
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
