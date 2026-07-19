import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Eraser,
  Download,
  Palette,
  RotateCcw,
  RotateCw,
  Trash2,
  Sparkles,
  X,
  Share2,
  Sticker,
  Image as ImageIcon,
  BookOpen,
  Play,
  Save,
  Shapes,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { GameChat } from "@/components/games/GameChat";

export const Route = createFileRoute("/_authenticated/app/paint")({
  component: PaintTogether,
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
});

type ShapeKind = "line" | "rect" | "oval" | "triangle" | "heart" | "star";

type Stroke = {
  id: string;
  by: string;
  color: string;
  size: number;
  erase: boolean;
  pts: { x: number; y: number }[];
  stamp?: string; // emoji stamp, if this is a stamp stroke
  shape?: ShapeKind; // shape kind, if this is a shape stroke
  fill?: boolean;    // shape fill vs outline
  ts?: number;    // draw timestamp (ms) for replay ordering
};

const COLORS = ["#1f1f1f", "#8b5cf6", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9", "#ffffff"];
const SIZES = [3, 6, 12, 22];
const STAMPS = ["💜", "💗", "✨", "🌸", "🦋", "🐼", "⭐", "🌙", "🍓", "☁️"];
const SHAPES: { key: ShapeKind; label: string }[] = [
  { key: "line", label: "Line" },
  { key: "rect", label: "Rect" },
  { key: "oval", label: "Oval" },
  { key: "triangle", label: "Triangle" },
  { key: "heart", label: "Heart" },
  { key: "star", label: "Star" },
];

type Bg = {
  key: string;
  label: string;
  css: string;
};
const BACKGROUNDS: Bg[] = [
  { key: "white", label: "Blank", css: "#ffffff" },
  {
    key: "paper",
    label: "Paper",
    css:
      "repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgba(0,0,0,0.02) 0 1px, transparent 1px 24px), #fbf7ee",
  },
  {
    key: "blush",
    label: "Blush",
    css:
      "radial-gradient(1200px 600px at 20% 0%, #ffe1ee, transparent 60%), radial-gradient(900px 500px at 100% 100%, #ffe9c7, transparent 55%), #fff7fb",
  },
  {
    key: "watercolor",
    label: "Watercolor",
    css:
      "radial-gradient(600px 400px at 10% 20%, rgba(139,92,246,0.25), transparent 60%), radial-gradient(500px 400px at 90% 30%, rgba(236,72,153,0.22), transparent 60%), radial-gradient(700px 500px at 50% 100%, rgba(14,165,233,0.18), transparent 60%), #fefcfa",
  },
  {
    key: "night",
    label: "Night sky",
    css:
      "radial-gradient(600px 400px at 20% 20%, rgba(139,92,246,0.5), transparent 60%), radial-gradient(500px 400px at 80% 30%, rgba(14,165,233,0.35), transparent 60%), #0b0620",
  },
  {
    key: "dots",
    label: "Dots",
    css:
      "radial-gradient(rgba(139,92,246,0.15) 1.5px, transparent 1.5px) 0 0/22px 22px, #fdfaff",
  },
];

function drawShape(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fill: boolean,
) {
  ctx.beginPath();
  if (kind === "line") {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return;
  }
  if (kind === "rect") {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.rect(x, y, w, h);
  } else if (kind === "oval") {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else if (kind === "triangle") {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else if (kind === "heart") {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    const cx = x + w / 2;
    const top = y + h * 0.28;
    ctx.moveTo(cx, y + h);
    ctx.bezierCurveTo(x - w * 0.1, y + h * 0.6, x + w * 0.1, y, cx, top);
    ctx.bezierCurveTo(x + w * 0.9, y, x + w * 1.1, y + h * 0.6, cx, y + h);
    ctx.closePath();
  } else if (kind === "star") {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const R = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;
    const r = R * 0.42;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? R : r;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  if (fill) ctx.fill();
  else ctx.stroke();
}

type RemoteCursor = { x: number; y: number; color: string; name: string; ts: number };

function PaintTogether() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState("#8b5cf6");
  const [size, setSize] = useState(6);
  const [erase, setErase] = useState(false);
  const [stampMode, setStampMode] = useState<string | null>(null);
  const [shapeMode, setShapeMode] = useState<ShapeKind | null>(null);
  const [fillShape, setFillShape] = useState(false);
  const [bg, setBg] = useState<string>("white");
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [stampsOpen, setStampsOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);

  const strokes = useRef<Stroke[]>([]);
  const undone = useRef<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const liveRemote = useRef<Map<string, Stroke>>(new Map());
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const liveThrottle = useRef<number>(0);
  const cursorThrottle = useRef<number>(0);

  const [reveal, setReveal] = useState<{ image: string; by: string } | null>(null);
  const [remoteCursor, setRemoteCursor] = useState<RemoteCursor | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const bgCss = BACKGROUNDS.find((b) => b.key === bg)?.css ?? "#ffffff";

  function pairKey() {
    if (!me) return "";
    return partner ? [me.id, partner.id].sort().join(":") : me.id;
  }

  // --- Drawing ---------------------------------------------------------------

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) drawStroke(ctx, s);
    for (const s of liveRemote.current.values()) drawStroke(ctx, s);
    if (drawing.current) drawStroke(ctx, drawing.current);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (s.stamp) {
      const p = s.pts[0];
      if (!p) return;
      const px = Math.max(28, s.size * 4 * (w / 400));
      ctx.font = `${px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.stamp, p.x * w, p.y * h);
      return;
    }
    if (s.shape && s.pts.length >= 2) {
      const a = s.pts[0];
      const b = s.pts[s.pts.length - 1];
      ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.size * (w / 400);
      ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
      drawShape(ctx, s.shape, a.x * w, a.y * h, b.x * w, b.y * h, !!s.fill);
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    ctx.beginPath();
    ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
    ctx.lineWidth = s.size * (w / 400);
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    const pts = s.pts;
    if (pts.length === 0) return;
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  // --- Realtime + persistence -----------------------------------------------

  useEffect(() => {
    if (!me) return;
    const key = pairKey();

    // Load previously saved strokes so the canvas is never blank.
    (async () => {
      const { data: rows, error } = await supabase
        .from("paint_strokes")
        .select("stroke, created_at")
        .eq("pair_key", key)
        .order("created_at", { ascending: true });
      if (!error && rows) {
        const existing = new Set(strokes.current.map((s) => s.id));
        for (const r of rows) {
          const s = r.stroke as Stroke;
          if (!existing.has(s.id)) strokes.current.push(s);
        }
        redraw();
      }
    })();

    // Load background preference for this pair (local; broadcast keeps it in sync live).
    const savedBg = typeof window !== "undefined" ? localStorage.getItem(`paint_bg:${key}`) : null;
    if (savedBg && BACKGROUNDS.some((b) => b.key === savedBg)) setBg(savedBg);

    const ch = supabase.channel(`paint:${key}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "stroke-start" }, ({ payload }) => {
      const s = payload as Stroke;
      liveRemote.current.set(s.id, { ...s, pts: [...s.pts] });
      redraw();
    });
    ch.on("broadcast", { event: "stroke-point" }, ({ payload }) => {
      const p = payload as { id: string; pts: { x: number; y: number }[] };
      const existing = liveRemote.current.get(p.id);
      if (existing) existing.pts.push(...p.pts);
      redraw();
    });
    ch.on("broadcast", { event: "stroke" }, ({ payload }) => {
      const s = payload as Stroke;
      liveRemote.current.delete(s.id);
      if (!strokes.current.some((x) => x.id === s.id)) strokes.current.push(s);
      redraw();
    });
    ch.on("broadcast", { event: "undo" }, ({ payload }) => {
      const id = (payload as { id: string }).id;
      const idx = strokes.current.findIndex((s) => s.id === id);
      if (idx >= 0) strokes.current.splice(idx, 1);
      redraw();
    });
    ch.on("broadcast", { event: "reveal" }, ({ payload }) => {
      setReveal(payload as { image: string; by: string });
    });
    ch.on("broadcast", { event: "bg" }, ({ payload }) => {
      const p = payload as { key: string };
      if (BACKGROUNDS.some((b) => b.key === p.key)) {
        setBg(p.key);
        try { localStorage.setItem(`paint_bg:${key}`, p.key); } catch { /* ignore */ }
      }
    });
    ch.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const p = payload as RemoteCursor;
      setRemoteCursor(p);
    });
    ch.subscribe();
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, partner?.id]);

  // Fade out the remote cursor when it stops moving.
  useEffect(() => {
    if (!remoteCursor) return;
    const t = setTimeout(() => {
      setRemoteCursor((cur) => (cur && Date.now() - cur.ts > 900 ? null : cur));
    }, 1200);
    return () => clearTimeout(t);
  }, [remoteCursor]);

  // Canvas sizing
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pt(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  function placeStamp(e: React.PointerEvent) {
    if (!me || !stampMode) return;
    const p = pt(e);
    const s: Stroke = {
      id: crypto.randomUUID(),
      by: me.id,
      color,
      size,
      erase: false,
      pts: [p],
      stamp: stampMode,
      ts: Date.now(),
    };
    strokes.current.push(s);
    undone.current = [];
    chRef.current?.send({ type: "broadcast", event: "stroke", payload: s });
    supabase
      .from("paint_strokes")
      .insert({ id: s.id, pair_key: pairKey(), by_user: s.by, stroke: s })
      .then(({ error }) => { if (error) console.warn("paint save:", error.message); });
    redraw();
  }

  function onDown(e: React.PointerEvent) {
    if (!me) return;
    if (stampMode) {
      placeStamp(e);
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    const start = pt(e);
    const s: Stroke = {
      id: crypto.randomUUID(),
      by: me.id,
      color,
      size,
      erase,
      pts: shapeMode ? [start, start] : [start],
      ts: Date.now(),
      ...(shapeMode ? { shape: shapeMode, fill: fillShape } : {}),
    };
    drawing.current = s;
    chRef.current?.send({ type: "broadcast", event: "stroke-start", payload: s });
    liveThrottle.current = 0;
    redraw();
  }

  function onMove(e: React.PointerEvent) {
    const p = pt(e);
    // Broadcast cursor position (throttled), even when not drawing
    const now = performance.now();
    if (now - cursorThrottle.current > 60) {
      cursorThrottle.current = now;
      chRef.current?.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          x: p.x,
          y: p.y,
          color,
          name: me?.display_name ?? "Partner",
          ts: Date.now(),
        } satisfies RemoteCursor,
      });
    }
    if (!drawing.current) return;
    if (drawing.current.shape) {
      drawing.current.pts[1] = p;
    } else {
      drawing.current.pts.push(p);
    }
    redraw();
    if (now - liveThrottle.current > 33) {
      liveThrottle.current = now;
      if (drawing.current.shape) {
        // For shapes, resend the whole stroke so partner sees preview update.
        chRef.current?.send({
          type: "broadcast",
          event: "stroke-start",
          payload: drawing.current,
        });
      } else {
        chRef.current?.send({
          type: "broadcast",
          event: "stroke-point",
          payload: { id: drawing.current.id, pts: [p] },
        });
      }
    }
  }

  function onUp() {
    if (!drawing.current) return;
    const s = drawing.current;
    drawing.current = null;
    strokes.current.push(s);
    undone.current = [];
    chRef.current?.send({ type: "broadcast", event: "stroke", payload: s });
    supabase
      .from("paint_strokes")
      .insert({ id: s.id, pair_key: pairKey(), by_user: s.by, stroke: s })
      .then(({ error }) => { if (error) console.warn("paint save:", error.message); });
    redraw();
  }

  function undo() {
    for (let i = strokes.current.length - 1; i >= 0; i--) {
      if (strokes.current[i].by === me?.id) {
        const [s] = strokes.current.splice(i, 1);
        undone.current.push(s);
        chRef.current?.send({ type: "broadcast", event: "undo", payload: { id: s.id } });
        supabase.from("paint_strokes").delete().eq("id", s.id).then(() => {});
        redraw();
        return;
      }
    }
    toast("Nothing to undo");
  }

  function redo() {
    const s = undone.current.pop();
    if (s) {
      strokes.current.push(s);
      chRef.current?.send({ type: "broadcast", event: "stroke", payload: s });
      supabase
        .from("paint_strokes")
        .insert({ id: s.id, pair_key: pairKey(), by_user: s.by, stroke: s })
        .then(({ error }) => { if (error) console.warn("paint save:", error.message); });
    }
    redraw();
  }

  function clearMine() {
    const mine = strokes.current.filter((s) => s.by === me?.id);
    if (mine.length === 0) {
      toast("Nothing of yours to clear");
      return;
    }
    strokes.current = strokes.current.filter((s) => s.by !== me?.id);
    undone.current = [...undone.current, ...mine];
    for (const s of mine) {
      chRef.current?.send({ type: "broadcast", event: "undo", payload: { id: s.id } });
    }
    supabase.from("paint_strokes").delete().in("id", mine.map((s) => s.id)).then(() => {});
    redraw();
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Include the background when saving.
    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext("2d")!;
    // Fill with a fallback white; background CSS won't render to canvas.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.drawImage(canvas, 0, 0);
    const a = document.createElement("a");
    a.href = off.toDataURL("image/png");
    a.download = `pandacine-paint-${Date.now()}.png`;
    a.click();
  }

  function changeBg(nextKey: string) {
    setBg(nextKey);
    try { localStorage.setItem(`paint_bg:${pairKey()}`, nextKey); } catch { /* ignore */ }
    chRef.current?.send({ type: "broadcast", event: "bg", payload: { key: nextKey } });
    setBgPickerOpen(false);
  }

  function done() {
    const canvas = canvasRef.current;
    if (!canvas || !me) return;
    if (strokes.current.length === 0) {
      toast("Draw something first ✨");
      return;
    }
    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.drawImage(canvas, 0, 0);
    const image = off.toDataURL("image/png");
    const payload = { image, by: me.id };
    setReveal(payload);
    chRef.current?.send({ type: "broadcast", event: "reveal", payload });
  }

  async function shareReveal() {
    if (!reveal) return;
    try {
      const blob = await (await fetch(reveal.image)).blob();
      const file = new File([blob], `pandacine-paint-${Date.now()}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Our Paint Together masterpiece 🎨" });
        return;
      }
    } catch { /* ignore */ }
    const a = document.createElement("a");
    a.href = reveal.image;
    a.download = `pandacine-paint-${Date.now()}.png`;
    a.click();
  }

  async function saveToGallery() {
    if (!me) return;
    const { error } = await supabase.from("paint_gallery").insert({
      pair_key: pairKey(),
      by_user: me.id,
      strokes: JSON.parse(JSON.stringify(strokes.current)),
      background: bg,
    });
    if (error) {
      toast.error("Could not save to gallery");
      return;
    }
    toast.success("Saved to your gallery 🎨");
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGalleryOpen(true)}
            className="rounded-full bg-surface border border-border p-1.5 text-candle"
            aria-label="Gallery"
          >
            <BookOpen className="size-4" />
          </button>
          <span className="text-[10px] text-candle-muted">
            {partner ? "Live" : "Solo"}
          </span>
        </div>
      </header>

      {/* Canvas + remote cursor overlay */}
      <div
        className="relative rounded-3xl overflow-hidden border border-border h-[78vh] min-h-[520px] touch-none"
        style={{ background: bgCss }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => {
            if (drawing.current) onUp();
          }}
          className={`w-full h-full ${stampMode ? "cursor-copy" : "cursor-crosshair"}`}
        />
        {remoteCursor && partner && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-100 ease-linear"
            style={{ left: `${remoteCursor.x * 100}%`, top: `${remoteCursor.y * 100}%` }}
          >
            <span
              className="block size-3 rounded-full ring-2 ring-white shadow"
              style={{ background: remoteCursor.color, boxShadow: `0 0 12px ${remoteCursor.color}` }}
            />
            <span
              className="mt-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] text-white whitespace-nowrap"
              style={{ background: remoteCursor.color }}
            >
              {remoteCursor.name}
            </span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="mt-4 space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setErase(false); setStampMode(null); setShapeMode(null); }}
              className={`size-8 rounded-full border-2 transition ${color === c && !erase && !stampMode ? "border-petal scale-110" : "border-border"}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <label
            className={`size-8 rounded-full border-2 flex items-center justify-center cursor-pointer relative overflow-hidden ${!erase && !stampMode && !COLORS.includes(color) ? "border-petal scale-110" : "border-border bg-surface"}`}
            aria-label="Custom color"
            style={!erase && !stampMode && !COLORS.includes(color) ? { background: color } : undefined}
          >
            <Palette className="size-4 mix-blend-difference text-white pointer-events-none" />
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); setErase(false); setStampMode(null); setShapeMode(null); }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          <button
            onClick={() => { setErase((e) => !e); setStampMode(null); setShapeMode(null); }}
            className={`size-8 rounded-full border-2 flex items-center justify-center ${erase ? "border-petal bg-petal-soft" : "border-border bg-surface"}`}
            aria-label="Eraser"
          >
            <Eraser className="size-4" />
          </button>
          <button
            onClick={() => { setStampsOpen((v) => !v); setShapesOpen(false); }}
            className={`size-8 rounded-full border-2 flex items-center justify-center ${stampMode ? "border-petal bg-petal-soft" : "border-border bg-surface"}`}
            aria-label="Stamps"
          >
            {stampMode ? <span className="text-base leading-none">{stampMode}</span> : <Sticker className="size-4" />}
          </button>
          <button
            onClick={() => { setShapesOpen((v) => !v); setStampsOpen(false); }}
            className={`size-8 rounded-full border-2 flex items-center justify-center ${shapeMode ? "border-petal bg-petal-soft" : "border-border bg-surface"}`}
            aria-label="Shapes"
          >
            <Shapes className="size-4" />
          </button>
          <button
            onClick={() => setBgPickerOpen((v) => !v)}
            className="size-8 rounded-full border-2 flex items-center justify-center border-border bg-surface"
            aria-label="Background"
          >
            <ImageIcon className="size-4" />
          </button>
        </div>

        {shapesOpen && (
          <div className="rounded-2xl border border-border bg-surface p-2 flex flex-wrap gap-1 items-center">
            {SHAPES.map((sh) => (
              <button
                key={sh.key}
                onClick={() => { setShapeMode(sh.key); setErase(false); setStampMode(null); setShapesOpen(false); }}
                className={`px-3 h-9 rounded-xl text-xs flex items-center justify-center hover:bg-petal-soft ${shapeMode === sh.key ? "bg-petal-soft ring-2 ring-petal" : ""}`}
              >
                {sh.label}
              </button>
            ))}
            <label className="ml-auto text-xs text-candle-muted flex items-center gap-1 px-2">
              <input
                type="checkbox"
                checked={fillShape}
                onChange={(e) => setFillShape(e.target.checked)}
              />
              Fill
            </label>
            {shapeMode && (
              <button
                onClick={() => setShapeMode(null)}
                className="text-xs text-candle-muted px-2"
              >
                Back
              </button>
            )}
          </div>
        )}

        {stampsOpen && (
          <div className="rounded-2xl border border-border bg-surface p-2 flex flex-wrap gap-1">
            {STAMPS.map((s) => (
              <button
                key={s}
                onClick={() => { setStampMode(s); setErase(false); setShapeMode(null); setStampsOpen(false); }}
                className={`size-9 rounded-xl text-xl flex items-center justify-center hover:bg-petal-soft ${stampMode === s ? "bg-petal-soft ring-2 ring-petal" : ""}`}
              >
                {s}
              </button>
            ))}
            {stampMode && (
              <button
                onClick={() => setStampMode(null)}
                className="ml-auto text-xs text-candle-muted px-3"
              >
                Back to brush
              </button>
            )}
          </div>
        )}

        {bgPickerOpen && (
          <div className="rounded-2xl border border-border bg-surface p-2 grid grid-cols-3 gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.key}
                onClick={() => changeBg(b.key)}
                className={`h-16 rounded-xl overflow-hidden border-2 relative ${bg === b.key ? "border-petal" : "border-border"}`}
                style={{ background: b.css }}
              >
                <span className="absolute bottom-1 left-1 right-1 text-[10px] text-candle bg-white/70 rounded px-1 py-0.5">
                  {b.label}
                </span>
              </button>
            ))}
          </div>
        )}

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
          <button onClick={clearMine} className="rounded-full bg-surface border border-border text-candle-muted px-4 py-2.5 text-sm flex items-center gap-2">
            <Trash2 className="size-4" />
          </button>
        </div>

        <button
          onClick={done}
          className="w-full rounded-full py-3 text-sm font-medium text-white flex items-center justify-center gap-2 shadow-lg"
          style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6 55%,#f59e0b)" }}
        >
          <Sparkles className="size-4" /> Done — Reveal Masterpiece
        </button>
      </div>

      {reveal && (
        <RevealOverlay
          image={reveal.image}
          fromPartner={reveal.by !== me?.id}
          bgCss={bgCss}
          strokes={strokes.current}
          onClose={() => setReveal(null)}
          onShare={shareReveal}
          onSaveGallery={saveToGallery}
        />
      )}

      {galleryOpen && (
        <GalleryOverlay pairKey={pairKey()} onClose={() => setGalleryOpen(false)} />
      )}

      {me && partner && (
        <GameChat
          roomKey={`paint:${[me.id, partner.id].sort().join(":")}`}
          me={me}
          partnerName={partner.display_name}
          title="Studio chat"
        />
      )}
    </div>
  );
}

// -------- Reveal overlay with replay + save-to-gallery ------------------------

function RevealOverlay({
  image,
  fromPartner,
  bgCss,
  strokes,
  onClose,
  onShare,
  onSaveGallery,
}: {
  image: string;
  fromPartner: boolean;
  bgCss: string;
  strokes: Stroke[];
  onClose: () => void;
  onShare: () => void;
  onSaveGallery: () => void;
}) {
  const [replaying, setReplaying] = useState(false);
  const confetti = Array.from({ length: 60 }, (_, i) => i);
  const palette = ["#ec4899", "#8b5cf6", "#f59e0b", "#22c55e", "#0ea5e9", "#ffffff"];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden animate-fade-in">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(236,72,153,0.55), transparent 55%), radial-gradient(circle at 80% 30%, rgba(139,92,246,0.55), transparent 55%), radial-gradient(circle at 50% 90%, rgba(245,158,11,0.5), transparent 55%), #0b0616",
        }}
      />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((i) => {
          const left = (i * 37) % 100;
          const delay = (i % 12) * 0.15;
          const dur = 2.4 + ((i * 13) % 20) / 10;
          const color = palette[i % palette.length];
          const size = 6 + (i % 5) * 2;
          return (
            <span
              key={i}
              className="absolute top-[-10%] rounded-sm"
              style={{
                left: `${left}%`,
                width: size,
                height: size * 0.4,
                background: color,
                transform: `rotate(${(i * 47) % 360}deg)`,
                animation: `paint-confetti ${dur}s linear ${delay}s infinite`,
                opacity: 0.9,
              }}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes paint-confetti {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; }
        }
        @keyframes paint-reveal-pop {
          0% { transform: scale(0.6) rotate(-4deg); opacity: 0; }
          60% { transform: scale(1.04) rotate(1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>

      <div
        className="relative w-full max-w-md rounded-3xl p-5 bg-gradient-to-b from-white/95 to-white/85 backdrop-blur-xl border-4 shadow-2xl"
        style={{ animation: "paint-reveal-pop 0.7s cubic-bezier(.2,1.2,.3,1) both", borderColor: "#8b5cf6", boxShadow: "0 20px 60px rgba(139,92,246,0.5), 0 0 0 6px rgba(139,92,246,0.2)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 size-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-candle"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <div className="text-center mb-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-petal flex items-center justify-center gap-1">
            <Sparkles className="size-3" /> Masterpiece
          </p>
          <h2 className="font-serif text-2xl italic mt-1" style={{ color: "#8b5cf6" }}>
            {fromPartner ? "Your partner called it done" : "Beautifully done"}
          </h2>
          <p className="text-xs text-candle-muted mt-1">
            {fromPartner ? "They revealed the final canvas ✨" : "A little something you made together 🎨"}
          </p>
        </div>
        <div
          className="rounded-2xl overflow-hidden border-2 shadow-inner relative"
          style={{ borderColor: "#8b5cf6", boxShadow: "0 0 0 4px rgba(139,92,246,0.15)", background: bgCss }}
        >
          {replaying ? (
            <ReplayCanvas strokes={strokes} bgCss={bgCss} onDone={() => setReplaying(false)} />
          ) : (
            <img src={image} alt="Final painting" className="w-full h-auto block" />
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setReplaying((v) => !v)}
            className="rounded-full py-2.5 text-sm font-medium bg-surface border border-border text-candle flex items-center justify-center gap-2"
          >
            <Play className="size-4" /> {replaying ? "Stop" : "Time-lapse"}
          </button>
          <button
            onClick={onSaveGallery}
            className="rounded-full py-2.5 text-sm font-medium bg-surface border border-border text-candle flex items-center justify-center gap-2"
          >
            <Save className="size-4" /> Save to gallery
          </button>
          <button
            onClick={onShare}
            className="col-span-2 rounded-full py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
          >
            <Share2 className="size-4" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}

// -------- Replay canvas -------------------------------------------------------

function ReplayCanvas({
  strokes,
  bgCss,
  onDone,
}: {
  strokes: Stroke[];
  bgCss: string;
  onDone: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const wrap = canvas.parentElement!;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(Math.max(rect.width * 0.7, 240) * dpr);
    canvas.style.width = rect.width + "px";
    canvas.style.height = Math.max(rect.width * 0.7, 240) + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const w = rect.width;
    const h = Math.max(rect.width * 0.7, 240);

    let cancelled = false;
    const TOTAL_MS = Math.min(6000, Math.max(2500, strokes.length * 120));
    const perStroke = TOTAL_MS / Math.max(1, strokes.length);
    let i = 0;

    function drawStrokeFrame(s: Stroke, pctPts: number) {
      if (s.stamp) {
        const p = s.pts[0];
        if (!p) return;
        const px = Math.max(28, s.size * 4 * (w / 400));
        ctx.font = `${px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = pctPts;
        ctx.fillText(s.stamp, p.x * w, p.y * h);
        ctx.globalAlpha = 1;
        return;
      }
      if (s.shape && s.pts.length >= 2) {
        const a = s.pts[0];
        const b = s.pts[s.pts.length - 1];
        ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = s.size * (w / 400);
        ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
        ctx.globalAlpha = pctPts;
        drawShape(ctx, s.shape, a.x * w, a.y * h, b.x * w, b.y * h, !!s.fill);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        return;
      }
      ctx.beginPath();
      ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
      ctx.lineWidth = s.size * (w / 400);
      ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
      const upto = Math.max(1, Math.floor(s.pts.length * pctPts));
      if (s.pts.length === 0) return;
      ctx.moveTo(s.pts[0].x * w, s.pts[0].y * h);
      for (let k = 1; k < upto; k++) ctx.lineTo(s.pts[k].x * w, s.pts[k].y * h);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }

    const startAt = performance.now();
    function tick(now: number) {
      if (cancelled) return;
      const t = now - startAt;
      const idx = Math.min(strokes.length - 1, Math.floor(t / perStroke));
      const inner = (t - idx * perStroke) / perStroke;
      // clear + redraw everything up to current
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (let k = 0; k <= idx; k++) {
        const pct = k < idx ? 1 : Math.min(1, inner);
        drawStrokeFrame(strokes[k], pct);
      }
      i = idx;
      if (t >= TOTAL_MS) {
        // finish
        setTimeout(onDone, 400);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      void i;
    };
  }, [strokes, onDone]);
  return (
    <div className="w-full" style={{ background: bgCss }}>
      <canvas ref={ref} className="block w-full" />
    </div>
  );
}

// -------- Gallery overlay -----------------------------------------------------

function GalleryOverlay({
  pairKey,
  onClose,
}: {
  pairKey: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<
    { id: string; strokes: Stroke[]; background: string | null; created_at: string }[]
  >([]);
  const [selected, setSelected] = useState<null | {
    strokes: Stroke[];
    bgCss: string;
  }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("paint_gallery")
        .select("id, strokes, background, created_at")
        .eq("pair_key", pairKey)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setItems(data as unknown as typeof items);
      }
      setLoading(false);
    })();
  }, [pairKey]);

  async function remove(id: string) {
    await supabase.from("paint_gallery").delete().eq("id", id);
    setItems((cur) => cur.filter((x) => x.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif italic text-lg text-candle">Your gallery</h3>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-candle"
          >
            <X className="size-4" />
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-candle-muted text-center py-8">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-candle-muted text-center py-8">
            No saved paintings yet. Tap Done, then Save to gallery.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((it) => {
              const bg = BACKGROUNDS.find((b) => b.key === (it.background ?? "white"))?.css ?? "#fff";
              return (
                <div key={it.id} className="rounded-2xl overflow-hidden border border-border relative">
                  <button
                    onClick={() => setSelected({ strokes: it.strokes as Stroke[], bgCss: bg })}
                    className="block w-full h-32 relative"
                    style={{ background: bg }}
                  >
                    <GalleryThumb strokes={it.strokes as Stroke[]} />
                    <span className="absolute bottom-1 left-1 text-[10px] text-candle bg-white/70 rounded px-1 py-0.5">
                      {new Date(it.created_at).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    onClick={() => remove(it.id)}
                    className="absolute top-1 right-1 size-6 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                    aria-label="Delete"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-4 border-4" style={{ borderColor: "#8b5cf6" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-serif italic text-candle">Replaying…</p>
                <button
                  onClick={() => setSelected(null)}
                  className="size-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-candle"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div
                className="rounded-2xl overflow-hidden border-2"
                style={{ borderColor: "#8b5cf6", background: selected.bgCss }}
              >
                <ReplayCanvas
                  strokes={selected.strokes}
                  bgCss={selected.bgCss}
                  onDone={() => { /* stay open for viewing */ }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryThumb({ strokes }: { strokes: Stroke[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const rect = c.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    c.style.width = rect.width + "px";
    c.style.height = rect.height + "px";
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const w = rect.width;
    const h = rect.height;
    for (const s of strokes) {
      if (s.stamp) {
        const p = s.pts[0];
        if (!p) continue;
        const px = Math.max(10, s.size * 2 * (w / 400));
        ctx.font = `${px}px "Apple Color Emoji", "Segoe UI Emoji", system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.stamp, p.x * w, p.y * h);
        continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
      ctx.lineWidth = Math.max(0.5, s.size * (w / 400));
      ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
      if (s.pts.length === 0) continue;
      ctx.moveTo(s.pts[0].x * w, s.pts[0].y * h);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x * w, s.pts[i].y * h);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
  }, [strokes]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}
