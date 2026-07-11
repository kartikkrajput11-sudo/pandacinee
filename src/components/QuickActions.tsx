import { Link } from "@tanstack/react-router";
import { Heart, Mail, BookHeart, Film, Gamepad2, Music, Gift, Calendar } from "lucide-react";
import type { ComponentType } from "react";

type Action = {
  label: string;
  Icon: ComponentType<{ className?: string }>;
  to: string;
  search?: Record<string, unknown>;
  tint: string;
};

const actions: Action[] = [
  { label: "Hug", Icon: Heart, to: "/app/chat", tint: "var(--petal)" },
  { label: "Letter", Icon: Mail, to: "/app/chat", tint: "var(--lavender)" },
  { label: "Memory", Icon: BookHeart, to: "/app/memories", tint: "var(--petal)" },
  { label: "Watch", Icon: Film, to: "/app/movies", search: { q: "" }, tint: "var(--lavender)" },
  { label: "Play", Icon: Gamepad2, to: "/app/play", tint: "var(--petal)" },
  { label: "Song", Icon: Music, to: "/app/wishlist", tint: "var(--lavender)" },
  { label: "Surprise", Icon: Gift, to: "/app/wishlist", tint: "var(--petal)" },
  { label: "Date", Icon: Calendar, to: "/app/anniversary", tint: "var(--lavender)" },
];

export function QuickActions() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[10px] uppercase tracking-[0.22em] text-candle-muted">Little gestures</p>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
        {actions.map(({ label, Icon, to, search, tint }) => (
          <Link
            key={label}
            to={to as any}
            search={search as any}
            className="group shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
          >
            <div
              className="size-14 rounded-2xl glass flex items-center justify-center transition-all group-hover:-translate-y-0.5"
              style={{
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px -18px ${tint}`,
              }}
            >
              <Icon className="size-5" style={{ color: tint }} />
            </div>
            <span className="text-[10px] tracking-wider text-candle-muted">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
