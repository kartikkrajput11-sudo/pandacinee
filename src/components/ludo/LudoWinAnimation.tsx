import { useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { PLAYER_META, type Player } from "@/lib/ludo";

type Props = {
  trigger: number | string | null;
  winner: Player | null;
  onDone?: () => void;
};

/**
 * Luxury Ludo victory overlay — crown burst, gilded banner, and
 * token confetti in the winner's colour drifting across the stage.
 */
export function LudoWinAnimation({ trigger, winner, onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger == null || !winner) return;
    setVisible(true);
    const id = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 4200);
    return () => window.clearTimeout(id);
  }, [trigger, winner, onDone]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 34 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        dur: 2.4 + Math.random() * 1.6,
        size: 10 + Math.random() * 10,
        rot: Math.random() * 360,
        drift: (Math.random() - 0.5) * 40,
        i,
      })),
    [trigger],
  );

  if (!visible || !winner) return null;
  const meta = PLAYER_META[winner];

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
      {/* Ambient bloom */}
      <div
        className="absolute inset-0 animate-[ludo-win-bloom_1.6s_ease-out_forwards]"
        style={{
          background: `radial-gradient(60% 45% at 50% 45%, ${meta.color}55 0%, transparent 70%)`,
        }}
      />

      {/* Confetti tokens */}
      {confetti.map((c) => (
        <span
          key={c.i}
          className="absolute rounded-full animate-[ludo-win-confetti_var(--dur)_cubic-bezier(0.22,1,0.36,1)_forwards]"
          style={{
            left: `${c.left}%`,
            top: "-6%",
            width: c.size,
            height: c.size,
            background: `radial-gradient(circle at 32% 30%, #ffffffcc 0%, ${meta.color} 55%, ${meta.color}00 100%)`,
            boxShadow: `0 0 12px ${meta.color}bb`,
            transform: `rotate(${c.rot}deg)`,
            animationDelay: `${c.delay}s`,
            ["--dur" as any]: `${c.dur}s`,
            ["--drift" as any]: `${c.drift}vw`,
          }}
        />
      ))}

      {/* Centrepiece */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative animate-[ludo-win-pop_1s_cubic-bezier(0.22,1,0.36,1)_forwards]">
          {/* Halo */}
          <div
            className="absolute inset-0 rounded-full blur-2xl animate-[ludo-win-halo_2.8s_ease-in-out_infinite]"
            style={{ background: `${meta.color}66` }}
          />
          {/* Filigreed card */}
          <div
            className="relative px-8 py-6 rounded-3xl backdrop-blur-md text-center"
            style={{
              background:
                "linear-gradient(180deg, rgba(30,10,28,0.86) 0%, rgba(15,5,18,0.9) 100%)",
              border: `1px solid ${meta.color}77`,
              boxShadow: `0 24px 60px -20px ${meta.color}aa, inset 0 1px 0 rgba(255,255,255,0.12)`,
            }}
          >
            {/* gilded inner frame */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-[6px] rounded-[22px]"
              style={{
                border: "1px solid color-mix(in oklab, oklch(0.85 0.14 68) 55%, transparent)",
              }}
            />
            <div className="relative flex flex-col items-center gap-2">
              <div
                className="relative animate-[ludo-win-crown_1.6s_ease-out_forwards]"
                style={{ color: meta.color }}
              >
                <Crown className="size-14 drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]" strokeWidth={1.5} />
                <span
                  aria-hidden
                  className="absolute -inset-3 rounded-full animate-[ludo-win-sparkle_1.6s_ease-out_forwards]"
                  style={{
                    background: `radial-gradient(circle, ${meta.color}88 0%, transparent 60%)`,
                  }}
                />
              </div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-candle-muted">Victory</p>
              <h2 className="font-serif italic text-3xl" style={{ color: meta.color }}>
                {meta.emoji} {meta.name} wins
              </h2>
              <p className="text-xs text-candle-muted italic">sealed with a golden roll</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
