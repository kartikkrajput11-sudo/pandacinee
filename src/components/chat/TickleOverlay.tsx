import { useEffect, useState } from "react";
import { MovableAffection } from "./MovableAffection";
import pandaTickle from "@/assets/panda-tickle-sticker.png";

/**
 * Tickle overlay — a feather squiggles across the screen while
 * giggles float upward.
 */
export function TickleOverlay({ trigger }: { trigger: number }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    try {
      if ("vibrate" in navigator) navigator.vibrate?.([15, 25, 15, 25, 15, 25, 15]);
    } catch (err) {
      console.error("[TickleOverlay] vibrate failed", err);
    }
    const t = window.setTimeout(() => setOn(false), 6000);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (!on) return null;

  const laughs = ["😂", "🤣", "😆", "😹", "😝", "🥹", "😄"];
  const feathers = [0, 1, 2, 3, 4];
  const sparks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <div className="absolute inset-0 bg-velvet/50 backdrop-blur-md animate-fade-in" />
      <div
        className="absolute inset-0 animate-hug-bloom"
        style={{
          background:
            "radial-gradient(closest-side at 50% 50%, hsl(48 90% 70% / 0.22), hsl(340 70% 65% / 0.10) 48%, transparent 74%)",
          mixBlendMode: "screen",
        }}
      />

      {/* giggle ripple rings behind the panda */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute rounded-full border animate-tickle-ring"
            style={{
              width: 220,
              height: 220,
              borderColor: "hsl(48 90% 72% / 0.45)",
              animationDelay: `${i * 550}ms`,
            }}
          />
        ))}
      </div>

      <MovableAffection hint="drag the tickle">
        <div className="relative">
          {/* orbiting feathers */}
          {feathers.map((i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-2xl select-none animate-tickle-orbit"
              style={{
                ["--r" as string]: `${110 + (i % 2) * 34}px`,
                ["--dur" as string]: `${3600 + i * 320}ms`,
                animationDelay: `${i * 180}ms`,
                marginLeft: -12,
                marginTop: -12,
              }}
            >
              🪶
            </span>
          ))}

          {/* sparkle burst */}
          {sparks.map((i) => {
            const a = (i / sparks.length) * Math.PI * 2;
            return (
              <span
                key={`s${i}`}
                className="absolute left-1/2 top-1/2 text-sm select-none animate-tickle-spark"
                style={{
                  ["--tx" as string]: `${Math.cos(a) * 150}px`,
                  ["--ty" as string]: `${Math.sin(a) * 150}px`,
                  animationDelay: `${120 + i * 60}ms`,
                }}
              >
                {i % 3 === 0 ? "✨" : i % 3 === 1 ? "·" : "🫧"}
              </span>
            );
          })}

          <img
            src={pandaTickle}
            alt="pandas tickling"
            width={260}
            height={260}
            draggable={false}
            className="animate-tickle-wiggle select-none relative"
            style={{ width: 260, height: 260, filter: "drop-shadow(0 14px 30px hsl(340 40% 20% / 0.45))" }}
          />
        </div>
      </MovableAffection>

      {/* floating giggle bubbles */}
      <div className="absolute inset-0 flex items-end justify-center pb-24">
        {laughs.map((emo, i) => (
          <span
            key={i}
            className="absolute text-3xl animate-tickle-laugh select-none"
            style={{
              left: `${18 + i * 10}%`,
              ["--rot" as string]: `${(i % 2 ? 1 : -1) * (6 + i * 3)}deg`,
              animationDelay: `${i * 160}ms`,
            }}
          >
            {emo}
          </span>
        ))}
        {["hehe", "hihi", "stop it!", "haha", "eek!"].map((txt, i) => (
          <span
            key={txt}
            className="absolute font-serif italic text-xs px-2.5 py-1 rounded-full border border-candle/25 bg-velvet/70 text-candle/90 animate-tickle-bubble select-none"
            style={{
              left: `${24 + i * 13}%`,
              bottom: `${10 + (i % 3) * 26}px`,
              ["--dx" as string]: `${(i % 2 ? 1 : -1) * (14 + i * 6)}px`,
              animationDelay: `${400 + i * 320}ms`,
            }}
          >
            {txt}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 top-[calc(50%+140px)] flex justify-center animate-kiss-caption">
        <p className="font-serif italic text-sm text-candle/90 tracking-wide">tickle tickle! 🪶</p>
      </div>
    </div>
  );
}
