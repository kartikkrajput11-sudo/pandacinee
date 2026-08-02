import { Link, useLocation } from "@tanstack/react-router";
import { Home, MessageCircle, Gamepad2, User } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

type Item = {
  to: "/app" | "/app/chat" | "/app/play" | "/app/me";
  label: string;
  Icon: typeof Home;
  exact?: boolean;
};

const items: Item[] = [
  { to: "/app", label: "Home", Icon: Home, exact: true },
  { to: "/app/chat", label: "Chat", Icon: MessageCircle },
  { to: "/app/play", label: "Play", Icon: Gamepad2 },
  { to: "/app/me", label: "Me", Icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const unread = useUnreadMessages();

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2">
      <div className="mx-3 mb-3 flex h-[64px] items-center justify-between rounded-[28px] border border-border bg-background/90 px-8 backdrop-blur-md">
        {items.map(({ to, label, Icon, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className="group relative flex flex-1 flex-col items-center gap-1 py-2 transition-opacity"
            >
              <div className="relative">
                <Icon
                  className={`size-[19px] transition-colors duration-300 ${
                    active ? "text-petal" : "text-candle-muted/60"
                  }`}
                  strokeWidth={1.5}
                />
                {to === "/app/chat" && unread > 0 && !active && (
                  <span
                    aria-label={`${unread} unread`}
                    className="absolute -right-2 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-petal px-1 text-[9px] font-semibold text-background"
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span
                className={`text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                  active ? "text-petal" : "text-candle-muted/60"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
