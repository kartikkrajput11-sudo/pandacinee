import { useEffect, useRef, useState } from "react";
import { Eraser, Trash2, X, Send, Undo2, Redo2 } from "lucide-react";

type Stroke = {
  color: string;
  size: number;
  erase: boolean;
  pts: { x: number; y: number }[];
};

// Full palette — each row is one hue from light to dark shade.
const PALETTE: string[][] = [
  ["#ffffff", "#e5e7eb", "#9ca3af", "#4b5563", "#1f2937", "#000000"],
  ["#fecaca", "#f87171", "#ef4444", "#dc2626", "#b91c1c", "#7f1d1d"],
  ["#fbcfe8", "#f9a8d4", "#ec4899", "#db2777", "#be185d", "#831843"],
  ["#fde68a", "#fcd34d", "#f59e0b", "#d97706", "#b45309", "#78350f"],
  ["#bbf7d0", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#14532d"],
  ["#bae6fd", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#0c4a6e"],
  ["#ddd6fe", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#4c1d95"],
  ["#f5d0b5", "#e0a878", "#c1783c", "#a16207", "#7c4a12", "#4a2c0a"],
];
const COLORS = PALETTE.flat();
const SIZES = [2, 4, 8, 14, 22, 34];


type Props = {
  open: boolean;
  onClose: () => void;
  onSend: (blob: Blob) => Promise<void> | void;
  sending?: boolean;
};

export function DoodlePad({ open, onClose, onSend, sending }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>(COLORS[1]);
  const [size, setSize] = useState<number>(SIZES[1]);
  const [erase, setErase] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);

  // Setup canvas + redraw whenever strokes change
  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    // Paint strokes
    for (const s of strokes) drawStroke(ctx, s);
    const live = drawingRef.current;
    if (live) drawStroke(ctx, live);
  }, [strokes, open]);

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.pts.length === 0) return;
    ctx.save();
    ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
    ctx.lineWidth = s.size;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x, s.pts[0].y);
    for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
    if (s.pts.length === 1) {
      // dot
      ctx.arc(s.pts[0].x, s.pts[0].y, s.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.erase ? "#ffffff" : s.color;
      ctx.fill();
    } else {
      ctx.stroke();
    }
    ctx.restore();
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = { color, size, erase, pts: [pointFromEvent(e)] };
    // Force redraw
    setStrokes((s) => [...s]);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current.pts.push(pointFromEvent(e));
    // live draw
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (ctx) drawStroke(ctx, drawingRef.current);
  }
  function onPointerUp() {
    if (!drawingRef.current) return;
    const s = drawingRef.current;
    drawingRef.current = null;
    setStrokes((prev) => [...prev, s]);
    setRedoStack([]);
  }

  function undo() {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  }
  function redo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setStrokes((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  }
  function clearAll() {
    setStrokes([]);
    setRedoStack([]);
  }

  async function send() {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(
      async (blob) => {
        if (!blob) return;
        await onSend(blob);
        setStrokes([]);
      },
      "image/png",
      0.92,
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-velvet/95 backdrop-blur flex flex-col animate-fade-in">
      <header className="px-4 pt-6 pb-3 border-b border-border bg-velvet/80 backdrop-blur flex items-center gap-2">
        <button
          onClick={onClose}
          className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle"
          aria-label="Cancel drawing"
        >
          <X className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">Locked chat · doodle</p>
          <h2 className="font-serif italic text-base leading-tight">Draw your submission 🖌️</h2>
        </div>
        <button
          onClick={send}
          disabled={sending || strokes.length === 0}
          className="h-9 px-4 rounded-full bg-petal text-velvet text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
        >
          <Send className="size-4" /> Send
        </button>
      </header>

      <div className="flex-1 p-3 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={900}
          height={1200}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="w-full max-w-md aspect-[3/4] rounded-2xl border border-border bg-white touch-none shadow-inner"
          style={{ touchAction: "none" }}
        />
      </div>

      <div className="px-3 pb-4 pt-2 border-t border-border bg-surface/60 backdrop-blur space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setErase(false); }}
              className={`size-7 rounded-full border-2 ${!erase && color === c ? "border-petal scale-110" : "border-border"}`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <button
            onClick={() => setErase((v) => !v)}
            className={`size-9 rounded-full border flex items-center justify-center ${erase ? "bg-petal border-petal text-velvet" : "bg-velvet border-border text-candle"}`}
            aria-label="Eraser"
            title="Eraser"
          >
            <Eraser className="size-4" />
          </button>
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="size-9 rounded-full border border-border bg-velvet text-candle flex items-center justify-center disabled:opacity-40"
            aria-label="Undo"
            title="Undo"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="size-9 rounded-full border border-border bg-velvet text-candle flex items-center justify-center disabled:opacity-40"
            aria-label="Redo"
            title="Redo"
          >
            <Redo2 className="size-4" />
          </button>
          <button
            onClick={clearAll}
            disabled={strokes.length === 0}
            className="size-9 rounded-full border border-border bg-velvet text-candle flex items-center justify-center disabled:opacity-40"
            aria-label="Clear"
            title="Clear"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-candle-muted">Brush</span>
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`size-9 rounded-full border flex items-center justify-center ${size === s ? "border-petal bg-petal-soft/40" : "border-border bg-velvet"}`}
              aria-label={`Size ${s}`}
            >
              <span
                className="rounded-full"
                style={{
                  width: Math.min(s, 20),
                  height: Math.min(s, 20),
                  background: erase ? "#ffffff" : color,
                  border: erase ? "1px solid #d4d4d8" : undefined,
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
