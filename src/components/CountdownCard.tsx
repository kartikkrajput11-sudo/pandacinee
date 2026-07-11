import { useEffect, useMemo, useState } from "react";
import { Calendar, Sparkles } from "lucide-react";
import {
  computeCountdown,
  daysTogether,
  milestoneLabel,
  nextAnniversary,
  nextMilestone,
} from "@/lib/anniversary";

type Profile = {
  display_name: string;
  avatar_url: string | null;
} | null;

export function CountdownCard({
  anniversaryDate,
  pairedAt,
  emoji = "🌸",
  accent = "#f87171",
  compact = false,
  me,
  partner,
}: {
  anniversaryDate: string | null;
  pairedAt: string | null;
  emoji?: string;
  accent?: string;
  compact?: boolean;
  me?: Profile;
  partner?: Profile;
}) {
  const ann = nextAnniversary(anniversaryDate, pairedAt);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!ann) {
    return (
      <div className="p-4 rounded-2xl border border-border bg-surface flex items-center gap-3">
        <Calendar className="size-5 text-petal" />
        <p className="text-sm text-candle-muted">Set your anniversary in your profile.</p>
      </div>
    );
  }

  const milestone = nextMilestone(ann.base);
  const target = milestone && milestone.target.getTime() < ann.next.getTime() ? milestone.target : ann.next;
  const targetLabel = milestone && milestone.target.getTime() < ann.next.getTime()
    ? milestoneLabel(milestone.days)
    : `Year ${ann.years}`;

  const cd = computeCountdown(target, now);
  const together = daysTogether(ann.base);

  // Progress toward next milestone
  const totalWindow = milestone ? milestone.days : 365;
  const done = Math.max(0, totalWindow - cd.days);
  const pct = Math.min(100, Math.max(0, (done / totalWindow) * 100));

  const isCelebration = cd.days === 0 && cd.hours < 24;

  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-6 glass-strong animate-fade-up"
      style={{
        boxShadow: `0 30px 80px -40px ${accent}88, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full blur-3xl opacity-25"
        style={{ background: `radial-gradient(circle, var(--lavender), transparent 70%)` }}
      />

      {/* Floating petals inside card */}
      <FloatingSpecks accent={accent} />

      <div className="relative flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="size-3 text-petal" />
            <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: accent }}>
              {targetLabel}
            </p>
          </div>
          <p className="font-serif text-2xl italic leading-tight">
            {target.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <AvatarStack me={me} partner={partner} emoji={emoji} />
      </div>

      <div className="relative grid grid-cols-4 gap-2 mb-4">
        <Cell n={cd.days} label="days" accent={accent} />
        <Cell n={cd.hours} label="hrs" accent={accent} />
        <Cell n={cd.minutes} label="min" accent={accent} />
        <Cell n={cd.seconds} label="sec" accent={accent} pulse />
      </div>

      {/* Milestone progress bar */}
      <div className="relative mb-3">
        <div className="h-1.5 rounded-full bg-velvet/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${accent}, color-mix(in oklab, var(--lavender) 70%, ${accent}))`,
            }}
          >
            <span className="absolute inset-0 animate-shine bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">{Math.round(pct)}% there</p>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">{together} days together</p>
        </div>
      </div>

      {isCelebration && (
        <p className="relative text-center text-sm font-serif italic text-petal animate-pulse-soft">
          ✨ Today is the day — celebrate ✨
        </p>
      )}
      {!isCelebration && !compact && (
        <p className="relative text-xs text-candle-muted text-center italic">
          {romanticLine(cd.days, together)}
        </p>
      )}
    </div>
  );
}

function romanticLine(daysLeft: number, together: number) {
  if (daysLeft <= 7) return `Only ${daysLeft} day${daysLeft === 1 ? "" : "s"} left — the world is holding its breath.`;
  if (together < 100) return `${together} days in and already unforgettable.`;
  if (together < 365) return `Every hour written into the story.`;
  return `${Math.floor(together / 365)} year${together >= 730 ? "s" : ""} of us, and counting.`;
}

function Cell({ n, label, accent, pulse }: { n: number; label: string; accent: string; pulse?: boolean }) {
  const str = String(n).padStart(2, "0");
  return (
    <div
      className="relative rounded-2xl py-3 text-center overflow-hidden"
      style={{
        background: `linear-gradient(180deg, color-mix(in oklab, ${accent} 14%, transparent), color-mix(in oklab, var(--velvet) 60%, transparent))`,
        border: `1px solid color-mix(in oklab, ${accent} 22%, transparent)`,
      }}
    >
      <p
        key={str}
        className="font-serif text-[26px] italic tabular-nums leading-none animate-digit-flip"
        style={{ color: "var(--candle)" }}
      >
        {str}
      </p>
      <p className="text-[9px] uppercase tracking-widest text-candle-muted mt-1.5">{label}</p>
      {pulse && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 size-1.5 rounded-full animate-pulse-soft"
          style={{ background: accent }}
        />
      )}
    </div>
  );
}

function AvatarStack({ me, partner, emoji }: { me?: Profile; partner?: Profile; emoji: string }) {
  return (
    <div className="flex items-center">
      <div className="flex -space-x-3">
        <Avatar profile={me} />
        <Avatar profile={partner} />
      </div>
      <span className="ml-2 text-2xl">{emoji}</span>
    </div>
  );
}

function Avatar({ profile }: { profile?: Profile }) {
  const initials = profile?.display_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="size-9 rounded-full border-2 border-surface-elevated overflow-hidden bg-velvet flex items-center justify-center">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold text-candle">{initials ?? "🐼"}</span>
      )}
    </div>
  );
}

function FloatingSpecks({ accent }: { accent: string }) {
  const specks = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        left: (i * 37) % 100,
        delay: (i * 1.9) % 8,
        duration: 8 + ((i * 3) % 6),
        size: 3 + ((i * 2) % 4),
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]" aria-hidden>
      {specks.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full animate-petal blur-[1px]"
          style={{
            left: `${s.left}%`,
            top: 0,
            width: s.size,
            height: s.size,
            background: `color-mix(in oklab, ${accent} 60%, transparent)`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}
