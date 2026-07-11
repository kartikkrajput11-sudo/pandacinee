import { Flame, Trophy, Sparkles } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";

export function StreakBadge({ meId, partnerId }: { meId: string; partnerId: string | null }) {
  const { streak = 0, meChecked, partnerChecked, isLoading, checkIn } = useStreak(meId, partnerId);

  const live = !!(meChecked && partnerChecked);
  const oneLeft = (meChecked || partnerChecked) && !live;

  const message = !partnerId
    ? "Pair up to start your streak together."
    : live
    ? "Both checked in — the flame burns bright tonight."
    : meChecked
    ? "Waiting for them to check in…"
    : partnerChecked
    ? "They already checked in — your turn."
    : "Tap in to keep the flame alive.";

  return (
    <div className="relative p-5 rounded-3xl glass-strong overflow-hidden animate-fade-up">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-10 size-48 rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, var(--petal), transparent 70%)" }}
      />

      <div className="relative flex items-center gap-4">
        <div
          className={`relative size-16 rounded-2xl flex items-center justify-center shrink-0 ${
            live ? "bg-petal text-velvet animate-glow-breath" : "bg-velvet/60 text-candle-muted"
          }`}
        >
          <Flame className={`size-8 ${live ? "animate-flame" : ""}`} />
          {live && (
            <span className="absolute -top-1 -right-1 size-5 rounded-full bg-lavender text-velvet flex items-center justify-center">
              <Sparkles className="size-3" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-petal flex items-center gap-1.5">
            <Trophy className="size-3" /> Couple streak
          </p>
          <p className="font-serif text-3xl italic leading-none mt-1">
            {streak}
            <span className="text-sm text-candle-muted not-italic ml-1">day{streak === 1 ? "" : "s"}</span>
          </p>
          <p className="text-[11px] text-candle-muted mt-1.5 truncate">{message}</p>
        </div>

        {partnerId && !meChecked && (
          <button
            onClick={() => checkIn.mutate()}
            disabled={checkIn.isPending || isLoading}
            className="px-4 py-2.5 rounded-full bg-petal text-velvet text-xs font-semibold disabled:opacity-40 active:scale-95 transition-transform petal-glow"
          >
            Check in
          </button>
        )}
      </div>

      {/* dual-progress: me + partner today */}
      {partnerId && (
        <div className="relative grid grid-cols-2 gap-2 mt-4">
          <StatusPill label="You" done={!!meChecked} />
          <StatusPill label="Them" done={!!partnerChecked} />
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className={`px-3 py-2 rounded-xl text-[11px] flex items-center justify-between border transition-colors ${
        done ? "bg-petal-soft border-petal/40 text-candle" : "bg-velvet/40 border-border text-candle-muted"
      }`}
    >
      <span className="uppercase tracking-widest">{label}</span>
      <span className={`size-1.5 rounded-full ${done ? "bg-petal" : "bg-candle-muted/40"}`} />
    </div>
  );
}
