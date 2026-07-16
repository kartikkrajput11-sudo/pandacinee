import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

type KissBurst = { id: number; emoji: string };

export function KissOverlay({ trigger, emoji }: { trigger: number; emoji: string }) {
  const [bursts, setBursts] = useState<KissBurst[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const id = Date.now();
    setBursts((b) => [...b, { id, emoji: emoji || "💜" }]);
    const t = window.setTimeout(() => {
      setBursts((b) => b.filter((x) => x.id !== id));
    }, 2600);
    return () => window.clearTimeout(t);
  }, [trigger, emoji]);

  if (bursts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          {/* Radial flash */}
          <div
            className="absolute inset-0 animate-kiss-flash"
            style={{
              background:
                "radial-gradient(closest-side, rgba(236,72,153,0.28), rgba(236,72,153,0.10) 40%, transparent 70%)",
            }}
          />

          {/* Center smooch mark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="animate-kiss-smooch text-[120px] leading-none drop-shadow-[0_8px_30px_rgba(236,72,153,0.55)]">
              💋
            </span>
          </div>

          {/* Expanding heart ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="animate-kiss-ring rounded-full"
              style={{
                width: 140,
                height: 140,
                border: "2px solid rgba(236,72,153,0.6)",
                boxShadow: "0 0 40px rgba(236,72,153,0.5)",
              }}
            />
          </div>

          {/* Floating particles */}
          <div className="absolute inset-0 flex items-end justify-center pb-32">
            {Array.from({ length: 18 }).map((_, i) => {
              const kx = (Math.random() - 0.5) * 280;
              const kr = (Math.random() - 0.5) * 80;
              const delay = Math.random() * 500;
              const size = 22 + Math.random() * 34;
              const swayDur = 1.6 + Math.random() * 0.8;
              const kind = Math.random();
              return (
                <span
                  key={i}
                  className="absolute animate-kiss"
                  style={{
                    ["--kx" as any]: `${kx}px`,
                    ["--kr" as any]: `${kr}deg`,
                    fontSize: `${size}px`,
                    animationDelay: `${delay}ms`,
                  }}
                >
                  <span
                    className="inline-block animate-kiss-sway"
                    style={{ animationDuration: `${swayDur}s`, animationDelay: `${delay}ms` }}
                  >
                    {kind > 0.6 ? (
                      <Heart className="fill-petal text-petal" style={{ width: size, height: size }} />
                    ) : kind > 0.3 ? (
                      <span>{burst.emoji}</span>
                    ) : (
                      <span>💋</span>
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
