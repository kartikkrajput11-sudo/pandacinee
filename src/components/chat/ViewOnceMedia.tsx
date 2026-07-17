import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, X, Flame } from "lucide-react";
import { SignedImage } from "./SignedImage";
import { SignedVideo } from "./SignedVideo";
import type { MessageRow } from "@/lib/chat";

const KEY = (id: string) => `msg-view-once-opened:${id}`;

function hasOpened(id: string) {
  try { return localStorage.getItem(KEY(id)) === "1"; } catch { return false; }
}
function markOpened(id: string) {
  try { localStorage.setItem(KEY(id), "1"); } catch {}
}

export function ViewOnceMedia({ m, mine }: { m: MessageRow; mine: boolean }) {
  const kind = m.type as "image" | "video";
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(() => hasOpened(m.id));
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    if (!open) return;
    setCountdown(15);
    const int = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(int);
          close();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(int);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    if (!opened) {
      markOpened(m.id);
      setOpened(true);
    }
  }

  // Sender side: never revealed inline — just a subtle marker.
  if (mine) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-petal/25 bg-petal/[0.06]">
        <div className="size-8 rounded-full bg-petal/15 flex items-center justify-center">
          <Eye className="size-3.5 text-petal" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal/90 font-semibold">
            View once · {kind === "video" ? "Video" : "Photo"}
          </p>
          <p className="text-[10px] text-candle-muted/80">Sent — vanishes after one look</p>
        </div>
      </div>
    );
  }

  if (opened) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-black/25">
        <div className="size-8 rounded-full bg-black/40 flex items-center justify-center">
          <EyeOff className="size-3.5 text-candle-muted" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted font-semibold">
            Opened
          </p>
          <p className="text-[10px] text-candle-muted/70">This {kind} has vanished</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="group relative flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-petal/40 bg-gradient-to-br from-petal/15 to-velvet/40 hover:from-petal/25 hover:to-velvet/60 transition-all duration-300 shadow-[0_0_24px_-8px_hsl(var(--petal)/0.5)]"
      >
        <div className="size-9 rounded-full bg-petal/25 flex items-center justify-center ring-1 ring-petal/40 group-hover:scale-110 transition-transform">
          <Flame className="size-4 text-petal" />
        </div>
        <div className="text-left">
          <p className="text-[11px] uppercase tracking-[0.28em] text-petal font-bold">
            Tap to view
          </p>
          <p className="text-[10px] text-candle/80">{kind === "video" ? "Video" : "Photo"} · vanishes after</p>
        </div>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-fade-in">
          <button
            onClick={close}
            className="absolute top-4 right-4 size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-petal/20 border border-petal/40 backdrop-blur-md">
            <Flame className="size-3.5 text-petal" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-petal font-bold">
              View once · {countdown}s
            </span>
          </div>
          <div className="max-w-[92vw] max-h-[86vh] flex items-center justify-center select-none">
            {kind === "image" && m.media_url && (
              <SignedImage
                path={m.media_url}
                className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl pointer-events-none"
              />
            )}
            {kind === "video" && m.media_url && (
              <div className="pointer-events-auto">
                <SignedVideo path={m.media_url} />
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
