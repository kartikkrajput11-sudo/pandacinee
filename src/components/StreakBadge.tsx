import { Flame } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";

export function StreakBadge({ meId, partnerId }: { meId: string; partnerId: string | null }) {
  const { streak = 0, meChecked, partnerChecked, isLoading, checkIn } = useStreak(meId, partnerId);

  const live = !!(meChecked && partnerChecked);
  const oneLeft = (meChecked || partnerChecked) && !live;

  return (
    <div className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-3">
      <div
        className={`size-12 rounded-2xl flex items-center justify-center ${
          live ? "bg-petal text-velvet petal-glow" : "bg-velvet/40 text-candle-muted"
        }`}
      >
        <Flame className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-petal">Couple streak</p>
        <p className="font-serif text-2xl italic leading-none">
          {streak}
          <span className="text-sm text-candle-muted not-italic"> day{streak === 1 ? "" : "s"}</span>
        </p>
        {!partnerId && <p className="text-[10px] text-candle-muted mt-0.5">Pair up to start a streak</p>}
        {partnerId && oneLeft && (
          <p className="text-[10px] text-candle-muted mt-0.5">
            {meChecked ? "Waiting for them to check in…" : "They checked in — your turn 🐼"}
          </p>
        )}
        {partnerId && live && (
          <p className="text-[10px] text-petal mt-0.5">🔥 Both in for today</p>
        )}
      </div>
      {partnerId && !meChecked && (
        <button
          onClick={() => checkIn.mutate()}
          disabled={checkIn.isPending || isLoading}
          className="px-3 py-2 rounded-full bg-petal text-velvet text-xs font-semibold disabled:opacity-40"
        >
          Check in
        </button>
      )}
    </div>
  );
}
