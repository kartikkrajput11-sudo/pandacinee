import { Link, useLocation } from "@tanstack/react-router";
import { Home, MessageCircle, Film, Gamepad2, User } from "lucide-react";

type Item = {
  to: "/app" | "/app/chat" | "/app/movies" | "/app/play" | "/app/me";
  label: string;
  Icon: typeof Home;
  exact?: boolean;
  primary?: boolean;
  search?: Record<string, unknown>;
};

const items: Item[] = [
  { to: "/app", label: "Home", Icon: Home, exact: true },
  { to: "/app/chat", label: "Chat", Icon: MessageCircle },
  { to: "/app/movies", label: "Watch", Icon: Film, primary: true, search: { q: "" } },
  { to: "/app/play", label: "Play", Icon: Gamepad2 },
  { to: "/app/me", label: "Me", Icon: User },
];

export function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40">
      <div className="mx-3 mb-3 h-16 px-2 bg-surface border border-border rounded-full flex items-center justify-around shadow-2xl">

        {items.map(({ to, label, Icon, primary, exact, search }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          if (primary) {
            return (
              <Link key={to} to={to} search={search as any} className="flex flex-col items-center gap-0.5" aria-label={label}>
                <div className="size-12 -translate-y-4 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow">
                  <Icon className="size-5" />
                </div>
              </Link>
            );
          }
          return (
            <Link
              key={to}
              to={to}
              search={search as any}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-full transition-colors ${
                active ? "text-petal" : "text-candle-muted hover:text-candle"
              }`}
              aria-label={label}
            >
              <Icon className="size-5" />
              <span className="text-[9px] uppercase tracking-wider font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
