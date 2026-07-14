import { Link, useLocation } from "@tanstack/react-router";
import { Home, MessageCircle, Film, Gamepad2, User } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

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
  const unread = useUnreadMessages();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40">
      <div className="mx-3 mb-3 h-[62px] px-3 glass-strong rounded-full flex items-center justify-around shadow-2xl">
        {items.map(({ to, label, Icon, primary, exact, search }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          if (primary) {
            return (
              <Link
                key={to}
                to={to}
                search={search as any}
                className="flex flex-col items-center active:scale-95 transition-transform"
                aria-label={label}
              >
                <div className="relative size-11 -translate-y-3 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow">
                  <Icon className="size-[18px]" />
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full animate-glow-breath pointer-events-none"
                  />
                </div>
              </Link>
            );
          }
          return (
            <Link
              key={to}
              to={to}
              search={search as any}
              className="relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-full transition-colors active:scale-95"
              aria-label={label}
            >
              <div className="relative">
                <Icon
                  className={`size-[20px] transition-all duration-300 ${
                    active ? "text-petal scale-110" : "text-candle-muted"
                  }`}
                />
                {to === "/app/chat" && unread > 0 && !active && (
                  <span
                    aria-label={`${unread} unread`}
                    className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse"
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span
                className={`text-[9px] uppercase tracking-wider font-semibold transition-colors ${
                  active ? "text-petal" : "text-candle-muted/80"
                }`}
              >
                {label}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-petal petal-glow"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
