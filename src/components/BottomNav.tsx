import { Link, useLocation } from "@tanstack/react-router";
import { Home, MessageCircle, Film, Gamepad2, User, PawPrint } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

type Item = {
  to: "/app" | "/app/chat" | "/app/movies" | "/app/pet" | "/app/play" | "/app/me";
  label: string;
  Icon: typeof Home;
  exact?: boolean;
  primary?: boolean;
  search?: Record<string, unknown>;
  from: string;
  to2: string;
};

const items: Item[] = [
  { to: "/app", label: "Home", Icon: Home, exact: true, from: "#a955ff", to2: "#ea51ff" },
  { to: "/app/chat", label: "Chat", Icon: MessageCircle, from: "#56CCF2", to2: "#2F80ED" },
  { to: "/app/movies", label: "Watch", Icon: Film, search: { q: "" }, from: "#FF9966", to2: "#FF5E62" },
  { to: "/app/pet", label: "Panda", Icon: PawPrint, primary: true, from: "#ffa9c6", to2: "#f434e2" },
  { to: "/app/play", label: "Play", Icon: Gamepad2, from: "#80FF72", to2: "#7EE8FA" },
  { to: "/app/me", label: "Me", Icon: User, from: "#f0d78c", to2: "#c9a84c" },
];

export function BottomNav() {
  const location = useLocation();
  const unread = useUnreadMessages();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-40">
      <ul className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-full glass-strong px-3 py-2 shadow-2xl">
        {items.map(({ to, label, Icon, exact, search, primary, from, to2 }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <li
              key={to}
              style={{ ["--gradient-from" as string]: from, ["--gradient-to" as string]: to2 }}
              className={`group relative flex h-[46px] items-center justify-center rounded-full transition-all duration-500 ${
                active ? "w-[110px]" : "w-[46px] hover:w-[110px]"
              } ${primary ? "-translate-y-3" : ""}`}
            >
              <span
                aria-hidden
                className={`absolute inset-0 rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] transition-opacity duration-500 ${
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              />
              <span
                aria-hidden
                className={`absolute inset-x-0 top-[8px] -z-10 h-full rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] blur-[15px] transition-opacity duration-500 ${
                  active ? "opacity-50" : "opacity-0 group-hover:opacity-50"
                }`}
              />
              <Link
                to={to}
                search={search as never}
                aria-label={label}
                className="absolute inset-0 flex items-center justify-center rounded-full active:scale-95"
              >
                <span
                  className={`relative z-10 transition-transform duration-500 ${
                    active ? "scale-0" : "group-hover:scale-0"
                  }`}
                >
                  <Icon className="size-[20px] text-candle-muted" />
                  {to === "/app/chat" && unread > 0 && !active && (
                    <span className="absolute -top-1.5 -right-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                <span
                  className={`absolute z-10 text-[11px] uppercase tracking-wide text-white transition-transform delay-150 duration-500 ${
                    active ? "scale-100" : "scale-0 group-hover:scale-100"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
