import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Sparkles, X } from "lucide-react";

type Milestone =
  | { kind: "year"; count: number; anchor: Date }
  | { kind: "month"; count: number; anchor: Date };

function fullMonthsBetween(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function computeMilestone(anchorIso: string): Milestone | null {
  const anchor = new Date(anchorIso);
  if (isNaN(anchor.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchorDay = anchor.getDate();

  // Yearly: same month + day
  if (
    now.getMonth() === anchor.getMonth() &&
    now.getDate() === anchorDay &&
    now.getFullYear() > anchor.getFullYear()
  ) {
    const years = now.getFullYear() - anchor.getFullYear();
    return { kind: "year", count: years, anchor };
  }

  // Monthly: same day-of-month, at least 1 full month later
  const months = fullMonthsBetween(anchor, today);
  if (months >= 1 && now.getDate() === anchorDay) {
    // Skip if it's actually the yearly (handled above) — reached only if year mismatched
    return { kind: "month", count: months, anchor };
  }

  return null;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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

  const hearts = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.6,
      dur: 3.2 + Math.random() * 2.4,
      size: 12 + Math.random() * 20,
      key: i,
    })),
    [milestone?.kind, milestone?.count],
  );

  if (!open || !milestone) return null;

  const title = milestone.kind === "year"
    ? `Happy ${ordinal(milestone.count)} Anniversary`
    : `${ordinal(milestone.count)} Month Together`;
  const subtitle = milestone.kind === "year"
    ? `A whole year of you and ${partnerName}.`
    : `${milestone.count} ${milestone.count === 1 ? "month" : "months"} of you and ${partnerName}.`;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={() => setOpen(false)}
      />

      {/* Floating hearts */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {hearts.map((h) => (
          <span
            key={h.key}
            className="absolute -bottom-6 opacity-0 animate-anniv-float"
            style={{
              left: `${h.left}%`,
              width: h.size,
              height: h.size,
              animationDelay: `${h.delay}s`,
              animationDuration: `${h.dur}s`,
            }}
          >
            <Heart className="w-full h-full text-petal drop-shadow-[0_0_10px_rgba(236,72,153,0.55)] fill-current" />
          </span>
        ))}
      </div>

      {/* Card */}
      <div className="relative max-w-md w-full rounded-3xl border border-petal/30 bg-gradient-to-br from-velvet via-velvet/95 to-[#1a0d18] p-8 text-center shadow-[0_40px_120px_-30px_rgba(236,72,153,0.55)] animate-anniv-pop">
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-3 right-3 size-8 rounded-full bg-white/5 hover:bg-white/10 text-candle/70 hover:text-candle flex items-center justify-center border border-white/10"
        >
          <X className="size-4" />
        </button>

        {/* Ornate ring */}
        <div className="mx-auto mb-5 relative w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-petal/40 to-amber-300/30 blur-xl" />
          <div className="relative w-20 h-20 rounded-full border border-petal/40 flex items-center justify-center bg-velvet/60">
            <Heart className="size-9 text-petal fill-current drop-shadow-[0_0_12px_rgba(236,72,153,0.7)]" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 size-4 text-amber-200/90" />
          <Sparkles className="absolute -bottom-1 -left-2 size-3 text-amber-200/80" />
        </div>

        <p className="text-[10px] uppercase tracking-[0.4em] text-petal/80 font-semibold mb-2">
          Pandacine · Anniversary
        </p>
        <h2 className="font-serif italic text-3xl text-candle leading-tight mb-2">
          {title}
        </h2>
        <p className="text-sm text-candle/70 mb-6">
          {subtitle}
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
