import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Sparkles, Star, Crown, Flame, X } from "lucide-react";

type Milestone =
  | { kind: "year"; count: number; anchor: Date }
  | { kind: "month"; count: number; anchor: Date }
  | { kind: "day"; count: number; anchor: Date };

const DAY_MILESTONES = [7, 100, 150, 200, 300, 365];

function fullMonthsBetween(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function daysBetween(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.floor((b - a) / 86400000);
}

function computeMilestone(anchorIso: string): Milestone | null {
  const anchor = new Date(anchorIso);
  if (isNaN(anchor.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchorDay = anchor.getDate();

  // Yearly (highest priority)
  if (
    now.getMonth() === anchor.getMonth() &&
    now.getDate() === anchorDay &&
    now.getFullYear() > anchor.getFullYear()
  ) {
    return { kind: "year", count: now.getFullYear() - anchor.getFullYear(), anchor };
  }

  // Day-count milestones (7, 100, 150, 200, 300, 365)
  const dayCount = daysBetween(anchor, today);
  if (DAY_MILESTONES.includes(dayCount)) {
    return { kind: "day", count: dayCount, anchor };
  }

  // Monthly
  const months = fullMonthsBetween(anchor, today);
  if (months >= 1 && now.getDate() === anchorDay) {
    return { kind: "month", count: months, anchor };
  }

  return null;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

type Theme = {
  label: string;
  title: string;
  subtitle: (partner: string) => string;
  gradient: string; // radial gradient behind card
  ring: string;
  chip: string;
  glow: string;
  particleColors: string[];
  Icon: React.ComponentType<{ className?: string }>;
  crown?: boolean;
  fireworks?: boolean;
};

function themeFor(m: Milestone): Theme {
  if (m.kind === "year") {
    return {
      label: "Anniversary",
      title: `Happy ${ordinal(m.count)} Anniversary`,
      subtitle: (p) => `A whole year of you and ${p}.`,
      gradient: "radial-gradient(1200px 800px at 50% 20%, rgba(245,158,11,0.25), transparent 55%), radial-gradient(900px 700px at 50% 90%, rgba(236,72,153,0.28), transparent 60%)",
      ring: "from-amber-300/50 to-petal/50",
      chip: "text-amber-200",
      glow: "shadow-[0_40px_120px_-30px_rgba(245,158,11,0.55)]",
      particleColors: ["#f59e0b", "#fbbf24", "#ec4899", "#f5efd8"],
      Icon: Crown,
      crown: true,
      fireworks: true,
    };
  }
  if (m.kind === "day" && m.count === 365) {
    return {
      label: "365 Days",
      title: "365 Days Together",
      subtitle: (p) => `A full trip around the sun with ${p}.`,
      gradient: "radial-gradient(1200px 800px at 50% 20%, rgba(245,158,11,0.3), transparent 55%), radial-gradient(900px 700px at 50% 90%, rgba(236,72,153,0.28), transparent 60%)",
      ring: "from-amber-300/60 to-rose-300/50",
      chip: "text-amber-200",
      glow: "shadow-[0_40px_120px_-30px_rgba(245,158,11,0.6)]",
      particleColors: ["#f59e0b", "#fbbf24", "#ec4899", "#f5efd8"],
      Icon: Crown,
      crown: true,
      fireworks: true,
    };
  }
  if (m.kind === "day" && m.count === 300) {
    return {
      label: "300 Days",
      title: "300 Days Together",
      subtitle: (p) => `Three hundred days woven with ${p}.`,
      gradient: "radial-gradient(1200px 800px at 50% 20%, rgba(217,70,239,0.28), transparent 55%), radial-gradient(900px 700px at 50% 90%, rgba(236,72,153,0.25), transparent 60%)",
      ring: "from-fuchsia-300/50 to-petal/50",
      chip: "text-fuchsia-200",
      glow: "shadow-[0_40px_120px_-30px_rgba(217,70,239,0.5)]",
      particleColors: ["#d946ef", "#ec4899", "#f0abfc", "#f5efd8"],
      Icon: Flame,
      fireworks: true,
    };
  }
  if (m.kind === "day" && m.count === 200) {
    return {
      label: "200 Days",
      title: "200 Days Together",
      subtitle: (p) => `Two hundred quiet miracles with ${p}.`,
      gradient: "radial-gradient(1200px 800px at 50% 20%, rgba(168,85,247,0.28), transparent 55%), radial-gradient(900px 700px at 50% 90%, rgba(236,72,153,0.22), transparent 60%)",
      ring: "from-violet-300/50 to-petal/40",
      chip: "text-violet-200",
      glow: "shadow-[0_40px_120px_-30px_rgba(168,85,247,0.5)]",
      particleColors: ["#a855f7", "#c084fc", "#ec4899", "#f5efd8"],
      Icon: Star,
      fireworks: true,
    };
  }
  if (m.kind === "day" && m.count === 150) {
    return {
      label: "150 Days",
      title: "150 Days Together",
      subtitle: (p) => `A hundred and fifty days of ${p}.`,
      gradient: "radial-gradient(1200px 800px at 50% 20%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(900px 700px at 50% 90%, rgba(236,72,153,0.22), transparent 60%)",
      ring: "from-sky-300/50 to-petal/40",
      chip: "text-sky-200",
      glow: "shadow-[0_40px_120px_-30px_rgba(59,130,246,0.5)]",
      particleColors: ["#38bdf8", "#60a5fa", "#ec4899", "#f5efd8"],
      Icon: Sparkles,
      fireworks: true,
    };
  }
  if (m.kind === "day" && m.count === 100) {
    return {
      label: "100 Days",
      title: "100 Days Together 💯",
      subtitle: (p) => `A hundred days with ${p}. A perfect little era.`,
      gradient: "radial-gradient(1200px 800px at 50% 20%, rgba(244,114,182,0.32), transparent 55%), radial-gradient(900px 700px at 50% 90%, rgba(245,158,11,0.22), transparent 60%)",
      ring: "from-rose-300/60 to-amber-200/40",
      chip: "text-rose-200",
      glow: "shadow-[0_40px_120px_-30px_rgba(244,114,182,0.55)]",
      particleColors: ["#f472b6", "#ec4899", "#fbbf24", "#f5efd8"],
      Icon: Sparkles,
      fireworks: true,
    };
  }
  if (m.kind === "day" && m.count === 7) {
    return {
      label: "One Week",
      title: "One Week Together",
      subtitle: (p) => `Seven soft days with ${p}. The beginning of something.`,
      gradient: "radial-gradient(1200px 800px at 50% 20%, rgba(236,72,153,0.22), transparent 55%), radial-gradient(900px 700px at 50% 90%, rgba(236,72,153,0.15), transparent 60%)",
      ring: "from-petal/50 to-rose-200/40",
      chip: "text-petal",
      glow: "shadow-[0_40px_120px_-30px_rgba(236,72,153,0.5)]",
      particleColors: ["#ec4899", "#f472b6", "#fda4af", "#f5efd8"],
      Icon: Heart,
    };
  }
  // month
  return {
    label: "Monthiversary",
    title: `${ordinal(m.count)} Month Together`,
    subtitle: (p) => `${m.count} ${m.count === 1 ? "month" : "months"} of you and ${p}.`,
    gradient: "radial-gradient(1200px 800px at 50% 20%, rgba(236,72,153,0.22), transparent 55%), radial-gradient(900px 700px at 50% 90%, rgba(236,72,153,0.15), transparent 60%)",
    ring: "from-petal/40 to-rose-200/30",
    chip: "text-petal/90",
    glow: "shadow-[0_40px_120px_-30px_rgba(236,72,153,0.55)]",
    particleColors: ["#ec4899", "#f472b6", "#f5efd8"],
    Icon: Heart,
  };
}

export default function PairAnniversaryCelebration() {
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [partnerName, setPartnerName] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: me } = await supabase
        .from("profiles")
        .select("anniversary_date, paired_at, partner_id")
        .eq("id", uid)
        .maybeSingle();
      if (!alive || !me?.partner_id) return;
      const anchor = (me.anniversary_date as string | null) || (me.paired_at as string | null);
      if (!anchor) return;
      const m = computeMilestone(anchor);
      if (!m) return;
      const key = `pandacine.anniv.${m.kind}.${m.count}.${new Date().toISOString().slice(0, 10)}`;
      if (localStorage.getItem(key)) return;

      const { data: partner } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", me.partner_id)
        .maybeSingle();
      if (!alive) return;
      setPartnerName(partner?.display_name || partner?.username || "your panda");
      setMilestone(m);
      setOpen(true);
      localStorage.setItem(key, "1");
    })();
    return () => { alive = false; };
  }, []);

  const theme = useMemo(() => (milestone ? themeFor(milestone) : null), [milestone]);

  const particles = useMemo(
    () => Array.from({ length: 46 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.4,
      dur: 3.6 + Math.random() * 3.2,
      size: 8 + Math.random() * 18,
      rot: Math.random() * 360,
      color: theme?.particleColors[i % (theme?.particleColors.length || 1)] || "#ec4899",
      shape: i % 3 === 0 ? "heart" : i % 3 === 1 ? "star" : "spark",
      key: i,
    })),
    [theme, milestone?.kind, milestone?.count],
  );

  const rays = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      key: i,
      angle: (i * 360) / 14,
      delay: i * 0.06,
    })),
    [milestone?.kind, milestone?.count],
  );

  const fireworks = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({
      key: i,
      top: 18 + Math.random() * 40,
      left: 10 + Math.random() * 80,
      delay: i * 0.4,
      color: theme?.particleColors[i % (theme?.particleColors.length || 1)] || "#ec4899",
    })),
    [theme, milestone?.kind, milestone?.count],
  );

  if (!open || !milestone || !theme) return null;

  const Icon = theme.Icon;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop with themed bloom */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={() => setOpen(false)}
      />
      <div
        className="absolute inset-0 pointer-events-none animate-anniv-bloom"
        style={{ background: theme.gradient }}
      />

      {/* Fireworks */}
      {theme.fireworks && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {fireworks.map((f) => (
            <span
              key={f.key}
              className="absolute size-2 rounded-full animate-anniv-firework"
              style={{
                top: `${f.top}%`,
                left: `${f.left}%`,
                background: f.color,
                boxShadow: `0 0 20px ${f.color}`,
                animationDelay: `${f.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Rising particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <span
            key={p.key}
            className="absolute -bottom-6 opacity-0 animate-anniv-float"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              transform: `rotate(${p.rot}deg)`,
            }}
          >
            {p.shape === "heart" ? (
              <Heart className="w-full h-full fill-current" style={{ color: p.color, filter: `drop-shadow(0 0 10px ${p.color})` }} />
            ) : p.shape === "star" ? (
              <Star className="w-full h-full fill-current" style={{ color: p.color, filter: `drop-shadow(0 0 10px ${p.color})` }} />
            ) : (
              <Sparkles className="w-full h-full" style={{ color: p.color, filter: `drop-shadow(0 0 10px ${p.color})` }} />
            )}
          </span>
        ))}
      </div>

      {/* Radial rays behind card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {rays.map((r) => (
          <span
            key={r.key}
            className="absolute origin-center animate-anniv-ray"
            style={{
              width: 2,
              height: 320,
              background: `linear-gradient(to top, transparent, ${theme.particleColors[0]}88, transparent)`,
              transform: `rotate(${r.angle}deg)`,
              animationDelay: `${r.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div className={`relative max-w-md w-full rounded-3xl border border-white/15 bg-gradient-to-br from-velvet via-velvet/95 to-[#1a0d18] p-8 text-center ${theme.glow} animate-anniv-pop`}>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-3 right-3 size-8 rounded-full bg-white/5 hover:bg-white/10 text-candle/70 hover:text-candle flex items-center justify-center border border-white/10"
        >
          <X className="size-4" />
        </button>

        {/* Ornate icon */}
        <div className="mx-auto mb-5 relative w-24 h-24">
          <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${theme.ring} blur-2xl animate-anniv-halo`} />
          <div className={`relative w-24 h-24 rounded-full border-2 border-transparent bg-velvet/70 flex items-center justify-center`}
            style={{ boxShadow: `0 0 40px ${theme.particleColors[0]}66, inset 0 0 20px ${theme.particleColors[0]}44` }}>
            <Icon className={`size-11 ${theme.chip}`} />
          </div>
          {theme.crown && (
            <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 size-6 text-amber-300 animate-anniv-crown" />
          )}
          <Sparkles className="absolute -top-1 -right-1 size-4 text-amber-200/90 animate-pulse" />
          <Sparkles className="absolute -bottom-1 -left-2 size-3 text-amber-200/80 animate-pulse" style={{ animationDelay: "0.4s" }} />
        </div>

        <p className={`text-[10px] uppercase tracking-[0.4em] ${theme.chip} font-semibold mb-2`}>
          Pandacine · {theme.label}
        </p>
        <h2 className="font-serif italic text-3xl text-candle leading-tight mb-2">
          {theme.title}
        </h2>
        <p className="text-sm text-candle/70 mb-6">
          {theme.subtitle(partnerName)}
        </p>

        <div className="text-[11px] uppercase tracking-[0.28em] text-candle/50 font-medium mb-6">
          Since {new Date(milestone.anchor).toLocaleDateString(undefined, {
            month: "long", day: "numeric", year: "numeric",
          })}
        </div>

        <button
          onClick={() => setOpen(false)}
          className="w-full py-3 rounded-full bg-gradient-to-r from-petal to-rose-400 text-velvet font-semibold text-sm tracking-wide hover:brightness-110 transition"
        >
          Celebrate together
        </button>
      </div>
    </div>
  );
}
