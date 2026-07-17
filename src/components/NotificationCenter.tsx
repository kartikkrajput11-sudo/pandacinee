import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Check, Trash2, X, MessageCircle, Users, Megaphone, Phone, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  NotifItem,
  clearAll,
  markAllRead,
  markRead,
  removeNotification,
  setNotifUser,
  subscribeNotifications,
} from "@/lib/notifications";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function kindIcon(kind: NotifItem["kind"]) {
  const cls = "h-3.5 w-3.5";
  switch (kind) {
    case "dm":        return <MessageCircle className={cls} />;
    case "group":     return <Users className={cls} />;
    case "broadcast": return <Megaphone className={cls} />;
    case "call":      return <Phone className={cls} />;
    default:          return <Sparkles className={cls} />;
  }
}

export default function NotificationCenter() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setNotifUser(data.user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setNotifUser(session?.user?.id ?? null);
    });

    const unsub = subscribeNotifications((list) => setItems(list));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      unsub();
    };
  }, []);

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = useMemo(() => items.filter((x) => !x.read).length, [items]);

  // Only render on the homepage (/app). Placed inline in the home header.
  if (pathname !== "/app") return null;

  const openItem = (n: NotifItem) => {
    markRead(n.id);
    if (n.href) navigate({ to: n.href as any });
    setOpen(false);
  };

  return (
    <div ref={panelRef} className="relative z-[95]">

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title={unread > 0 ? `${unread} new` : "Notifications"}
        className="group relative flex h-6 w-6 items-center justify-center rounded-full border border-petal/40 bg-[var(--surface-elevated)]/85 shadow-[0_4px_14px_-6px_rgba(230,180,120,0.5)] backdrop-blur-md transition hover:border-petal/70"
      >
        <Bell className="h-3 w-3 text-candle" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.85)] ring-2 ring-[var(--surface-elevated)] animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-[200] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-petal/30 bg-[var(--surface-elevated)]/98 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl">



          {/* header */}
          <div className="flex items-center justify-between border-b border-petal/20 bg-gradient-to-r from-petal/10 via-transparent to-petal/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-petal">Salon</span>
              <span className="text-sm font-medium text-candle">Notifications</span>
            </div>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    title="Mark all read"
                    className="rounded-md p-1.5 text-candle-muted hover:bg-petal/10 hover:text-candle"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={clearAll}
                    title="Clear all"
                    className="rounded-md p-1.5 text-candle-muted hover:bg-petal/10 hover:text-candle"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-candle-muted hover:bg-petal/10 hover:text-candle"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* list */}
          <div className="max-h-[70vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-petal/30 bg-gradient-to-br from-petal/10 to-transparent">
                  <Bell className="h-6 w-6 text-petal" />
                </div>
                <div className="text-sm font-medium text-candle">All quiet</div>
                <p className="text-xs text-candle-muted">You'll be pinged here when something arrives.</p>
              </div>
            ) : (
              <ul className="divide-y divide-petal/10">
                {items.map((n) => (
                  <li key={n.id} className={`group relative ${n.read ? "opacity-80" : ""}`}>
                    <button
                      onClick={() => openItem(n)}
                      className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition hover:bg-petal/5"
                    >
                      <div className="relative shrink-0">
                        {n.icon && n.icon.startsWith("http") ? (
                          // avatar
                          <img
                            src={n.icon}
                            alt=""
                            className="h-10 w-10 rounded-full border border-petal/40 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-petal/40 bg-gradient-to-br from-petal/20 to-petal/5 text-lg">
                            {n.icon || "✨"}
                          </div>
                        )}
                        {!n.read && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-petal ring-2 ring-[var(--surface-elevated)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-petal">
                          {kindIcon(n.kind)}
                          <span>{n.kind === "dm" ? "Message" : n.kind}</span>
                          <span className="text-candle-muted/70 normal-case tracking-normal">· {timeAgo(n.createdAt)}</span>
                        </div>
                        <div className="mt-0.5 truncate text-sm font-medium text-candle">{n.title}</div>
                        <div className="line-clamp-2 text-xs text-candle-muted">{n.body}</div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                      title="Dismiss"
                      className="absolute right-2 top-2 rounded-md p-1 text-candle-muted opacity-0 transition group-hover:opacity-100 hover:bg-petal/10 hover:text-candle"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-petal/20 bg-gradient-to-r from-petal/5 to-transparent px-4 py-2 text-center text-[10px] uppercase tracking-widest text-candle-muted">
              {items.length} kept · latest 60
            </div>
          )}
        </div>
      )}
    </div>
  );
}
