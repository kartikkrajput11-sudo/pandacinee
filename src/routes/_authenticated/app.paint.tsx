import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eraser, Download, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/paint")({
  component: PaintTogether,
});

type Stroke = {
  id: string;
  by: string;
  color: string;
  size: number;
  erase: boolean;
  pts: { x: number; y: number }[];
};

const COLORS = ["#1f1f1f", "#8b5cf6", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9", "#ffffff"];
const SIZES = [3, 6, 12, 22];

function PaintTogether() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState("#8b5cf6");
  const [size, setSize] = useState(6);
  const [erase, setErase] = useState(false);
  const strokes = useRef<Stroke[]>([]);
  const undone = useRef<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) drawStroke(ctx, s);
    if (drawing.current) drawStroke(ctx, drawing.current);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.beginPath();
    ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
    ctx.lineWidth = s.size;
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    const pts = s.pts;
    if (pts.length === 0) return;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  // realtime channel scoped to the pair
  useEffect(() => {
    if (!me) return;
    const key = partner ? [me.id, partner.id].sort().join(":") : me.id;
    const ch = supabase.channel(`paint:${key}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "stroke" }, ({ payload }) => {
      strokes.current.push(payload as Stroke);
      redraw();
    });
    ch.on("broadcast", { event: "clear" }, () => {
      strokes.current = [];
      undone.current = [];
      redraw();
    });
    ch.subscribe();
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [me?.id, partner?.id]);

  // size canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d");
      ctx?.scale(dpr, dpr);
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function pt(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e: React.PointerEvent) {
    if (!me) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = {
      id: crypto.randomUUID(),
      by: me.id,
      color,
      size,
      erase,
      pts: [pt(e)],
    };
    redraw();
  }
  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    drawing.current.pts.push(pt(e));
    redraw();
  }
  function onUp() {
    if (!drawing.current) return;
    const s = drawing.current;
    drawing.current = null;
    strokes.current.push(s);
    undone.current = [];
    chRef.current?.send({ type: "broadcast", event: "stroke", payload: s });
    redraw();
  }

  function undo() {
    const s = strokes.current.pop();
    if (s) undone.current.push(s);
    redraw();
    toast("Undo — local only");
  }
  function redo() {
    const s = undone.current.pop();
    if (s) {
      strokes.current.push(s);
      chRef.current?.send({ type: "broadcast", event: "stroke", payload: s });
    }
    redraw();
  }
  function clearAll() {
    strokes.current = [];
    undone.current = [];
    chRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
    redraw();
  }
  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `pandacine-paint-${Date.now()}.png`;
    a.click();
  }

  return (
    <div className="pt-10 px-4 pb-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/app/play" className="text-candle-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-petal">Multiplayer</p>
            <h1 className="font-serif text-2xl italic">Paint Together</h1>
          </div>
        </div>
        <span className="text-[10px] text-candle-muted">
          {partner ? "Live with partner" : "Solo — invite partner"}
        </span>
      </header>

      <div className="rounded-3xl overflow-hidden border border-border bg-white h-[60vh] touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="w-full h-full cursor-crosshair"
        />
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setErase(false); }}
              className={`size-8 rounded-full border-2 transition ${color === c && !erase ? "border-petal scale-110" : "border-border"}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <button
            onClick={() => setErase((e) => !e)}
            className={`size-8 rounded-full border-2 flex items-center justify-center ${erase ? "border-petal bg-petal-soft" : "border-border bg-surface"}`}
            aria-label="Eraser"
          >
            <Eraser className="size-4" />
          </button>
        </div>
        <div className="flex gap-2 items-center">
          {SIZES.map((n) => (
            <button
              key={n}
              onClick={() => setSize(n)}
              className={`size-9 rounded-full flex items-center justify-center border ${size === n ? "border-petal bg-petal-soft" : "border-border bg-surface"}`}
              aria-label={`Size ${n}`}
            >
              <span className="rounded-full bg-candle" style={{ width: n, height: n }} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={undo} className="flex-1 rounded-full bg-surface border border-border py-2.5 text-sm flex items-center justify-center gap-2">
            <RotateCcw className="size-4" /> Undo
          </button>
          <button onClick={redo} className="flex-1 rounded-full bg-surface border border-border py-2.5 text-sm flex items-center justify-center gap-2">
            <RotateCw className="size-4" /> Redo
          </button>
          <button onClick={download} className="flex-1 rounded-full bg-surface border border-border py-2.5 text-sm flex items-center justify-center gap-2">
            <Download className="size-4" /> Save
          </button>
          <button onClick={clearAll} className="rounded-full bg-petal text-white px-4 py-2.5 text-sm flex items-center gap-2">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
