import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Eraser } from "lucide-react";

type Stroke = { x: number; y: number; last: boolean; who: string };

/**
 * DuetCanvas — a live shared sketch/type pad. Both partners draw on the
 * same surface in realtime over a Supabase broadcast channel. Nothing is
 * persisted: it is a fleeting shared moment.
 */
export function DuetCanvas({
  open,
  onClose,
  meId,
  roomKey,
  partnerName,
}: {
  open: boolean;
  onClose: () => void;
  meId: string;
  roomKey: string;
  partnerName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<Record<string, { x: number; y: number } | null>>({});
  const [partnerHere, setPartnerHere] = useState(false);

  function paint(s: Stroke) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const prev = lastPt.current[s.who] ?? null;
    const x = s.x * canvas.width;
    const y = s.y * canvas.height;
    if (prev) {
      ctx.strokeStyle = s.who === meId ? "hsl(342 70% 66%)" : "hsl(38 82% 66%)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.shadowBlur = 12;
      ctx.shadowColor = ctx.strokeStyle as string;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastPt.current[s.who] = s.last ? null : { x, y };
  }

  useEffect(() => {
    if (!open) return;
    const chan = supabase.channel(`duet:${roomKey}`, { config: { presence: { key: meId } } });
    chan
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const s = payload as Stroke;
        if (s.who !== meId) paint(s);
      })
      .on("broadcast", { event: "clear" }, () => clearBoard(false))
      .on("presence", { event: "sync" }, () => {
        try {
          const state = chan.presenceState() as Record<string, unknown[]>;
          setPartnerHere(Object.keys(state).filter((k) => k !== meId).length > 0);
        } catch {
          setPartnerHere(false);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") chan.track({ at: Date.now() }).catch(() => {});
      });
    chanRef.current = chan;
    return () => {
      chanRef.current = null;
      supabase.removeChannel(chan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomKey, meId]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;
  }, [open]);

  function clearBoard(broadcast = true) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastPt.current = {};
    if (broadcast) {
      chanRef.current?.send({ type: "broadcast", event: "clear", payload: {} }).catch(() => {});
    }
  }

  function emit(e: React.PointerEvent, last: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const s: Stroke = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      last,
      who: meId,
    };
    paint(s);
    chanRef.current?.send({ type: "broadcast", event: "stroke", payload: s }).catch(() => {});
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-velvet/70 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-petal/30 bg-surface/95 overflow-hidden petal-glow">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-[8px] uppercase tracking-[0.32em] text-petal/80">Duet pad</p>
            <p className="text-xs text-candle-muted mt-0.5">
              {partnerHere ? `${partnerName} is drawing with you` : `waiting for ${partnerName}…`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => clearBoard()}
              aria-label="Clear the pad"
              className="size-9 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-candle-muted"
            >
              <Eraser className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close duet pad"
              className="size-9 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-candle-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-72 touch-none bg-velvet/40"
          onPointerDown={(e) => {
            drawing.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            emit(e, false);
          }}
          onPointerMove={(e) => { if (drawing.current) emit(e, false); }}
          onPointerUp={(e) => { if (drawing.current) { drawing.current = false; emit(e, true); } }}
          onPointerCancel={() => { drawing.current = false; lastPt.current[meId] = null; }}
        />
      </div>
    </div>
  );
}
