import { useEffect, useState } from "react";

type Burst = { id: number };

const CONFETTI_COLORS = ["#e879a5", "#facc15", "#7dd3fc", "#c084fc", "#65d4a3", "#ffa07a"];

export function ConfettiBurst({ trigger }: { trigger: number }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const id = Date.now();
    setBursts((b) => [...b, { id }]);
    const t = window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2200);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (bursts.length === 0) return null;
  return (
    <>
      {bursts.map((burst) => (
        <div key={burst.id} className="perk-confetti">
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              style={{
                left: `${Math.random() * 100}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${Math.random() * 300}ms`,
                animationDuration: `${1.4 + Math.random() * 0.9}s`,
              }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function PetalRain({ trigger }: { trigger: number }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const id = Date.now();
    setBursts((b) => [...b, { id }]);
    const t = window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 5200);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (bursts.length === 0) return null;
  return (
    <>
      {bursts.map((burst) => (
        <div key={burst.id} className="perk-petal-rain">
          {Array.from({ length: 22 }).map((_, i) => (
            <span
              key={i}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1200}ms`,
                animationDuration: `${4 + Math.random() * 2}s`,
                fontSize: `${14 + Math.random() * 14}px`,
              }}
            >
              🌸
            </span>
          ))}
        </div>
      ))}
    </>
  );
}
