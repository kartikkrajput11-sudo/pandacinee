import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X, ArrowRight, ArrowLeft, Sparkles, Heart, Lock, Trophy,
  Clapperboard, Gamepad2, UsersRound, MessageCircleHeart, BellRing, Feather,
} from "lucide-react";

const KEY = "pandacine-tour-v1";

export function hasSeenTour(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function markTourSeen() {
  try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
}

type Chapter = {
  eyebrow: string;
  title: string;
  body: string;
  Icon: typeof Heart;
  accent: string; // token hint for gradient
  visual: React.ReactNode;
};

const CHAPTERS: Chapter[] = [
  {
    eyebrow: "Chapter · One",
    title: "A cinema built for two",
    body: "Welcome to PANDACINE — a private velvet room where two pandas watch, chat, play, and remember together.",
    Icon: Sparkles,
    accent: "from-petal/40 via-primary/20 to-transparent",
    visual: <PandasVisual />,
  },
  {
    eyebrow: "Affection",
    title: "Send more than words",
    body: "Kiss, hug, headpat, handhold, boop, nudge — animated affections drift across your partner's screen with soft chiptune sounds.",
    Icon: Heart,
    accent: "from-petal/50 via-petal/20 to-transparent",
    visual: <AffectionsVisual />,
  },
  {
    eyebrow: "Discipline · Gentle",
    title: "Locked chats",
    body: "Set a punishment lock — words to type, categories to complete. Copy-paste disabled, case-insensitive matching. Unlock together and celebrate.",
    Icon: Lock,
    accent: "from-primary/40 via-primary/15 to-transparent",
    visual: <LockVisual />,
  },
  {
    eyebrow: "Honor",
    title: "Badges & achievements",
    body: "Earn tags for daily streaks, movie nights, game wins, and memories. Equip up to three honors on your profile for your panda to see.",
    Icon: Trophy,
    accent: "from-amber-300/40 via-petal/15 to-transparent",
    visual: <BadgesVisual />,
  },
  {
    eyebrow: "Together in the dark",
    title: "Movies, synced",
    body: "Watch films and series in lock-step. Ready-check handshakes, rewind-on-buffer, and gentle drift correction — as if you were on the same couch.",
    Icon: Clapperboard,
    accent: "from-accent/40 via-petal/15 to-transparent",
    visual: <MovieVisual />,
  },
  {
    eyebrow: "Playtime",
    title: "Games for two — and eight",
    body: "Chess, Ludo, Uno, 8-Ball Pool, Hide & Seek, Know-Me, Scribble. Play duels or seat up to eight friends in a group match. Observers can chat too.",
    Icon: Gamepad2,
    accent: "from-emerald-300/30 via-petal/15 to-transparent",
    visual: <GamesVisual />,
  },
  {
    eyebrow: "Circles",
    title: "Groups with a partner glow",
    body: "In group chats, your partner's messages glow softly — you'll always spot them. Vote in polls, share voice notes, plan events, host game tables.",
    Icon: UsersRound,
    accent: "from-petal/40 via-primary/20 to-transparent",
    visual: <GroupVisual />,
  },
  {
    eyebrow: "Rituals",
    title: "Everyday little things",
    body: "Daily question, mood bar, streak, memory-of-the-day, love letters, timeline, and anniversary confetti — small rituals that make it feel like home.",
    Icon: Feather,
    accent: "from-petal/40 via-accent/20 to-transparent",
    visual: <RitualsVisual />,
  },
  {
    eyebrow: "Always with you",
    title: "Notifications everywhere",
    body: "A soft slide-in from the right whenever your panda writes, calls, or invites you — anywhere you are in the app.",
    Icon: BellRing,
    accent: "from-petal/40 via-primary/15 to-transparent",
    visual: <NotifyVisual />,
  },
];

export function AppTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const total = CHAPTERS.length;

  useEffect(() => { if (open) setI(0); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((v) => Math.min(total - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const c = CHAPTERS[i];
  const progress = useMemo(() => ((i + 1) / total) * 100, [i, total]);

  function finish() {
    markTourSeen();
    onClose();
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-velvet/95 backdrop-blur-xl flex items-center justify-center px-4 py-6 animate-fade-in overflow-y-auto">
      {/* Ambient bloom */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-gradient-radial ${c.accent} blur-3xl opacity-70 transition-all duration-700`} />
        <div className="absolute -bottom-48 -right-24 h-[500px] w-[500px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[620px] w-[620px] rounded-full border border-petal/10" />
      </div>

      <button
        onClick={finish}
        className="absolute top-5 right-5 size-10 rounded-full bg-surface/80 border border-border text-candle-muted hover:text-petal flex items-center justify-center z-10"
        aria-label="Close tour"
      >
        <X className="size-4" />
      </button>

      <button
        onClick={finish}
        className="absolute top-6 left-5 text-[11px] uppercase tracking-[0.3em] text-candle-muted hover:text-petal z-10"
      >
        Skip tour
      </button>

      {/* Card */}
      <div key={i} className="relative w-full max-w-2xl animate-auth-card">
        <div className="rounded-3xl p-[1px] bg-gradient-to-b from-petal/40 via-petal/10 to-transparent shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]">
          <div className="relative rounded-3xl bg-surface/70 backdrop-blur-2xl border border-border/60 p-7 md:p-10 overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-petal/70 to-transparent" />

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mb-6">
              {CHAPTERS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setI(idx)}
                  className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-petal" : idx < i ? "w-3 bg-petal/60" : "w-3 bg-border"}`}
                  aria-label={`Chapter ${idx + 1}`}
                />
              ))}
            </div>

            <div className="grid md:grid-cols-[1fr_1fr] gap-8 items-center">
              {/* Visual */}
              <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-velvet to-surface/60 border border-border/40 overflow-hidden flex items-center justify-center">
                <div className={`absolute inset-0 bg-gradient-radial ${c.accent} opacity-60`} />
                <div className="relative">{c.visual}</div>
              </div>

              {/* Copy */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-petal/90 mb-3">{c.eyebrow}</p>
                <h2 className="font-serif italic text-3xl md:text-4xl leading-[1.05] text-candle mb-3">
                  {c.title}
                </h2>
                <div aria-hidden className="h-px w-16 bg-gradient-to-r from-petal/70 via-petal/30 to-transparent mb-4" />
                <p className="text-sm md:text-base text-candle-muted leading-relaxed">
                  {c.body}
                </p>

                {/* Controls */}
                <div className="flex items-center gap-2 mt-8">
                  <button
                    onClick={() => setI((v) => Math.max(0, v - 1))}
                    disabled={i === 0}
                    className="size-11 rounded-full bg-surface border border-border text-candle-muted hover:text-petal disabled:opacity-30 flex items-center justify-center"
                    aria-label="Previous"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  {i < total - 1 ? (
                    <button
                      onClick={() => setI((v) => Math.min(total - 1, v + 1))}
                      className="group relative flex-1 py-3 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow overflow-hidden"
                    >
                      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden />
                      <span className="relative flex items-center justify-center gap-2">
                        Continue <ArrowRight className="size-4" />
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={finish}
                      className="flex-1 py-3 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow flex items-center justify-center gap-2"
                    >
                      <Heart className="size-4 fill-current" /> Enter PANDACINE
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-candle-muted">
                    Chapter {i + 1} / {total}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] uppercase tracking-widest text-candle-muted">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ============ Mini visuals ============ */

function PandasVisual() {
  return (
    <div className="relative flex items-center gap-1 text-6xl">
      <span className="animate-[float_3s_ease-in-out_infinite]">🐼</span>
      <MessageCircleHeart className="size-6 text-petal animate-pulse" />
      <span className="animate-[float_3s_ease-in-out_infinite_0.6s]">🐼</span>
    </div>
  );
}
function AffectionsVisual() {
  return (
    <div className="relative grid grid-cols-3 gap-3 text-3xl">
      {["💋", "🤗", "✋", "🫶", "👉", "🐾"].map((e, i) => (
        <span key={i} className="animate-[float_2.4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
      ))}
    </div>
  );
}
function LockVisual() {
  return (
    <div className="relative flex flex-col items-center gap-2">
      <Lock className="size-16 text-petal animate-pulse" />
      <div className="flex gap-1">
        {["b", "e", "l", "o", "v", "e", "d"].map((c, i) => (
          <span key={i} className="size-6 rounded bg-surface border border-petal/40 flex items-center justify-center text-xs font-mono uppercase text-petal animate-fade-in" style={{ animationDelay: `${i * 0.08}s` }}>{c}</span>
        ))}
      </div>
    </div>
  );
}
function BadgesVisual() {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-[220px]">
      {["🏆", "🔥", "🎬", "♟️", "💌", "⭐", "🌙", "🎨"].map((e, i) => (
        <div key={i} className="size-11 rounded-full bg-surface border border-petal/30 flex items-center justify-center text-lg animate-scale-in" style={{ animationDelay: `${i * 0.06}s` }}>{e}</div>
      ))}
    </div>
  );
}
function MovieVisual() {
  return (
    <div className="relative w-40 h-24 rounded-lg bg-black border border-petal/40 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-petal/30 to-accent/30 animate-pulse" />
      <Clapperboard className="absolute inset-0 m-auto size-10 text-white/90" />
      <div className="absolute bottom-1 left-1 right-1 h-1 rounded bg-white/20 overflow-hidden">
        <div className="h-full w-2/3 bg-petal animate-pulse" />
      </div>
    </div>
  );
}
function GamesVisual() {
  return (
    <div className="grid grid-cols-3 gap-2 text-3xl">
      {["♟️", "🎲", "🎴", "🎱", "🕵️", "❓", "🎨", "🏆", "🐼"].map((e, i) => (
        <span key={i} className="size-12 rounded-xl bg-surface border border-border flex items-center justify-center animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>{e}</span>
      ))}
    </div>
  );
}
function GroupVisual() {
  return (
    <div className="w-56 space-y-2">
      <div className="p-2 rounded-xl bg-surface border border-border text-xs text-candle-muted">Alex: gm 🐼</div>
      <div className="p-2 rounded-xl bg-petal-soft/60 border border-petal/50 shadow-[0_0_18px_rgba(236,120,155,0.35)] text-xs text-candle relative">
        <span className="absolute -top-1 -left-1 text-[9px] uppercase tracking-widest text-petal">Partner</span>
        Sam: miss you 💗
      </div>
      <div className="p-2 rounded-xl bg-surface border border-border text-xs text-candle-muted">Jamie: same</div>
    </div>
  );
}
function RitualsVisual() {
  return (
    <div className="grid grid-cols-2 gap-2 text-2xl">
      {[
        { e: "🌅", l: "Daily Q" },
        { e: "😊", l: "Mood" },
        { e: "🔥", l: "Streak" },
        { e: "💌", l: "Letters" },
      ].map((x, i) => (
        <div key={i} className="p-2 rounded-xl bg-surface border border-border flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
          <span>{x.e}</span>
          <span className="text-[10px] uppercase tracking-widest text-candle-muted">{x.l}</span>
        </div>
      ))}
    </div>
  );
}
function NotifyVisual() {
  return (
    <div className="relative w-56 h-32">
      <div className="absolute right-0 top-4 w-52 p-3 rounded-2xl bg-surface border border-petal/40 shadow-[0_20px_60px_-20px_rgba(236,120,155,0.4)] animate-[slide-in-right_0.6s_ease-out]">
        <p className="text-[10px] uppercase tracking-widest text-petal">New message</p>
        <p className="text-xs text-candle mt-1">🐼 come here…</p>
      </div>
    </div>
  );
}
