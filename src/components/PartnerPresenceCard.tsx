import { useEffect, useState } from "react";
import { Circle, Clock } from "lucide-react";
import type { Profile } from "@/hooks/useProfile";
import { UserAvatar } from "@/components/UserAvatar";

export function PartnerPresenceCard({
  partner,
  nickname,
}: {
  partner: Profile;
  nickname?: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const lastSeenAt = partner.last_seen_at ? new Date(partner.last_seen_at).getTime() : 0;
  // Online if the partner heartbeat pinged in the last 2 minutes (heartbeat cadence is 45s)
  const online = lastSeenAt > 0 && now - lastSeenAt < 2 * 60 * 1000;
  const lastSeen = lastSeenAt ? relTime(now - lastSeenAt) : "a while ago";

  const localTime = new Date(now).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const name = nickname || partner.display_name;
  const initials = partner.display_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative p-5 rounded-3xl glass-strong overflow-hidden animate-fade-up">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-0 size-48 rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, var(--lavender), transparent 70%)" }}
      />
      <div className="relative flex items-center gap-4">
        <div className="relative">
          <div className="size-14 rounded-2xl overflow-hidden bg-velvet flex items-center justify-center border border-border">
            {partner.avatar_url ? (
              <img src={partner.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-candle">{initials ?? "🐼"}</span>
            )}
          </div>
          <span
            className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-surface-elevated ${
              online ? "bg-emerald-400 animate-pulse-soft" : "bg-candle-muted/50"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-petal">With you</p>
          <p className="font-serif text-xl italic truncate leading-tight">{name}</p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-candle-muted">
            <Circle className={`size-2 ${online ? "fill-emerald-400 text-emerald-400" : "fill-current"}`} />
            <span>{online ? "Online now" : `Active ${lastSeen}`}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-widest text-candle-muted">
            <Clock className="size-3" /> Their time
          </div>
          <p className="font-serif text-lg italic tabular-nums">{localTime}</p>
        </div>
      </div>

      {(partner.mood || partner.mood_emoji) && (
        <div className="relative mt-4 pt-4 border-t border-border/60 flex items-center gap-3">
          <span className="text-2xl">{partner.mood_emoji ?? "💭"}</span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">Feeling</p>
            <p className="text-sm text-candle italic truncate">{partner.mood ?? "quietly present"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function relTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
