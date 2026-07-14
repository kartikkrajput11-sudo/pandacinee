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
    }, 2400);
    return () => window.clearTimeout(t);
  }, [trigger, emoji]);

  if (bursts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0 flex items-end justify-center pb-32">
          {Array.from({ length: 14 }).map((_, i) => {
            const kx = (Math.random() - 0.5) * 220;
            const kr = (Math.random() - 0.5) * 60;
            const delay = Math.random() * 400;
            const size = 24 + Math.random() * 30;
            const isHeart = Math.random() > 0.4;
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
                {isHeart ? <Heart className="fill-petal text-petal" style={{ width: size, height: size }} /> : burst.emoji}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
