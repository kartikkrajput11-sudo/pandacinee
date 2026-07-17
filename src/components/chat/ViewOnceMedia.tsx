import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EyeOff, X, Flame, Sparkles, Lock } from "lucide-react";
import { SignedImage } from "./SignedImage";
import { SignedVideo } from "./SignedVideo";
import type { MessageRow } from "@/lib/chat";

const KEY = (id: string) => `msg-view-once-opened:${id}`;
const DURATION = 15;

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
  const [countdown, setCountdown] = useState(DURATION);
  const [revealing, setRevealing] = useState(false);
  const [burning, setBurning] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCountdown(DURATION);
    const int = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(int);
          triggerBurn();
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
    // reveal sweep
    setRevealing(true);
    const t = setTimeout(() => setRevealing(false), 900);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function triggerBurn() {
    setBurning(true);
    setTimeout(() => {
      setBurning(false);
      close();
    }, 1100);
  }

  function close() {
    setOpen(false);
    if (!opened) {
      markOpened(m.id);
      setOpened(true);
    }
  }

  const embers = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.2 + Math.random() * 1.4,
      size: 3 + Math.random() * 5,
    })),
    [open],
  );

  // Sender side
  if (mine) {
    return (
      <div className="relative overflow-hidden flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border border-petal/30 bg-gradient-to-br from-petal/[0.08] via-velvet/40 to-petal/[0.04]">
        <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,hsl(var(--petal)/0.25),transparent_60%)]" />
        <div className="relative size-9 rounded-full bg-petal/20 flex items-center justify-center ring-1 ring-petal/40">
          <Lock className="size-3.5 text-petal" />
        </div>
        <div className="relative min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-petal font-semibold">
            View once · {kind === "video" ? "Video" : "Photo"}
          </p>
          <p className="text-[10px] text-candle-muted/80">Sealed — vanishes after one look</p>
        </div>
      </div>
    );
  }

  if (opened) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 to-velvet/30">
        <div className="size-9 rounded-full bg-black/50 flex items-center justify-center ring-1 ring-white/5">
          <EyeOff className="size-3.5 text-candle-muted" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted font-semibold">
            Opened
          </p>
          <p className="text-[10px] text-candle-muted/70">This {kind} has vanished into smoke</p>
        </div>
      </div>
    );
  }

  const progress = ((DURATION - countdown) / DURATION) * 100;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="group relative overflow-hidden flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-petal/45 bg-gradient-to-br from-petal/20 via-velvet/50 to-petal/10 shadow-[0_0_30px_-8px_hsl(var(--petal)/0.55)] hover:shadow-[0_0_40px_-6px_hsl(var(--petal)/0.75)] transition-all duration-500"
      >
        {/* animated shimmer */}
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
        {/* pulsing halo */}
        <span className="absolute -inset-4 rounded-full bg-petal/20 blur-2xl animate-pulse pointer-events-none" />

        <div className="relative">
          <div className="size-11 rounded-full bg-gradient-to-br from-petal/40 to-petal/10 flex items-center justify-center ring-2 ring-petal/50 group-hover:scale-110 transition-transform duration-500">
            <Flame className="size-5 text-petal drop-shadow-[0_0_8px_hsl(var(--petal))]" />
          </div>
          <span className="absolute inset-0 rounded-full ring-2 ring-petal/60 animate-ping" />
        </div>

        <div className="relative text-left">
          <p className="text-[11px] uppercase tracking-[0.3em] text-petal font-bold">
            Tap to reveal
          </p>
          <p className="text-[10px] text-candle/85 mt-0.5">
            {kind === "video" ? "Video" : "Photo"} · one look then it burns
          </p>
        </div>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center animate-fade-in">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--petal)/0.18),transparent_60%)]" />

          {/* Top bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-petal/50 backdrop-blur-md shadow-[0_0_20px_-4px_hsl(var(--petal)/0.6)]">
              <Flame className="size-3.5 text-petal animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.32em] text-petal font-bold">
                View once
              </span>
              <span className="text-[10px] tabular-nums text-candle/90 font-mono">{countdown}s</span>
            </div>
            <button
              onClick={close}
              className="size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition backdrop-blur border border-white/10"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* progress ring / bar */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[min(320px,60vw)] h-[3px] bg-white/10 rounded-full overflow-hidden z-20">
            <div
              className="h-full bg-gradient-to-r from-petal via-petal to-amber-300 shadow-[0_0_10px_hsl(var(--petal))]"
              style={{ width: `${progress}%`, transition: "width 1s linear" }}
            />
          </div>

          {/* Media */}
          <div className={`relative max-w-[92vw] max-h-[80vh] flex items-center justify-center select-none ${burning ? "animate-[burn_1.1s_ease-in_forwards]" : "animate-[reveal_0.9s_cubic-bezier(0.2,0.9,0.3,1)]"}`}>
            {kind === "image" && m.media_url && (
              <SignedImage
                path={m.media_url}
                className="max-w-[92vw] max-h-[80vh] object-contain rounded-2xl pointer-events-none shadow-[0_30px_80px_-20px_hsl(var(--petal)/0.5)]"
              />
            )}
            {kind === "video" && m.media_url && (
              <div className="pointer-events-auto">
                <SignedVideo path={m.media_url} />
              </div>
            )}

            {/* reveal sweep */}
            {revealing && (
              <span className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[sweep_0.9s_ease-out]" />
              </span>
            )}

            {/* burn embers */}
            {burning && (
              <span className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                {embers.map((e) => (
                  <span
                    key={e.id}
                    className="absolute bottom-0 rounded-full bg-gradient-to-t from-amber-500 via-petal to-transparent blur-[1px]"
                    style={{
                      left: `${e.left}%`,
                      width: e.size,
                      height: e.size,
                      animation: `ember ${e.dur}s ease-out ${e.delay}s forwards`,
                    }}
                  />
                ))}
                <span className="absolute inset-0 bg-gradient-to-t from-amber-600/40 via-petal/20 to-transparent animate-pulse" />
              </span>
            )}
          </div>

          {/* Footer hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 border border-white/10 backdrop-blur-md z-20">
            <Sparkles className="size-3 text-petal" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-candle/80">
              Once it's gone, it's gone
            </span>
          </div>

          <style>{`
            @keyframes reveal {
              0% { opacity: 0; transform: scale(0.85) rotateX(8deg); filter: blur(20px); }
              60% { opacity: 1; filter: blur(0); }
              100% { opacity: 1; transform: scale(1) rotateX(0); filter: blur(0); }
            }
            @keyframes sweep {
              0% { transform: translateX(0); }
              100% { transform: translateX(400%); }
            }
            @keyframes burn {
              0% { opacity: 1; transform: scale(1); filter: brightness(1) blur(0); }
              40% { opacity: 1; transform: scale(1.02); filter: brightness(1.4) sepia(0.4) hue-rotate(-20deg); }
              100% { opacity: 0; transform: scale(0.9) translateY(20px); filter: brightness(0.3) blur(12px) sepia(1); }
            }
            @keyframes ember {
              0% { transform: translateY(0) scale(1); opacity: 1; }
              100% { transform: translateY(-140px) translateX(${Math.random() > 0.5 ? "" : "-"}40px) scale(0.3); opacity: 0; }
            }
          `}</style>
        </div>,
        document.body,
      )}
    </>
  );
}
