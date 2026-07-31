import { useEffect, useState } from "react";

/**
 * AffectionStage (exported as MovableAffection for compatibility) —
 * a static, premium presentation frame for an affection's main visual.
 * It centers the sticker, wraps it in a slow rotating gilt halo, a soft
 * bloom and a glass plinth, then lets it breathe with a gentle float.
 * No dragging: the moment plays itself.
 */
export function MovableAffection({
  children,
  offsetY = 0,
  className = "",
  tint = "rose",
}: {
  children: React.ReactNode;
  offsetY?: number;
  /** kept for API compatibility — no longer used */
  hint?: string;
  showHint?: boolean;
  onDrop?: (x: number, y: number) => void;
  className?: string;
  tint?: "rose" | "red" | "gold";
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const hue =
    tint === "red"
      ? "0 85% 60%"
      : tint === "gold"
        ? "38 80% 62%"
        : "342 68% 62%";

  return (
    <div
      className={`absolute left-1/2 top-1/2 pointer-events-none select-none ${className}`}
      style={{
        transform: `translate(-50%, calc(-50% + ${offsetY}px))`,
      }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? "scale(1)" : "scale(0.82)",
          transition: "opacity 320ms ease, transform 520ms cubic-bezier(.22,1.4,.36,1)",
        }}
      >
        {/* Soft bloom */}
        <span
          aria-hidden
          className="absolute size-[22rem] rounded-full blur-2xl animate-affection-bloom"
          style={{ background: `radial-gradient(closest-side, hsl(${hue} / 0.28), transparent 70%)` }}
        />
        {/* Rotating gilt halo */}
        <span
          aria-hidden
          className="absolute size-64 rounded-full animate-affection-halo"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, hsl(${hue} / 0.55) 60deg, transparent 140deg, hsl(38 80% 70% / 0.4) 220deg, transparent 320deg)`,
            maskImage: "radial-gradient(closest-side, transparent 68%, #000 71%, #000 78%, transparent 81%)",
            WebkitMaskImage: "radial-gradient(closest-side, transparent 68%, #000 71%, #000 78%, transparent 81%)",
          }}
        />
        {/* Inner ring */}
        <span
          aria-hidden
          className="absolute size-52 rounded-full border animate-affection-ring"
          style={{ borderColor: `hsl(${hue} / 0.35)`, boxShadow: `0 0 40px hsl(${hue} / 0.25) inset` }}
        />
        {/* Subject */}
        <div className="relative animate-affection-float" style={{ filter: `drop-shadow(0 18px 34px hsl(${hue} / 0.35))` }}>
          {children}
        </div>
        {/* Glass plinth */}
        <span
          aria-hidden
          className="absolute -bottom-6 h-6 w-40 rounded-[50%] blur-md"
          style={{ background: `radial-gradient(closest-side, hsl(${hue} / 0.4), transparent 75%)` }}
        />
      </div>
    </div>
  );
}
