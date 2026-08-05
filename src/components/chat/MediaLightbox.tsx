import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { signMedia } from "@/lib/chat";
import { saveMediaToGallery } from "@/lib/save-media";

type Props = {
  /** Ordered storage paths for the gallery. */
  paths: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
};

const MAX_SCALE = 6;

/**
 * Premium fullscreen media viewer — pinch / wheel zoom, drag pan,
 * double-tap to zoom, swipe between the whole conversation's photos.
 */
export function MediaLightbox({ paths, index, onIndex, onClose }: Props) {
  const path = paths[index];
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [chrome, setChrome] = useState(true);

  const stateRef = useRef({ scale: 1, x: 0, y: 0 });
  stateRef.current = { scale, x: offset.x, y: offset.y };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setLoaded(false);
    reset();
    signMedia(path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [path, reset]);

  // Preload neighbours so swiping feels instant.
  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      const p = paths[i];
      if (!p) return;
      signMedia(p).then((u) => { if (u) { const im = new Image(); im.src = u; } });
    });
  }, [index, paths]);

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = index + dir;
      if (next < 0 || next >= paths.length) return;
      onIndex(next);
    },
    [index, paths.length, onIndex],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, go]);

  function clampOffset(nx: number, ny: number, s: number) {
    const el = surfaceRef.current;
    if (!el || s <= 1) return { x: 0, y: 0 };
    const limitX = (el.clientWidth * (s - 1)) / 2;
    const limitY = (el.clientHeight * (s - 1)) / 2;
    return {
      x: Math.max(-limitX, Math.min(limitX, nx)),
      y: Math.max(-limitY, Math.min(limitY, ny)),
    };
  }

  function zoomAt(nextScale: number, cx: number, cy: number) {
    const el = surfaceRef.current;
    const s = Math.max(1, Math.min(MAX_SCALE, nextScale));
    const cur = stateRef.current;
    if (!el) { setScale(s); return; }
    const rect = el.getBoundingClientRect();
    const px = cx - rect.left - rect.width / 2;
    const py = cy - rect.top - rect.height / 2;
    const k = s / cur.scale;
    const nx = px - (px - cur.x) * k;
    const ny = py - (py - cur.y) * k;
    setScale(s);
    setOffset(s <= 1 ? { x: 0, y: 0 } : clampOffset(nx, ny, s));
  }

  // Non-passive wheel so page never scrolls behind the viewer.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(stateRef.current.scale * Math.exp(-dy * 0.0018), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: stateRef.current.scale,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const g = gesture.current;
      zoomAt((g.scale * dist) / (g.dist || 1), g.cx, g.cy);
      return;
    }

    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true;
    if (stateRef.current.scale > 1) {
      setOffset(clampOffset(d.ox + dx, d.oy + dy, stateRef.current.scale));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    const startX = d?.x ?? 0;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;

    if (d && stateRef.current.scale <= 1) {
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 70) {
        go(dx < 0 ? 1 : -1);
        drag.current = null;
        return;
      }
    }

    if (d && !d.moved) {
      const now = Date.now();
      if (now - lastTap.current < 280) {
        lastTap.current = 0;
        if (stateRef.current.scale > 1) reset();
        else zoomAt(2.6, e.clientX, e.clientY);
      } else {
        lastTap.current = now;
        window.setTimeout(() => {
          if (lastTap.current && Date.now() - lastTap.current >= 270) {
            setChrome((c) => !c);
            lastTap.current = 0;
          }
        }, 300);
      }
    }
    drag.current = null;
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 select-none"
      style={{ height: "100dvh" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Ambient bloom */}
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(60%_50%_at_50%_45%,rgba(236,72,153,0.16),transparent_70%)]" />

      <div
        ref={surfaceRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden touch-none"
        style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!loaded && (
          <div className="absolute size-14 rounded-full border-2 border-petal/30 border-t-petal animate-spin" />
        )}
        {url && (
          <img
            key={path}
            src={url}
            alt=""
            draggable={false}
            onLoad={() => setLoaded(true)}
            className="max-w-full max-h-full object-contain will-change-transform"
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transition: drag.current || gesture.current ? "none" : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
              opacity: loaded ? 1 : 0,
            }}
          />
        )}
      </div>

      {/* Chrome */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${chrome ? "opacity-100" : "opacity-0"}`}
      >
        <div
          className="pointer-events-auto absolute top-0 inset-x-0 flex items-center justify-between gap-2 px-4 bg-gradient-to-b from-black/70 to-transparent"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "2.5rem" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[9px] uppercase tracking-[0.28em] text-white/70 bg-white/10 px-2 py-1 rounded-full border border-white/10">
              Pandacine
            </span>
            {paths.length > 1 && (
              <span className="text-[11px] text-white/60 tabular-nums">{index + 1} / {paths.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => zoomAt(scale - 0.6, window.innerWidth / 2, window.innerHeight / 2)}
              className="size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center"
              aria-label="Zoom out"
            >
              <ZoomOut className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomAt(scale + 0.6, window.innerWidth / 2, window.innerHeight / 2)}
              className="size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center"
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => url && saveMediaToGallery(url, { kind: "image" })}
              className="h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center gap-2 text-xs font-medium"
              aria-label="Save photo"
            >
              <Download className="size-4" /> Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {paths.length > 1 && (
          <>
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white items-center justify-center hidden sm:flex"
                aria-label="Previous"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}
            {index < paths.length - 1 && (
              <button
                type="button"
                onClick={() => go(1)}
                className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white items-center justify-center hidden sm:flex"
                aria-label="Next"
              >
                <ChevronRight className="size-5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
