import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { CountdownCard } from "@/components/CountdownCard";
import { StreakBadge } from "@/components/StreakBadge";
import { DailyQuestionCard } from "@/components/DailyQuestionCard";
import { PartnerPresenceCard } from "@/components/PartnerPresenceCard";
import { MemoryOfTheDayCard } from "@/components/MemoryOfTheDayCard";
import {
  Heart,
  ArrowRight,
  Users,
  Clapperboard,
  BookHeart,
  Gift,
  Feather,
  Sparkles,
  Stars,
  Milestone,
  ListChecks,
  Compass,
  MapPin,
  CalendarHeart,
  ChevronDown,
} from "lucide-react";
import { AvatarImg } from "@/components/AvatarImg";
import { Button } from "@/components/ui/button";
import NotificationCenter from "@/components/NotificationCenter";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

type Entry = {
  to: string;
  label: string;
  caption: string;
  Icon: typeof Heart;
  search?: Record<string, unknown>;
};

const JOURNEY: { title: string; entries: Entry[] }[] = [
  {
    title: "Just for two",
    entries: [
      { to: "/app/letters", label: "Love Letters", caption: "Seal now, open later", Icon: Feather },
      { to: "/app/timeline", label: "Timeline", caption: "Highlights of us", Icon: Milestone },
      { to: "/app/constellation", label: "Constellation", caption: "Your night sky", Icon: Stars },
      { to: "/app/anniversary", label: "Anniversary", caption: "Just for us", Icon: Heart },
    ],
  },
  {
    title: "Evenings in",
    entries: [
      { to: "/app/movies", label: "Watch", caption: "Tonight's pick", Icon: Clapperboard, search: { q: "" } },
      { to: "/app/watchlist", label: "Watchlist", caption: "Shared queue", Icon: ListChecks },
      { to: "/app/memories", label: "Memories", caption: "Your archive", Icon: BookHeart },
      { to: "/app/journal", label: "Our Journal", caption: "Shared timeline", Icon: BookHeart },
    ],
  },
  {
    title: "Little dreams",
    entries: [
      { to: "/app/wishlist", label: "Wishlist", caption: "Little dreams", Icon: Gift },
      { to: "/app/bucket", label: "Bucket List", caption: "Dreams together", Icon: MapPin },
      { to: "/app/coupons", label: "Coupons", caption: "Sweet favors", Icon: Heart },
      { to: "/app/shop", label: "Tag Shop", caption: "Spend your coins", Icon: Sparkles },
    ],
  },
  {
    title: "Around you",
    entries: [
      { to: "/app/friends", label: "Friends", caption: "Your circle", Icon: Users },
      { to: "/app/calendar", label: "Calendar", caption: "Dates that matter", Icon: CalendarHeart },
      { to: "/app/me", label: "Profile", caption: "You & settings", Icon: Compass },
    ],
  },
];

function Home() {
  const { data, isLoading } = useProfile();
  const profile = data?.profile;
  const partner = data?.partner;

  const greeting = useGreeting();
  const partnerName = partner ? profile?.partner_nickname || partner.display_name : "your panda";
  const firstName = isLoading ? "…" : profile?.display_name?.split(" ")[0] ?? "Friend";

  return (
    <div className="relative mx-auto max-w-2xl px-5 pb-8 pt-10 space-y-6">
      {/* Header */}
      <header
        data-tour="home-hero"
        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 pb-5"
      >
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.24em] text-petal">
            {greeting}
          </p>
          <h1 className="truncate font-serif text-3xl font-semibold leading-tight text-candle">
            {partner ? `${firstName} & ${partnerName}` : firstName}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() => window.dispatchEvent(new Event("pandacine:open-tour"))}
            variant="chip"
            size="pill"
            className="hidden sm:inline-flex"
            aria-label="Start guided tour"
          >
            Tour
          </Button>
          <span data-tour="home-notify">
            <NotificationCenter />
          </span>
          <Avatar profile={profile} />
        </div>
      </header>

      <div className="h-px w-full bg-border" />

      {/* Invite banner (no partner) */}
      {!partner && !isLoading && (
        <Link
          to="/app/invite"
          className="block rounded-3xl border border-petal/30 bg-petal-soft p-6 transition-colors hover:border-petal/60"
        >
          <div className="flex items-start gap-4">
            <Heart className="mt-1 size-5 shrink-0 text-petal" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.22em] text-petal">Begin here</p>
              <h2 className="font-serif text-xl italic text-candle">Invite your partner</h2>
              <p className="mt-1 text-sm text-candle-muted">
                PANDACINE is built for two. Share your code to begin.
              </p>
            </div>
            <ArrowRight className="mt-1 size-4 text-petal" />
          </div>
        </Link>
      )}

      {/* Primary spotlight — countdown */}
      {partner && (
        <CountdownCard
          anniversaryDate={profile?.anniversary_date ?? null}
          pairedAt={profile?.paired_at ?? null}
          emoji={profile?.favorite_emoji ?? "🌸"}
          accent={profile?.favorite_color ?? "#8b7355"}
          me={profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : null}
          partner={{ display_name: partner.display_name, avatar_url: partner.avatar_url }}
        />
      )}

      {/* Utility row — streak & mood */}
      <div className="grid gap-4 sm:grid-cols-2">
        {profile && <StreakBadge meId={profile.id} partnerId={profile.partner_id} />}
        {profile && (
          <Link
            to="/app/mood"
            className="group flex items-center gap-4 rounded-3xl border border-border bg-surface-elevated p-5 transition-colors hover:border-petal/40"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background text-lg">
              {profile.mood_emoji ?? "💭"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-[0.22em] text-candle-muted">
                You are feeling
              </span>
              <span className="block truncate font-serif text-xl font-semibold text-candle">
                {profile.mood ? profile.mood : "Say a word"}
              </span>
            </span>
            <ArrowRight className="size-4 text-candle-muted transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {/* Partner presence */}
      {partner && (
        <PartnerPresenceCard partner={partner} nickname={profile?.partner_nickname ?? undefined} />
      )}

      {/* Question of the day */}
      {profile && (
        <DailyQuestionCard meId={profile.id} partnerId={profile.partner_id} partnerName={partnerName} />
      )}

      {/* Memory of the day */}
      <MemoryOfTheDayCard />

      {/* Your journey — one directory instead of many pages */}
      <section data-tour="home-signature" className="pt-2">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="font-serif text-2xl font-semibold text-candle">Your journey</h2>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-candle-muted">
            Everything, in one place
          </span>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-surface-elevated">
          {JOURNEY.map((group, i) => (
            <JourneyGroup key={group.title} group={group} defaultOpen={i === 0} />
          ))}
        </div>
      </section>
    </div>
  );
}

function JourneyGroup({
  group,
  defaultOpen,
}: {
  group: { title: string; entries: Entry[] };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="font-serif text-lg italic text-candle">{group.title}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-candle-muted transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-2 pb-2">
          {group.entries.map(({ to, label, caption, Icon, search }) => (
            <Link
              key={to}
              to={to as any}
              search={search as any}
              className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-background"
            >
              <Icon className="size-[18px] shrink-0 text-petal" strokeWidth={1.5} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-lg text-candle">{label}</span>
                <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-candle-muted">
                  {caption}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-candle-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
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
      className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elevated transition-transform active:scale-95"
    >
      {profile?.avatar_url ? (
        <AvatarImg src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
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
