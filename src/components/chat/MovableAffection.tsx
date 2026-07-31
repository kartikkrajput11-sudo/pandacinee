import { useEffect, useRef, useState } from "react";

/**
 * MovableAffection — wraps an affection's main visual so the user can
 * pick it up and drag it anywhere on screen. It starts centered (or at
 * a given offset), stays interactive, and reports drops so overlays can
 * leave an imprint / replay their effect where it landed.
 */
export function MovableAffection({
  children,
  offsetY = 0,
  hint = "drag me",
  showHint = true,
  onDrop,
  className = "",
}: {
  children: React.ReactNode;
  offsetY?: number;
  hint?: string;
  showHint?: boolean;
  onDrop?: (x: number, y: number) => void;
  className?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);

  useEffect(() => {
    try {
      const set = () =>
        setPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 + offsetY });
      set();
      window.addEventListener("resize", set);
      return () => window.removeEventListener("resize", set);
    } catch (err) {
      console.error("[MovableAffection] failed to position", err);
      return;
    }
  }, [offsetY]);

  if (!pos) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={hint}
      className={`absolute pointer-events-auto touch-none select-none cursor-grab active:cursor-grabbing ${className}`}
      style={{
        left: pos.x,
        top: pos.y,
        transform: `translate(-50%,-50%) scale(${dragging ? 1.08 : 1})`,
        transition: dragging ? "none" : "transform 220ms ease",
        willChange: "left, top, transform",
      }}
      onPointerDown={(e) => {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          moved.current = false;
          setDragging(true);
        } catch (err) {
          console.error("[MovableAffection] pointer down failed", err);
        }
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        moved.current = true;
        setPos({ x: e.clientX, y: e.clientY });
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        try {
          if (moved.current) onDrop?.(e.clientX, e.clientY);
        } catch (err) {
          console.error("[MovableAffection] drop handler failed", err);
        }
      }}
      onPointerCancel={() => setDragging(false)}
    >
      {children}
      {showHint && (
        <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-[0.22em] text-candle/60">
          {hint}
        </span>
      )}
    </div>
  );
}
