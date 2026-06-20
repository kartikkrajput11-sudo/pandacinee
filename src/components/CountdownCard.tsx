import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import {
  computeCountdown,
  daysTogether,
  milestoneLabel,
  nextAnniversary,
  nextMilestone,
} from "@/lib/anniversary";

export function CountdownCard({
  anniversaryDate,
  pairedAt,
  emoji = "🌸",
  accent = "#f87171",
  compact = false,
}: {
  anniversaryDate: string | null;
  pairedAt: string | null;
  emoji?: string;
  accent?: string;
  compact?: boolean;
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

  return (
    <div
      className="relative overflow-hidden rounded-3xl border p-5"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 35%, transparent)`,
        background: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${accent} 22%, transparent) 0%, transparent 70%), var(--surface)`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>
            Counting down to {targetLabel}
          </p>
          <p className="font-serif text-xl italic">
            {target.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <span className="text-3xl">{emoji}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <Cell n={cd.days} label="days" accent={accent} />
        <Cell n={cd.hours} label="hrs" accent={accent} />
        <Cell n={cd.minutes} label="min" accent={accent} />
        <Cell n={cd.seconds} label="sec" accent={accent} />
      </div>

      {!compact && (
        <p className="text-xs text-candle-muted text-center">
          <span className="text-candle font-semibold">{together}</span> days together so far ❤︎
        </p>
      )}
    </div>
  );
}

function Cell({ n, label, accent }: { n: number; label: string; accent: string }) {
  return (
    <div
      className="rounded-2xl py-2.5 text-center bg-velvet/40 border"
      style={{ borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` }}
    >
      <p className="font-serif text-2xl italic tabular-nums" style={{ color: "var(--candle)" }}>
        {String(n).padStart(2, "0")}
      </p>
      <p className="text-[9px] uppercase tracking-widest text-candle-muted">{label}</p>
    </div>
  );
}
