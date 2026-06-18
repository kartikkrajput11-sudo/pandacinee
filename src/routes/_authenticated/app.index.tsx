import { createFileRoute, Link } from "@tanstack/react-router";
import { useProfile } from "@/hooks/useProfile";
import { Petals } from "@/components/Petals";
import { Sparkles, Heart, Calendar, ArrowRight, Film, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

function Home() {
  const { data, isLoading } = useProfile();
  const profile = data?.profile;
  const partner = data?.partner;

  const greeting = useGreeting();

  return (
    <div className="relative px-5 pt-10">
      <Petals count={4} />

      <header className="relative z-10 flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-petal mb-1">{greeting}</p>
          <h1 className="font-serif text-3xl italic">
            {isLoading ? "…" : profile?.display_name?.split(" ")[0] ?? "Friend"}
          </h1>
          {partner && (
            <p className="text-xs text-candle-muted mt-1">
              with {partner.display_name} ❤︎
            </p>
          )}
        </div>
        <Avatar profile={profile} />
      </header>

      {!partner && !isLoading && (
        <Link
          to="/app/invite"
          className="relative z-10 block mb-6 p-5 rounded-3xl border border-petal/30 bg-petal-soft hover:bg-petal/25 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="size-10 rounded-2xl bg-petal text-velvet flex items-center justify-center shrink-0">
              <Heart className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-xl italic mb-1">Invite your partner</h3>
              <p className="text-sm text-candle-muted">
                PANDACINE is built for two. Share your code to begin.
              </p>
            </div>
            <ArrowRight className="size-5 text-petal mt-1" />
          </div>
        </Link>
      )}

      {/* Relationship Wrapped */}
      <div
        className="relative z-10 mb-5 p-6 rounded-3xl border border-border overflow-hidden"
        style={{ background: "var(--gradient-petal)" }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-petal mb-1">Our story</p>
            <h2 className="font-serif text-2xl italic">Relationship Wrapped</h2>
          </div>
          <Sparkles className="size-6 text-petal" />
        </div>
        <p className="text-sm text-candle-muted mb-5">
          {partner
            ? `You and ${partner.display_name} are just getting started.`
            : "Pair up to start collecting moments."}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Messages" value={partner ? "0" : "—"} />
          <Stat label="Movies" value={partner ? "0" : "—"} />
          <Stat label="Days" value={partner ? daysSince(profile?.paired_at) : "—"} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="relative z-10 grid grid-cols-2 gap-3 mb-5">
        <Link
          to="/app/anniversary"
          className="p-4 bg-surface rounded-2xl border border-border hover:border-petal/40 transition-colors"
        >
          <Calendar className="size-5 text-petal mb-2" />
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">Just for us</p>
          <p className="font-serif italic text-lg mt-0.5">Anniversary</p>
        </Link>
        <Link
          to="/app/chat"
          className="p-4 bg-surface rounded-2xl border border-border hover:border-petal/40 transition-colors"
        >
          <MessageCircle className="size-5 text-petal mb-2" />
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">Whisper</p>
          <p className="font-serif italic text-lg mt-0.5">Chat</p>
        </Link>
        <Link
          to="/app/watch"
          className="p-4 bg-surface rounded-2xl border border-border hover:border-petal/40 transition-colors"
        >
          <Film className="size-5 text-petal mb-2" />
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">Tonight</p>
          <p className="font-serif italic text-lg mt-0.5">Watch together</p>
        </Link>
        <Link
          to="/app/play"
          className="p-4 bg-surface rounded-2xl border border-border hover:border-petal/40 transition-colors"
        >
          <Sparkles className="size-5 text-petal mb-2" />
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">Together</p>
          <p className="font-serif italic text-lg mt-0.5">Play games</p>
        </Link>
      </div>

      {/* Recent memories placeholder */}
      <section className="relative z-10">
        <h3 className="text-[10px] uppercase tracking-widest text-candle-muted mb-3">
          Recent memories
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-5 px-5">
          {["First message", "First movie", "First call"].map((m) => (
            <div
              key={m}
              className="min-w-[140px] aspect-[3/4] bg-surface rounded-2xl border border-border p-3 flex flex-col justify-end"
            >
              <p className="text-[10px] text-candle-muted uppercase tracking-widest">Soon</p>
              <p className="font-serif italic text-sm mt-1">{m}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Avatar({ profile }: { profile?: { avatar_url: string | null; display_name: string } | null }) {
  const initials = profile?.display_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Link
      to="/app/me"
      className="size-11 rounded-full bg-surface border border-border flex items-center justify-center overflow-hidden"
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-candle">{initials ?? "🐼"}</span>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-serif text-2xl italic text-candle">{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-candle-muted mt-0.5">{label}</p>
    </div>
  );
}

function useGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

function daysSince(iso?: string | null) {
  if (!iso) return "0";
  const ms = Date.now() - new Date(iso).getTime();
  return String(Math.max(0, Math.floor(ms / 86400000)));
}
