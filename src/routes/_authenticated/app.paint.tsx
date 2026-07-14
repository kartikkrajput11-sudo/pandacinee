import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eraser, Download, Palette, RotateCcw, RotateCw, Trash2, Sparkles, X, Share2 } from "lucide-react";
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
  // In-progress strokes from the partner, keyed by stroke id, rendered live.
  const liveRemote = useRef<Map<string, Stroke>>(new Map());
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const liveThrottle = useRef<number>(0);
  const [reveal, setReveal] = useState<{ image: string; by: string } | null>(null);

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

    // Load any previously saved strokes for this pair so the canvas is never blank.
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

    const ch = supabase.channel(`paint:${key}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "stroke-start" }, ({ payload }) => {
      const s = payload as Stroke;
      liveRemote.current.set(s.id, { ...s, pts: [...s.pts] });
      redraw();
    });
    ch.on("broadcast", { event: "stroke-point" }, ({ payload }) => {
      const p = payload as { id: string; pts: { x: number; y: number }[] };
      const existing = liveRemote.current.get(p.id);
      if (existing) {
        existing.pts.push(...p.pts);
      }
      redraw();
    });
    ch.on("broadcast", { event: "stroke" }, ({ payload }) => {
      const s = payload as Stroke;
      liveRemote.current.delete(s.id);
      if (!strokes.current.some((x) => x.id === s.id)) strokes.current.push(s);
      redraw();
    });
    ch.on("broadcast", { event: "clear" }, () => {
      strokes.current = [];
      undone.current = [];
      liveRemote.current.clear();
      redraw();
    });
    ch.on("broadcast", { event: "undo" }, ({ payload }) => {
      const id = (payload as { id: string }).id;
      const idx = strokes.current.findIndex((s) => s.id === id);
      if (idx >= 0) strokes.current.splice(idx, 1);
      redraw();
    });
    ch.on("broadcast", { event: "reveal" }, ({ payload }) => {
      const p = payload as { image: string; by: string };
      setReveal(p);
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
    const s: Stroke = {
      id: crypto.randomUUID(),
      by: me.id,
      color,
      size,
      erase,
      pts: [pt(e)],
    };
    drawing.current = s;
    // Announce the new stroke so partner can render it live.
    chRef.current?.send({
      type: "broadcast",
      event: "stroke-start",
      payload: s,
    });
    liveThrottle.current = 0;
    redraw();
  }
  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const p = pt(e);
    drawing.current.pts.push(p);
    redraw();
    // Throttle live broadcast to ~30fps, sending only the newest point.
    const now = performance.now();
    if (now - liveThrottle.current > 33) {
      liveThrottle.current = now;
      chRef.current?.send({
        type: "broadcast",
        event: "stroke-point",
        payload: { id: drawing.current.id, pts: [p] },
      });
    }
  }
  function pairKey() {
    if (!me) return "";
    return partner ? [me.id, partner.id].sort().join(":") : me.id;
  }

  function onUp() {
    if (!drawing.current) return;
    const s = drawing.current;
    drawing.current = null;
    strokes.current.push(s);
    undone.current = [];
    // Send the complete stroke so late/dropped points reconcile on the peer.
    chRef.current?.send({ type: "broadcast", event: "stroke", payload: s });
    // Persist so the partner sees it even when they open the page later.
    supabase
      .from("paint_strokes")
      .insert({ id: s.id, pair_key: pairKey(), by_user: s.by, stroke: s })
      .then(({ error }) => { if (error) console.warn("paint save:", error.message); });
    redraw();
  }

  function undo() {
    // Undo only my own strokes, newest first — keeps partner's work intact.
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
  function clearAll() {
    // Clear only my strokes; partner's drawing stays intact.
    const mine = strokes.current.filter((s) => s.by === me?.id);
    if (mine.length === 0) {
      toast("Nothing of yours to clear");
      return;
    }
    strokes.current = strokes.current.filter((s) => s.by !== me?.id);
    undone.current = [...undone.current, ...mine];
    const ids = mine.map((s) => s.id);
    for (const s of mine) {
      chRef.current?.send({ type: "broadcast", event: "undo", payload: { id: s.id } });
    }
    supabase.from("paint_strokes").delete().in("id", ids).then(() => {});
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

  function done() {
    const canvas = canvasRef.current;
    if (!canvas || !me) return;
    if (strokes.current.length === 0) {
      toast("Draw something first ✨");
      return;
    }
    // Flatten onto white so the reveal shows the artwork, not a transparent PNG.
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
          <label
            className={`size-8 rounded-full border-2 flex items-center justify-center cursor-pointer relative overflow-hidden ${!erase && !COLORS.includes(color) ? "border-petal scale-110" : "border-border bg-surface"}`}
            aria-label="Custom color"
            style={!erase && !COLORS.includes(color) ? { background: color } : undefined}
          >
            <Palette className="size-4 mix-blend-difference text-white pointer-events-none" />
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); setErase(false); }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
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
          <button onClick={clearAll} className="rounded-full bg-surface border border-border text-candle-muted px-4 py-2.5 text-sm flex items-center gap-2">
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
          onClose={() => setReveal(null)}
          onShare={shareReveal}
        />
      )}
    </div>
  );
}

function RevealOverlay({
  image,
  fromPartner,
  onClose,
  onShare,
}: {
  image: string;
  fromPartner: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  const confetti = Array.from({ length: 60 }, (_, i) => i);
  const palette = ["#ec4899", "#8b5cf6", "#f59e0b", "#22c55e", "#0ea5e9", "#ffffff"];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden animate-fade-in">
      {/* Celebration background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(236,72,153,0.55), transparent 55%), radial-gradient(circle at 80% 30%, rgba(139,92,246,0.55), transparent 55%), radial-gradient(circle at 50% 90%, rgba(245,158,11,0.5), transparent 55%), #0b0616",
        }}
      />
      {/* Confetti */}
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

      {/* Card */}
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
        <div className="rounded-2xl overflow-hidden border-2 shadow-inner bg-white" style={{ borderColor: "#8b5cf6", boxShadow: "0 0 0 4px rgba(139,92,246,0.15)" }}>
          <img src={image} alt="Final painting" className="w-full h-auto block" />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onShare}
            className="flex-1 rounded-full py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
          >
            <Share2 className="size-4" /> Share
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full py-2.5 text-sm bg-surface border border-border text-candle"
          >
            Keep painting
          </button>
        </div>
      </div>
    </div>
  );
}
