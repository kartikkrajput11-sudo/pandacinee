import { useEffect, useLayoutEffect, useRef, useState, Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@tanstack/react-router";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const PandaGuide3D = lazy(() => import("./tour/PandaGuide3D"));

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
  mood?: "wave" | "cheer" | "peek" | "sleep";
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
    body: "Voice notes, pins, forwards, view-once media, locked chats, polls, group codes. In groups your panda's messages glow softly so you never miss them.",
    placement: "bottom",
  },
  {
    route: "/app/chat",
    selector: '[data-tour="chat-hero"]',
    eyebrow: "Little tenderness",
    title: "Affections",
    body: "Send a kiss, hug, headpat, handhold, boop or nudge — each plays a full-screen panda animation on your partner's device. Tiny rituals, big warmth.",
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
    body: "Earn coins from rituals, streaks and movie nights, then buy honors — Candle Keeper, Night Owls, Eternal Flame. Equip up to three to shine on your profile.",
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
  const [tipSize, setTipSize] = useState<{ w: number; h: number }>({ w: 360, h: 220 });
  const tipRef = useRef<HTMLDivElement | null>(null);
  const total = STEPS.length;
  const returnTo = useRef<string>("/app");

  // Remember where user was so we can return them after tour.
  useEffect(() => {
    if (open) {
      returnTo.current = router.state.location.pathname || "/app";
      setI(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        // Scroll placement depends on where the tooltip will sit.
        // If the tooltip goes ABOVE the target, keep the target low so there's
        // room above it. If BELOW, keep it high so there's room below.
        const r = el.getBoundingClientRect();
        const vh0 = window.innerHeight;
        const placeTop = step.placement === "top";
        const desiredTopInViewport = placeTop
          ? Math.max(vh0 * 0.55, vh0 - r.height - 260) // target sits in lower half
          : Math.max(80, vh0 * 0.22);                   // target sits in upper third
        const targetY = window.scrollY + r.top - desiredTopInViewport;
        window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
        await new Promise((r) => setTimeout(r, 420));
        if (cancelled) return;
        setRect(el.getBoundingClientRect());
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [i, open, router]);

  // Track scroll / resize for spotlight — rAF for smoothness
  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const update = () => {
      const el = document.querySelector(STEPS[i].selector) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [i, open]);

  // Measure tooltip so we can place it without overlapping the spotlight
  useLayoutEffect(() => {
    if (!open || !tipRef.current) return;
    const measure = () => {
      const el = tipRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTipSize((prev) =>
        Math.abs(prev.w - r.width) > 1 || Math.abs(prev.h - r.height) > 1
          ? { w: r.width, h: r.height }
          : prev,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(tipRef.current);
    return () => ro.disconnect();
  }, [open, i, ready]);

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
    try { router.navigate({ to: returnTo.current as never }); } catch { /* ignore */ }
  }

  if (!open || typeof document === "undefined") return null;

  const step = STEPS[i];
  const pad = 10;
  const spot = rect
    ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 }
    : null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gutter = 16;
  const tooltipW = Math.min(400, vw - gutter * 2);
  const tipH = tipSize.h || 220;
  const topBarH = 56; // reserve space for top progress bar

  let tipX = gutter;
  let tipY = vh - tipH - gutter;
  let arrow: "up" | "down" | null = null;

  if (spot) {
    const spaceBelow = vh - (spot.y + spot.h) - gutter;
    const spaceAbove = spot.y - topBarH - gutter;
    const wantsBottom = step.placement === "bottom";
    const wantsTop = step.placement === "top";
    const preferBottom = wantsBottom
      ? spaceBelow >= 120 || spaceBelow >= spaceAbove
      : wantsTop
        ? !(spaceAbove >= 120) && spaceBelow > spaceAbove
        : spaceBelow >= spaceAbove;

    if (preferBottom && spaceBelow >= 120) {
      tipY = spot.y + spot.h + 14;
      arrow = "up";
    } else if (spaceAbove >= 120) {
      tipY = spot.y - tipH - 14;
      arrow = "down";
    } else {
      // no room on either side — pin to bottom without arrow
      tipY = vh - tipH - gutter;
      arrow = null;
    }
    tipY = Math.max(topBarH + gutter, Math.min(tipY, vh - tipH - gutter));
    tipX = Math.min(
      Math.max(gutter, spot.x + spot.w / 2 - tooltipW / 2),
      vw - tooltipW - gutter,
    );
  } else {
    // no target — center-bottom
    tipX = Math.max(gutter, (vw - tooltipW) / 2);
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
          style={{
            left: spot.x,
            top: spot.y,
            width: spot.w,
            height: spot.h,
            transition: "left 220ms cubic-bezier(.22,.61,.36,1), top 220ms cubic-bezier(.22,.61,.36,1), width 220ms cubic-bezier(.22,.61,.36,1), height 220ms cubic-bezier(.22,.61,.36,1)",
          }}
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
      <motion.div
        ref={tipRef}
        className="absolute"
        initial={false}
        animate={{ left: tipX, top: tipY }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        style={{ width: tooltipW }}
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

            {/* 3D Panda mascot */}
            <div className="absolute -top-8 -right-4 w-28 h-28 pointer-events-none drop-shadow-[0_10px_20px_rgba(236,120,155,0.35)]">
              <Suspense fallback={null}>
                <PandaGuide3D mood={step.mood ?? "wave"} />
              </Suspense>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
                className="pr-24"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="size-3.5 text-petal" />
                  <p className="text-[10px] uppercase tracking-[0.32em] text-petal/90">{step.eyebrow}</p>
                </div>
                <h2 className="font-serif italic text-2xl leading-tight text-candle mb-2">
                  {step.title}
                </h2>
                <div aria-hidden className="h-px w-12 bg-gradient-to-r from-petal/70 via-petal/30 to-transparent mb-3" />
                <p className="text-sm text-candle-muted leading-relaxed">{step.body}</p>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center gap-2 mt-5">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={prev}
                disabled={i === 0}
                className="size-10 rounded-full bg-velvet border border-border text-candle-muted hover:text-petal disabled:opacity-30 flex items-center justify-center"
                aria-label="Previous"
              >
                <ArrowLeft className="size-4" />
              </motion.button>
              {i < total - 1 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={next}
                  disabled={!ready}
                  className="flex-1 py-2.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  Continue <ArrowRight className="size-4" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={finish}
                  className="flex-1 py-2.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow flex items-center justify-center gap-2"
                >
                  Enter PANDACINE
                </motion.button>
              )}
              <span className="text-[10px] uppercase tracking-widest text-candle-muted whitespace-nowrap px-1">
                {i + 1} / {total}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

