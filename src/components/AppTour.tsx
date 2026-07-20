import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@tanstack/react-router";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

const KEY = "pandacine-tour-v2";

export function hasSeenTour(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function markTourSeen() {
  try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
}

type Step = {
  route: string;                          // navigate here before showing
  selector: string;                       // data-tour target on that page
  eyebrow: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "auto";
};

const STEPS: Step[] = [
  {
    route: "/app",
    selector: '[data-tour="home-hero"]',
    eyebrow: "Chapter · One",
    title: "Welcome to PANDACINE",
    body: "Your private velvet room. Everything for you and your panda lives right here.",
    placement: "bottom",
  },
  {
    route: "/app",
    selector: '[data-tour="home-notify"]',
    eyebrow: "Always with you",
    title: "Notifications",
    body: "The bell lights up whenever your panda writes, calls, or invites you — anywhere in the app.",
    placement: "bottom",
  },
  {
    route: "/app",
    selector: '[data-tour="home-signature"]',
    eyebrow: "Rituals",
    title: "Signature little things",
    body: "Love letters, timeline, constellation, watchlist — small daily rituals that make it feel like home.",
    placement: "top",
  },
  {
    route: "/app/chat",
    selector: '[data-tour="chat-hero"]',
    eyebrow: "Whispers",
    title: "Chats & groups",
    body: "Send affections (kiss, hug, headpat, boop), lock chats, share voice notes, pin messages, forward media. In groups, your partner's messages glow softly.",
    placement: "bottom",
  },
  {
    route: "/app/play",
    selector: '[data-tour="play-grid"]',
    eyebrow: "Playtime",
    title: "Games for two — and eight",
    body: "Chess, Ludo, Uno, 8-Ball Pool, Hide & Seek, Know-Me, Scribble. Duels for two, or seat up to eight friends. Observers can chat too.",
    placement: "top",
  },
  {
    route: "/app/movies",
    selector: '[data-tour="movies-hero"]',
    eyebrow: "In the dark",
    title: "Movies & series, synced",
    body: "Watch films together in lock-step: ready-check handshakes, rewind-on-buffer, and gentle drift correction — as if you were on the same couch.",
    placement: "bottom",
  },
  {
    route: "/app/me",
    selector: '[data-tour="me-badges"]',
    eyebrow: "Honor",
    title: "Badges & achievements",
    body: "Earn tags for streaks, movie nights, and wins. Equip up to three honors on your profile for your panda to see.",
    placement: "top",
  },
  {
    route: "/app",
    selector: '[data-tour="home-hero"]',
    eyebrow: "Ready",
    title: "You're all set",
    body: "That's the whole cinema. Wander in — your panda is waiting.",
    placement: "bottom",
  },
];

/* Wait for an element matching selector, up to timeout ms. */
function waitForEl(selector: string, timeout = 4000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) return resolve(el);
      if (performance.now() - start > timeout) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function AppTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);
  const total = STEPS.length;
  const returnTo = useRef<string>("/app");

  // Remember where user was so we can return them after tour
  useEffect(() => {
    if (open) {
      returnTo.current = router.state.location.pathname || "/app";
      setI(0);
    }
  }, [open, router.state.location.pathname]);

  // Navigate + locate target for each step
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    setRect(null);
    const step = STEPS[i];
    (async () => {
      if (router.state.location.pathname !== step.route) {
        try { await router.navigate({ to: step.route as never }); } catch { /* ignore */ }
      }
      const el = await waitForEl(step.selector, 5000);
      if (cancelled) return;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // wait for smooth scroll to settle
        await new Promise((r) => setTimeout(r, 350));
        if (cancelled) return;
        setRect(el.getBoundingClientRect());
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [i, open, router]);

  // Track scroll / resize for spotlight
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = document.querySelector(STEPS[i].selector) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const id = window.setInterval(update, 500);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.clearInterval(id);
    };
  }, [i, open]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  function next() { setI((v) => Math.min(total - 1, v + 1)); }
  function prev() { setI((v) => Math.max(0, v - 1)); }
  function finish() {
    markTourSeen();
    onClose();
    // return user to home so they land somewhere friendly
    try { router.navigate({ to: returnTo.current as never }); } catch { /* ignore */ }
  }

  if (!open || typeof document === "undefined") return null;

  const step = STEPS[i];
  const pad = 10;
  const spot = rect
    ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 }
    : null;

  // Tooltip placement
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipW = Math.min(400, vw - 32);
  let tipX = 16;
  let tipY = vh - 240;
  let arrow: "up" | "down" | null = null;
  if (spot) {
    const preferBottom = step.placement === "bottom"
      || (step.placement !== "top" && spot.y + spot.h < vh / 2);
    if (preferBottom) {
      tipY = Math.min(vh - 220, spot.y + spot.h + 16);
      arrow = "up";
    } else {
      tipY = Math.max(16, spot.y - 200);
      arrow = "down";
    }
    tipX = Math.min(
      Math.max(16, spot.x + spot.w / 2 - tooltipW / 2),
      vw - tooltipW - 16,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] animate-fade-in">
      {/* Spotlight overlay via SVG mask */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" aria-hidden>
        <defs>
          <mask id="tour-spot">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.x}
                y={spot.y}
                width={spot.w}
                height={spot.h}
                rx={20}
                ry={20}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(10, 6, 14, 0.78)"
          mask="url(#tour-spot)"
        />
      </svg>

      {/* Glowing ring around spotlight */}
      {spot && (
        <div
          className="pointer-events-none absolute rounded-[20px] border border-petal/70 shadow-[0_0_0_2px_rgba(236,120,155,0.25),0_0_40px_10px_rgba(236,120,155,0.35)] animate-pulse"
          style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }}
        />
      )}

      {/* Top bar: skip + progress */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
        <button
          onClick={finish}
          className="text-[11px] uppercase tracking-[0.3em] text-candle-muted hover:text-petal"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-petal" : idx < i ? "w-2.5 bg-petal/60" : "w-2.5 bg-border"}`}
              aria-label={`Step ${idx + 1}`}
            />
          ))}
        </div>
        <button
          onClick={finish}
          className="size-9 rounded-full bg-surface/80 border border-border text-candle-muted hover:text-petal flex items-center justify-center"
          aria-label="Close tour"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tooltip card */}
      <div
        key={i}
        className="absolute animate-fade-in"
        style={{ left: tipX, top: tipY, width: tooltipW }}
      >
        {arrow === "up" && spot && (
          <div
            aria-hidden
            className="absolute -top-2 w-4 h-4 rotate-45 bg-surface border-l border-t border-petal/40"
            style={{
              left: Math.min(
                Math.max(16, spot.x + spot.w / 2 - tipX - 8),
                tooltipW - 24,
              ),
            }}
          />
        )}
        {arrow === "down" && spot && (
          <div
            aria-hidden
            className="absolute -bottom-2 w-4 h-4 rotate-45 bg-surface border-r border-b border-petal/40"
            style={{
              left: Math.min(
                Math.max(16, spot.x + spot.w / 2 - tipX - 8),
                tooltipW - 24,
              ),
            }}
          />
        )}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-petal/50 via-petal/15 to-transparent shadow-[0_30px_100px_-30px_rgba(0,0,0,0.9)]">
          <div className="relative rounded-3xl bg-surface/95 backdrop-blur-xl border border-petal/30 p-5 overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-petal/70 to-transparent" />
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-3.5 text-petal" />
              <p className="text-[10px] uppercase tracking-[0.32em] text-petal/90">{step.eyebrow}</p>
            </div>
            <h2 className="font-serif italic text-2xl leading-tight text-candle mb-2">
              {step.title}
            </h2>
            <div aria-hidden className="h-px w-12 bg-gradient-to-r from-petal/70 via-petal/30 to-transparent mb-3" />
            <p className="text-sm text-candle-muted leading-relaxed">{step.body}</p>

            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={prev}
                disabled={i === 0}
                className="size-10 rounded-full bg-velvet border border-border text-candle-muted hover:text-petal disabled:opacity-30 flex items-center justify-center"
                aria-label="Previous"
              >
                <ArrowLeft className="size-4" />
              </button>
              {i < total - 1 ? (
                <button
                  onClick={next}
                  disabled={!ready}
                  className="flex-1 py-2.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  Continue <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  onClick={finish}
                  className="flex-1 py-2.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow flex items-center justify-center gap-2"
                >
                  Enter PANDACINE
                </button>
              )}
              <span className="text-[10px] uppercase tracking-widest text-candle-muted whitespace-nowrap px-1">
                {i + 1} / {total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
