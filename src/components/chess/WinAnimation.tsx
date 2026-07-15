import { useEffect, useState } from "react";
import { sfx } from "@/lib/chess-sfx";

/**
 * Cinematic checkmate finish:
 *  0.0s  storm rolls in — rain, dark clouds, lightning flashes, screen shakes
 *  1.5s  sword flies in from the sky
 *  2.0s  slash — king's head flies off, blade streak flashes
 *  2.2s+ blood-red droplets rain, puddle spreads, "Victory" flourish
 */
export function WinAnimation({
  trigger,
  loserColor,
  muted = false,
  onDone,
}: {
  trigger: number | string | null;
  loserColor: "w" | "b" | null;
  muted?: boolean;
  onDone?: () => void;
}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!trigger || !loserColor) return;
    setPlaying(true);
    sfx.winCinematic({ muted });
    const t = window.setTimeout(() => {
      setPlaying(false);
      onDone?.();
    }, 5400);
    return () => window.clearTimeout(t);
  }, [trigger, loserColor, muted, onDone]);


  if (!playing || !loserColor) return null;

  const kingGlyph = loserColor === "w" ? "♔" : "♚";
  const kingColor = loserColor === "w" ? "#f5f5f5" : "#111";

  // Blood droplet splashes
  const splashes = Array.from({ length: 26 }).map((_, i) => ({
    left: (i * 37 + 11) % 100,
    delay: 2100 + ((i * 73) % 900),
    duration: 900 + ((i * 131) % 900),
    size: 8 + ((i * 17) % 22),
    drift: ((i * 53) % 40) - 20,
  }));

  // Red rain streaks (start after slash)
  const drops = Array.from({ length: 40 }).map((_, i) => ({
    left: (i * 53 + 7) % 100,
    delay: 2200 + ((i * 91) % 1400),
    duration: 700 + ((i * 61) % 700),
    height: 30 + ((i * 13) % 60),
  }));

  // Storm rain — plain grey/white drops falling from start
  const stormRain = Array.from({ length: 70 }).map((_, i) => ({
    left: (i * 29 + 3) % 100,
    delay: ((i * 47) % 1400),
    duration: 500 + ((i * 43) % 500),
    height: 40 + ((i * 11) % 70),
    opacity: 0.35 + ((i * 7) % 40) / 100,
  }));

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden animate-wa-fade"
      style={{ animation: "wa-fade 260ms ease-out both, wa-shake 5.2s cubic-bezier(.36,.07,.19,.97) both" }}
    >
      {/* Blur + darken backdrop */}
      <div className="absolute inset-0 bg-velvet/80 backdrop-blur-2xl" />

      {/* Storm cloud gradient — dark rolling top */}
      <div
        className="absolute inset-x-0 top-0 h-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 30% 0%, rgba(20,10,30,0.9), transparent 60%), radial-gradient(ellipse at 75% 10%, rgba(10,5,20,0.85), transparent 55%)",
          animation: "wa-clouds 5.2s ease-out both",
        }}
      />

      {/* Lightning flashes */}
      <div
        className="absolute inset-0 bg-white opacity-0"
        style={{ animation: "wa-flash-1 5.2s linear both" }}
      />
      <div
        className="absolute inset-0 bg-white opacity-0"
        style={{ animation: "wa-flash-2 5.2s linear both" }}
      />

      {/* Lightning bolts — jagged SVG strokes */}
      <svg
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ animation: "wa-bolt-a 5.2s linear both", filter: "drop-shadow(0 0 6px #fff) drop-shadow(0 0 14px #a5b4fc)" }}
      >
        <polyline points="18,0 22,18 15,28 26,44 20,60" fill="none" stroke="#fff" strokeWidth="0.35" />
      </svg>
      <svg
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ animation: "wa-bolt-b 5.2s linear both", filter: "drop-shadow(0 0 6px #fff) drop-shadow(0 0 14px #a5b4fc)" }}
      >
        <polyline points="78,0 74,20 82,32 70,48 76,64" fill="none" stroke="#fff" strokeWidth="0.35" />
      </svg>

      {/* Storm rain — falls from t=0 */}
      <div className="absolute inset-0">
        {stormRain.map((r, i) => (
          <span
            key={`sr${i}`}
            className="absolute top-0 block"
            style={{
              left: `${r.left}%`,
              width: "1.5px",
              height: `${r.height}px`,
              background: "linear-gradient(180deg, rgba(200,220,255,0), rgba(220,230,255,0.85))",
              borderRadius: "1px",
              opacity: r.opacity,
              animation: `wa-storm-rain ${r.duration}ms linear ${r.delay}ms infinite`,
              transform: "skewX(-8deg)",
            }}
          />
        ))}
      </div>

      {/* Radial red pulse (fires on slash) */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[80vmin] rounded-full blur-3xl opacity-0"
        style={{
          background:
            "radial-gradient(circle, rgba(220,38,38,0.55) 0%, rgba(220,38,38,0.15) 40%, transparent 70%)",
          animation: "wa-pulse 3.2s ease-out 1.95s both",
        }}
      />

      {/* King + sword stage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* King rises early — trembles during the storm */}
          <div
            className="relative"
            style={{
              animation:
                "wa-king-rise 0.9s cubic-bezier(.2,.9,.3,1.1) 0.1s both, wa-king-tremble 1.4s ease-in-out 1s both",
            }}
          >
            <div
              className="relative"
              style={{
                fontSize: "clamp(9rem, 32vmin, 20rem)",
                lineHeight: 1,
                color: kingColor,
                textShadow:
                  loserColor === "w"
                    ? "0 6px 24px rgba(0,0,0,0.7), 0 0 40px rgba(255,255,255,0.25)"
                    : "0 6px 24px rgba(0,0,0,0.9), 0 0 40px rgba(220,38,38,0.35)",
                filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.5))",
              }}
            >
              {/* Top half — slides up and rotates off */}
              <span
                aria-hidden
                className="absolute inset-0 block"
                style={{
                  clipPath: "inset(0 0 55% 0)",
                  animation: "wa-head-off 1.1s cubic-bezier(.5,.1,.7,1) 2.05s both",
                  transformOrigin: "center bottom",
                }}
              >
                {kingGlyph}
              </span>
              {/* Bottom half — stays and slumps slightly */}
              <span
                aria-hidden
                className="block"
                style={{
                  clipPath: "inset(45% 0 0 0)",
                  animation: "wa-body-slump 1.6s ease-out 2.1s both",
                  transformOrigin: "center bottom",
                }}
              >
                {kingGlyph}
              </span>

              {/* Slash line across the neck */}
              <span
                aria-hidden
                className="absolute left-[-10%] right-[-10%] top-[42%] h-[3px] origin-left"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,80,80,0), rgba(255,60,60,0.95), rgba(255,255,255,0.9), rgba(255,60,60,0.95), transparent)",
                  filter: "drop-shadow(0 0 12px rgba(255,60,60,0.9))",
                  animation: "wa-slash-line 0.5s ease-out 1.95s both",
                  transform: "scaleX(0)",
                }}
              />
            </div>
          </div>

          {/* Sword — appears from top and swings across */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              fontSize: "clamp(6rem, 20vmin, 14rem)",
              lineHeight: 1,
              animation: "wa-sword 0.8s cubic-bezier(.3,0,.6,1) 1.5s both",
              transformOrigin: "center center",
              filter:
                "drop-shadow(0 0 22px rgba(255,255,255,0.65)) drop-shadow(0 0 12px rgba(200,220,255,0.9))",
            }}
          >
            🗡️
          </div>

          {/* Blade streak flash */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center"
            style={{
              width: "120vmin",
              height: "6px",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), rgba(200,220,255,0.9), transparent)",
              filter: "blur(2px)",
              transform: "rotate(-28deg) scaleX(0)",
              animation: "wa-streak 0.4s ease-out 1.95s both",
            }}
          />
        </div>
      </div>

      {/* Red rain drops (after slash) */}
      <div className="absolute inset-0">
        {drops.map((d, i) => (
          <span
            key={`d${i}`}
            className="absolute top-0 block"
            style={{
              left: `${d.left}%`,
              width: "2px",
              height: `${d.height}px`,
              background: "linear-gradient(180deg, rgba(255,80,80,0), rgba(220,38,38,0.95))",
              borderRadius: "1px",
              opacity: 0,
              animation: `wa-rain ${d.duration}ms linear ${d.delay}ms infinite`,
              filter: "drop-shadow(0 0 4px rgba(220,38,38,0.7))",
            }}
          />
        ))}
      </div>

      {/* Splash droplets falling */}
      <div className="absolute inset-0">
        {splashes.map((s, i) => (
          <span
            key={`s${i}`}
            className="absolute"
            style={{
              left: `${s.left}%`,
              top: "-4%",
              width: `${s.size}px`,
              height: `${s.size}px`,
              borderRadius: "50% 50% 55% 45% / 45% 45% 60% 55%",
              background: "radial-gradient(circle at 35% 30%, #ff5c5c, #b91c1c 60%, #7f1d1d)",
              boxShadow: "0 0 12px rgba(220,38,38,0.6)",
              opacity: 0,
              ["--wa-drift" as string]: `${s.drift}px`,
              animation: `wa-drop ${s.duration}ms cubic-bezier(.4,.2,.7,1) ${s.delay}ms both`,
            }}
          />
        ))}
      </div>

      {/* Bottom bleed puddle */}
      <div
        className="absolute left-1/2 bottom-0 -translate-x-1/2 rounded-t-full opacity-0"
        style={{
          width: "70vmin",
          height: "16vmin",
          background:
            "radial-gradient(ellipse at center top, rgba(185,28,28,0.85), rgba(127,29,29,0.5) 60%, transparent 90%)",
          filter: "blur(6px)",
          animation: "wa-puddle 2.2s ease-out 2.4s both",
        }}
      />

      {/* Victory label */}
      <div
        className="absolute left-1/2 bottom-[12%] -translate-x-1/2 text-center opacity-0"
        style={{ animation: "wa-label 700ms ease-out 2.7s both" }}
      >
        <p className="text-[10px] uppercase tracking-[0.5em] text-red-300/90 font-semibold mb-1">Checkmate</p>
        <p className="font-serif italic text-4xl md:text-5xl text-white drop-shadow-[0_4px_20px_rgba(220,38,38,0.6)]">
          Victory
        </p>
      </div>

      <style>{`
        @keyframes wa-fade { from { opacity: 0; } to { opacity: 1; } }

        /* Screen shake — multiple thunder impacts */
        @keyframes wa-shake {
          0%, 100% { transform: translate(0, 0); }
          2%  { transform: translate(-6px, 4px); }
          4%  { transform: translate(5px, -3px); }
          6%  { transform: translate(-4px, 2px); }
          8%  { transform: translate(3px, -2px); }
          10% { transform: translate(0, 0); }
          22% { transform: translate(-8px, 5px); }
          24% { transform: translate(7px, -4px); }
          26% { transform: translate(-5px, 3px); }
          28% { transform: translate(0, 0); }
          /* Sword impact ~ 2.0s (38%) */
          37% { transform: translate(0, 0); }
          38% { transform: translate(-14px, 8px); }
          39% { transform: translate(12px, -7px); }
          40% { transform: translate(-9px, 5px); }
          41% { transform: translate(6px, -3px); }
          43% { transform: translate(-3px, 2px); }
          45% { transform: translate(0, 0); }
        }

        @keyframes wa-clouds {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 1; }
        }

        /* Two lightning tracks — quick bright bursts */
        @keyframes wa-flash-1 {
          0%, 6%   { opacity: 0; }
          7%       { opacity: 0.85; }
          9%       { opacity: 0; }
          10%      { opacity: 0.6; }
          12%      { opacity: 0; }
          100%     { opacity: 0; }
        }
        @keyframes wa-flash-2 {
          0%, 23%  { opacity: 0; }
          24%      { opacity: 0.95; }
          26%      { opacity: 0; }
          27%      { opacity: 0.7; }
          29%      { opacity: 0; }
          /* One more at the slash for punctuation */
          37%      { opacity: 0; }
          38%      { opacity: 1; }
          41%      { opacity: 0; }
          100%     { opacity: 0; }
        }
        @keyframes wa-bolt-a {
          0%, 6%   { opacity: 0; }
          7%       { opacity: 1; }
          10%      { opacity: 0; }
          100%     { opacity: 0; }
        }
        @keyframes wa-bolt-b {
          0%, 23%  { opacity: 0; }
          24%      { opacity: 1; }
          27%      { opacity: 0; }
          38%      { opacity: 1; }
          41%      { opacity: 0; }
          100%     { opacity: 0; }
        }

        @keyframes wa-storm-rain {
          0%   { transform: translateY(-15vh) skewX(-8deg); }
          100% { transform: translateY(120vh) skewX(-8deg); }
        }

        @keyframes wa-king-rise {
          0% { transform: translateY(40px) scale(0.85); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes wa-king-tremble {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, 2px); }
          80% { transform: translate(1px, -1px); }
        }
        @keyframes wa-sword {
          0%   { transform: translate(60vmin, -80vmin) rotate(-140deg) scale(1.05); opacity: 0; }
          25%  { opacity: 1; }
          55%  { transform: translate(0, 0) rotate(-28deg) scale(1.15); opacity: 1; }
          100% { transform: translate(-60vmin, 50vmin) rotate(45deg) scale(0.9); opacity: 0; }
        }
        @keyframes wa-streak {
          0% { transform: rotate(-28deg) scaleX(0); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: rotate(-28deg) scaleX(1); opacity: 0; }
        }
        @keyframes wa-slash-line {
          0% { transform: scaleX(0); opacity: 0; }
          40% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(1); opacity: 0; }
        }
        @keyframes wa-head-off {
          0%   { transform: translate(0, 0) rotate(0); opacity: 1; }
          20%  { transform: translate(-4%, -6%) rotate(-8deg); opacity: 1; }
          100% { transform: translate(-40%, 90%) rotate(-75deg); opacity: 0; }
        }
        @keyframes wa-body-slump {
          0%   { transform: translateY(0) rotate(0); }
          100% { transform: translateY(2%) rotate(3deg); }
        }
        @keyframes wa-pulse {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          40%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
        }
        @keyframes wa-drop {
          0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate(var(--wa-drift), 110vh) scale(1); opacity: 0.85; }
        }
        @keyframes wa-rain {
          0%   { transform: translateY(-10vh); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(115vh); opacity: 0.9; }
        }
        @keyframes wa-puddle {
          0% { opacity: 0; transform: translateX(-50%) scaleX(0.6); }
          100% { opacity: 1; transform: translateX(-50%) scaleX(1); }
        }
        @keyframes wa-label {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
