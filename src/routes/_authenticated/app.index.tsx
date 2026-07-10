import { createFileRoute, Link } from "@tanstack/react-router";
import { useProfile } from "@/hooks/useProfile";
import { Petals } from "@/components/Petals";
import { CountdownCard } from "@/components/CountdownCard";
import { StreakBadge } from "@/components/StreakBadge";
import { DailyQuestionCard } from "@/components/DailyQuestionCard";
import { Sparkles, Heart, Calendar, ArrowRight, Film, MessageCircle, Users, Gift, BookHeart, LineChart, Clapperboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

function Home() {
  const { data, isLoading } = useProfile();
  const profile = data?.profile;
  const partner = data?.partner;

  const greeting = useGreeting();
  const partnerName = partner ? (profile?.partner_nickname || partner.display_name) : "your panda";

  return (
    <div className="relative px-5 pt-10">
      <Petals count={4} />

      <header className="relative z-10 flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-petal mb-1">{greeting}</p>
          <h1 className="font-serif text-3xl italic">
            {isLoading ? "…" : profile?.display_name?.split(" ")[0] ?? "Friend"}
          </h1>
          {partner && (
            <p className="text-xs text-candle-muted mt-1">
              with {partnerName} ❤︎
            </p>
          )}
        </div>
        <Avatar profile={profile} />
      </header>

      {!partner && !isLoading && (
        <Link
          to="/app/invite"
          className="relative z-10 block mb-5 p-5 rounded-3xl border border-petal/30 bg-petal-soft hover:bg-petal/25 transition-colors"
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

      {/* Live anniversary countdown */}
      {partner && (
        <div className="relative z-10 mb-5">
          <CountdownCard
            anniversaryDate={profile?.anniversary_date ?? null}
            pairedAt={profile?.paired_at ?? null}
            emoji={profile?.favorite_emoji ?? "🌸"}
            accent={profile?.favorite_color ?? "#f87171"}
          />
        </div>
      )}

      {/* Streak */}
      {profile && (
        <div className="relative z-10 mb-5">
          <StreakBadge meId={profile.id} partnerId={profile.partner_id} />
        </div>
      )}

      {/* Daily question */}
      {profile && (
        <div className="relative z-10 mb-5">
          <DailyQuestionCard meId={profile.id} partnerId={profile.partner_id} partnerName={partnerName} />
        </div>
      )}

      {/* Bento quick-actions */}
      <div className="relative z-10 grid grid-cols-4 gap-3 mb-4">
        <Link
          to="/app/chat"
          className="col-span-2 row-span-2 p-5 bg-surface rounded-3xl border border-border hover:border-petal/50 transition-all hover:-translate-y-0.5 relative overflow-hidden group"
        >
          <div className="absolute -top-8 -right-8 size-32 aurora-bg rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" />
          <MessageCircle className="size-6 text-petal mb-3 relative" />
          <p className="text-[10px] uppercase tracking-widest text-candle-muted relative">Whisper</p>
          <p className="font-serif italic text-2xl mt-0.5 relative">Chats</p>
          <p className="text-xs text-candle-muted mt-2 relative">Private messages, voice notes, stickers</p>
        </Link>
        <Link
          to="/app/watch"
          className="col-span-2 p-4 bg-surface rounded-3xl border border-border hover:border-petal/50 transition-all hover:-translate-y-0.5 relative overflow-hidden"
        >
          <Film className="size-5 text-petal mb-2" />
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">Tonight</p>
          <p className="font-serif italic text-lg mt-0.5">Watch together</p>
        </Link>
        <Link
          to="/app/anniversary"
          className="p-4 bg-surface rounded-3xl border border-border hover:border-petal/50 transition-all flex flex-col items-center text-center justify-center gap-1"
        >
          <Calendar className="size-5 text-petal" />
          <span className="text-[10px] font-semibold text-candle">Anniversary</span>
        </Link>
        <Link
          to="/app/play"
          className="p-4 bg-surface rounded-3xl border border-border hover:border-petal/50 transition-all flex flex-col items-center text-center justify-center gap-1"
        >
          <Sparkles className="size-5 text-petal" />
          <span className="text-[10px] font-semibold text-candle">Play</span>
        </Link>
      </div>

      {/* Couple tools */}
      <div className="relative z-10 grid grid-cols-4 gap-2 mb-4">
        <Link to="/app/movies" search={{ q: "" }} className="p-3 bg-surface rounded-2xl border border-border flex flex-col items-center text-center gap-1 hover:border-petal/40 transition-colors">
          <Clapperboard className="size-5 text-petal" />
          <span className="text-[10px] font-semibold text-candle">Movies</span>
        </Link>
        <Link to="/app/memories" className="p-3 bg-surface rounded-2xl border border-border flex flex-col items-center text-center gap-1 hover:border-petal/40 transition-colors">
          <BookHeart className="size-5 text-petal" />
          <span className="text-[10px] font-semibold text-candle">Memories</span>
        </Link>
        <Link to="/app/wishlist" className="p-3 bg-surface rounded-2xl border border-border flex flex-col items-center text-center gap-1 hover:border-petal/40 transition-colors">
          <Gift className="size-5 text-petal" />
          <span className="text-[10px] font-semibold text-candle">Wishlist</span>
        </Link>
        <Link to="/app/mood" className="p-3 bg-surface rounded-2xl border border-border flex flex-col items-center text-center gap-1 hover:border-petal/40 transition-colors">
          <LineChart className="size-5 text-petal" />
          <span className="text-[10px] font-semibold text-candle">Mood</span>
        </Link>
      </div>

      <Link
        to="/app/friends"
        className="relative z-10 mb-4 flex items-center gap-3 p-4 bg-surface rounded-2xl border border-border hover:border-petal/40 transition-colors"
      >
        <div className="size-10 rounded-xl bg-petal-soft flex items-center justify-center">
          <Users className="size-5 text-petal" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">Your circle</p>
          <p className="font-serif italic text-base">Friends</p>
        </div>
        <ArrowRight className="size-4 text-candle-muted" />
      </Link>
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

function useGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}
