import { createFileRoute, Link } from "@tanstack/react-router";
import { useProfile } from "@/hooks/useProfile";
import { Petals } from "@/components/Petals";
import { CountdownCard } from "@/components/CountdownCard";
import { StreakBadge } from "@/components/StreakBadge";
import { DailyQuestionCard } from "@/components/DailyQuestionCard";
import { PartnerPresenceCard } from "@/components/PartnerPresenceCard";

import { MemoryOfTheDayCard } from "@/components/MemoryOfTheDayCard";
import { Heart, ArrowRight, Users, LineChart, Clapperboard, BookHeart, Gift, Feather, Sparkles, Stars, Milestone, ListChecks, Compass, MapPin, CalendarHeart } from "lucide-react";
import { AvatarImg } from "@/components/AvatarImg";
import NotificationCenter from "@/components/NotificationCenter";
import { EditorialPageHeader, EditorialSectionHeader } from "@/components/editorial/SectionHeader";




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
    <div className="relative px-5 pt-10 space-y-6">
      <Petals count={4} />



      {/* Editorial hero header */}
      <div data-tour="home-hero">
      <EditorialPageHeader
        eyebrow={greeting}
        title={
          <>
            <span className="text-candle-muted/70 not-italic text-xl md:text-2xl font-serif">
              Hello,{" "}
            </span>
            {isLoading ? "…" : profile?.display_name?.split(" ")[0] ?? "Friend"}
          </>
        }
        subtitle={
          partner ? (
            <>
              with <span className="text-candle">{partnerName}</span>{" "}
              <span className="text-petal">❤︎</span>
            </>
          ) : (
            "A cinema for two — invite your panda to begin."
          )
        }
        trailing={
          <>
            <button
              onClick={() => window.dispatchEvent(new Event("pandacine:open-tour"))}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/70 border border-petal/40 text-[10px] uppercase tracking-[0.28em] text-petal hover:bg-petal/10 transition"
              aria-label="Start guided tour"
            >
              ✦ Tour
            </button>
            <span data-tour="home-notify"><NotificationCenter /></span>
            <Avatar profile={profile} />
          </>
        }
        className="relative z-[120]"
      />
      </div>


      {/* Invite banner (no partner) */}
      {!partner && !isLoading && (
        <Link
          to="/app/invite"
          className="relative z-10 block p-5 rounded-3xl glass-strong hover:-translate-y-0.5 transition-transform"
        >
          <div className="flex items-start gap-4">
            <div className="size-11 rounded-2xl bg-petal text-velvet flex items-center justify-center shrink-0 petal-glow">
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

      {/* Hero: Anniversary countdown */}
      {partner && (
        <div className="relative z-10">
          <CountdownCard
            anniversaryDate={profile?.anniversary_date ?? null}
            pairedAt={profile?.paired_at ?? null}
            emoji={profile?.favorite_emoji ?? "🌸"}
            accent={profile?.favorite_color ?? "#f87171"}
            me={profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : null}
            partner={{ display_name: partner.display_name, avatar_url: partner.avatar_url }}
          />
        </div>
      )}

      {/* Partner presence */}
      {partner && (
        <div className="relative z-10">
          <PartnerPresenceCard partner={partner} nickname={profile?.partner_nickname ?? undefined} />
        </div>
      )}

      {/* Couple streak */}
      {profile && (
        <div className="relative z-10">
          <StreakBadge meId={profile.id} partnerId={profile.partner_id} />
        </div>
      )}

      {/* Today's question */}
      {profile && (
        <div className="relative z-10">
          <DailyQuestionCard meId={profile.id} partnerId={profile.partner_id} partnerName={partnerName} />
        </div>
      )}


      {/* Mood entry */}
      {profile && (
        <Link
          to="/app/mood"
          className="relative z-10 flex items-center gap-4 p-5 rounded-3xl glass overflow-hidden hover:-translate-y-0.5 transition-transform group"
        >
          <div className="size-12 rounded-2xl bg-petal-soft border border-petal/30 flex items-center justify-center text-xl">
            {profile.mood_emoji ?? "💭"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-petal flex items-center gap-1.5">
              <LineChart className="size-3" /> Mood
            </p>
            <p className="font-serif text-lg italic truncate leading-tight">
              {profile.mood ? profile.mood : "How are you feeling?"}
            </p>
            <p className="text-[11px] text-candle-muted mt-0.5">Share it — set the tone of your day.</p>
          </div>
          <ArrowRight className="size-4 text-candle-muted group-hover:text-petal group-hover:translate-x-0.5 transition-all" />
        </Link>
      )}

      {/* Memory of the day */}
      <div className="relative z-10">
        <MemoryOfTheDayCard />
      </div>

      {/* Section: Signature — luxury features for two */}
      {partner && (
        <section className="relative z-10" data-tour="home-signature">
          <EditorialSectionHeader eyebrow="✦ Chapter I" title="Signature" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">

            <SignatureTile to="/app/letters" Icon={Feather} label="Love Letters" caption="Seal now, open later" swatch="from-[#c9a84c]/40 to-[#f0d78c]/10" />
            <SignatureTile to="/app/timeline" Icon={Milestone} label="Timeline" caption="Highlights of us" swatch="from-[#c96b7a]/40 to-[#f0c0cc]/10" />
            <SignatureTile to="/app/constellation" Icon={Stars} label="Constellation" caption="Your night sky" swatch="from-[#5cbdb9]/40 to-[#0d7a5f]/10" />
            <SignatureTile to="/app/watchlist" Icon={ListChecks} label="Watchlist" caption="Shared queue" swatch="from-[#f0d78c]/40 to-[#c9a84c]/10" />
          </div>
        </section>

      )}


      {/* Section: Together */}
      <section className="relative z-10">
        <EditorialSectionHeader eyebrow="✦ Chapter II" title="Together" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <TileLink to="/app/movies" search={{ q: "" }} Icon={Clapperboard} label="Watch" caption="Tonight's pick" />
          <TileLink to="/app/memories" Icon={BookHeart} label="Memories" caption="Your archive" />
          <TileLink to="/app/anniversary" Icon={Heart} label="Anniversary" caption="Just for us" />
          <TileLink to="/app/wishlist" Icon={Gift} label="Wishlist" caption="Little dreams" />
          <TileLink to="/app/coupons" Icon={Heart} label="Coupons" caption="Sweet favors" />
          <TileLink to="/app/bucket" Icon={MapPin} label="Bucket List" caption="Dreams together" />
          <TileLink to="/app/journal" Icon={BookHeart} label="Our Journal" caption="Shared timeline" />
          <TileLink to="/app/calendar" Icon={CalendarHeart} label="The Calendar" caption="Every date that matters" />
        </div>
      </section>

      {/* Friends circle — de-emphasized */}
      <Link
        to="/app/friends"
        className="relative z-10 flex items-center gap-3 p-4 rounded-2xl bg-surface/60 border border-border hover:border-petal/40 transition-colors"
      >
        <div className="size-9 rounded-xl bg-petal-soft flex items-center justify-center">
          <Users className="size-4 text-petal" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">Your circle</p>
          <p className="text-sm text-candle">Friends</p>
        </div>
        <ArrowRight className="size-4 text-candle-muted" />
      </Link>
    </div>
  );
}

function TileLink({
  to,
  search,
  Icon,
  label,
  caption,
}: {
  to: string;
  search?: Record<string, unknown>;
  Icon: typeof Heart;
  label: string;
  caption: string;
}) {
  return (
    <Link
      to={to as any}
      search={search as any}
      className="group relative p-4 rounded-2xl glass overflow-hidden hover:-translate-y-0.5 transition-transform"
    >
      <Icon className="size-5 text-petal mb-3" />
      <p className="text-[10px] uppercase tracking-widest text-candle-muted">{caption}</p>
      <p className="font-serif italic text-lg mt-0.5">{label}</p>
    </Link>
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
      className="size-11 rounded-full glass flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
    >
      {profile?.avatar_url ? (
        <AvatarImg src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
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

function SignatureTile({
  to,
  Icon,
  label,
  caption,
  swatch,
}: {
  to: string;
  Icon: typeof Heart;
  label: string;
  caption: string;
  swatch: string;
}) {
  return (
    <Link
      to={to as any}
      className="group relative aspect-[1.1] p-4 rounded-2xl overflow-hidden bg-velvet border border-petal/20 hover:-translate-y-0.5 transition-transform"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${swatch} opacity-70 pointer-events-none`} />
      <div className="relative z-10 h-full flex flex-col">
        <Icon className="size-5 text-candle" />
        <div className="mt-auto">
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">{caption}</p>
          <p className="font-serif italic text-lg text-candle mt-0.5 leading-tight">{label}</p>
        </div>
      </div>
    </Link>
  );
}
