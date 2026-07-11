import { Link } from "@tanstack/react-router";
import { BookHeart, ArrowRight, Camera, Mic, Film } from "lucide-react";

export function MemoryOfTheDayCard() {
  // Rotate visual/copy each day (deterministic)
  const idx = Math.floor(Date.now() / 86400000) % 3;
  const variants = [
    { Icon: Camera, tag: "A photo you loved", tone: "var(--petal)" },
    { Icon: Mic, tag: "A voice note worth revisiting", tone: "var(--lavender)" },
    { Icon: Film, tag: "A movie night to remember", tone: "var(--petal)" },
  ] as const;
  const v = variants[idx];

  return (
    <Link
      to="/app/memories"
      className="group relative block p-5 rounded-3xl glass overflow-hidden animate-fade-up hover:-translate-y-0.5 transition-transform"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-10 size-48 rounded-full blur-3xl opacity-30"
        style={{ background: `radial-gradient(circle, ${v.tone}, transparent 70%)` }}
      />
      <div className="relative flex items-center gap-4">
        <div
          className="size-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(140deg, color-mix(in oklab, ${v.tone} 30%, transparent), transparent)`,
            border: `1px solid color-mix(in oklab, ${v.tone} 30%, transparent)`,
          }}
        >
          <v.Icon className="size-5" style={{ color: v.tone }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-petal flex items-center gap-1.5">
            <BookHeart className="size-3" /> Memory of the day
          </p>
          <p className="font-serif text-lg italic leading-tight mt-0.5">{v.tag}</p>
          <p className="text-[11px] text-candle-muted mt-1">Open your shared archive.</p>
        </div>
        <ArrowRight className="size-4 text-candle-muted group-hover:translate-x-0.5 group-hover:text-petal transition-all" />
      </div>
    </Link>
  );
}
