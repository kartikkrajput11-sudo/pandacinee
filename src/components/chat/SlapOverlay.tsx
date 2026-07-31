import { useEffect, useRef, useState } from "react";

/**
 * Slap overlay — a *movable* slap. When it fires the palm swings in and
 * lands with a red imprint, a shockwave and an angry screen shake.
 * For a short window afterwards the palm stays draggable: drag it
 * anywhere and release to land another slap right where you dropped it.
 */

type Print = { id: number; x: number; y: number; rot: number };

export function SlapOverlay({ trigger }: { trigger: number }) {
  const [active, setActive] = useState(false);
  const [prints, setPrints] = useState<Print[]>([]);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [swing, setSwing] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);

  useEffect(() => {
    if (!trigger) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setActive(true);
    setPos(null);
    setSwing((s) => s + 1);
    // land the first slap once the swing arrives
    const t1 = window.setTimeout(() => land(cx, cy), 420);
    const t2 = window.setTimeout(() => setPos({ x: cx, y: cy }), 900);
    const t3 = window.setTimeout(() => { setActive(false); setPos(null); }, 7000);
    timers.current.push(t1, t2, t3);
    return () => { [t1, t2, t3].forEach(window.clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  function land(x: number, y: number) {
    try {
      const id = Date.now() + Math.random();
      setPrints((p) => [...p, { id, x, y, rot: -14 + Math.random() * 28 }]);
      if ("vibrate" in navigator) navigator.vibrate?.([70, 40, 30]);
      document.body.classList.add("animate-chat-shake");
      const off = window.setTimeout(() => document.body.classList.remove("animate-chat-shake"), 700);
      const clean = window.setTimeout(() => setPrints((p) => p.filter((q) => q.id !== id)), 1900);
      timers.current.push(off, clean);
    } catch (err) {
      console.error("[SlapOverlay] failed to land slap", err);
    }
  }

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden pointer-events-none">
      {/* Hot red flash */}
      <div
        className="absolute inset-0 animate-anger-vignette"
        style={{
          background:
            "radial-gradient(closest-side at 50% 50%, hsl(0 85% 55% / 0.22), hsl(0 70% 40% / 0.10) 45%, transparent 74%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Hand prints */}
      {prints.map((p) => (
        <div key={p.id} className="absolute" style={{ left: p.x, top: p.y, transform: "translate(-50%,-50%)" }}>
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-24 rounded-full border-2 border-red-400/70 animate-slap-shock"
            style={{ boxShadow: "0 0 30px hsl(0 90% 60% / 0.6)" }}
          />
          <span
            className="block text-6xl animate-slap-print select-none"
            style={{ filter: "drop-shadow(0 0 18px hsl(0 90% 55% / 0.7))", transform: `rotate(${p.rot}deg)` }}
          >
            🤚
          </span>
        </div>
      ))}

      {/* Swinging palm (first strike) */}
      {!pos && (
        <div key={swing} className="absolute inset-0 flex items-center justify-center">
          <span className="text-7xl animate-slap-swipe select-none" style={{ filter: "drop-shadow(0 10px 24px hsl(0 60% 20% / 0.6))" }}>
            ✋
          </span>
        </div>
      )}

      {/* Draggable palm — grab and fling for another slap */}
      {pos && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag the palm and release to slap again"
          className="absolute pointer-events-auto cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ left: pos.x, top: pos.y, transform: `translate(-50%,-50%) scale(${dragging ? 1.15 : 1})`, transition: dragging ? "none" : "transform 200ms ease" }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            setDragging(true);
          }}
          onPointerMove={(e) => { if (dragging) setPos({ x: e.clientX, y: e.clientY }); }}
          onPointerUp={(e) => {
            if (!dragging) return;
            setDragging(false);
            land(e.clientX, e.clientY);
          }}
          onPointerCancel={() => setDragging(false)}
        >
          <span className="block text-6xl" style={{ filter: "drop-shadow(0 8px 20px hsl(0 60% 20% / 0.6))" }}>✋</span>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-[0.22em] text-red-200/80">
            drag & release
          </span>
        </div>
      )}

      {/* Caption */}
      <div className="absolute inset-x-0 top-[calc(50%+150px)] flex flex-col items-center gap-2 animate-kiss-caption">
        <p className="font-serif italic text-sm text-red-200/90 tracking-wide">smack! 💢</p>
      </div>
    </div>
  );
}
