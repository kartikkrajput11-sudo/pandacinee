import { useEffect, useMemo, useState } from "react";
import { Sparkles, X, Heart } from "lucide-react";
import OwnersStoryOverlay from "./OwnersStoryOverlay";

// Top banner visible to every user for the whole 18th of each month.
// Auto-hides at end of day. Tapping opens the "how they met" story overlay.
export default function OwnersMonthiversary() {
  const [now, setNow] = useState(() => new Date());
  const [storyOpen, setStoryOpen] = useState(false);

  useEffect(() => {
    // Re-check date every minute so the banner disappears at midnight.
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const is18 = now.getDate() === 18;
  const monthName = useMemo(
    () => now.toLocaleString(undefined, { month: "long" }),
    [now]
  );

  if (!is18) return null;

  return (
    <>
      <button
        onClick={() => setStoryOpen(true)}
        className="fixed inset-x-0 top-0 z-[90] group flex items-center justify-center gap-2.5 px-4 py-2 text-left overflow-hidden animate-fade-in"
        style={{
          background:
            "linear-gradient(90deg, rgba(30,20,35,0.92) 0%, rgba(60,25,50,0.92) 50%, rgba(30,20,35,0.92) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(236,72,153,0.28)",
          boxShadow: "0 10px 40px -20px rgba(236,72,153,0.55)",
        }}
        aria-label="Open owners' story"
      >
        {/* champagne hairline */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f5d6a4]/70 to-transparent" />
        {/* shimmer sweep */}
        <span
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 opacity-40"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(245,214,164,0.35), transparent)",
            animation: "monthiversary-shine 4.5s linear infinite",
          }}
        />

        <span className="relative flex items-center gap-1.5">
          <Heart className="size-3.5 text-petal" fill="currentColor" />
          <Sparkles className="size-3 text-[#f5d6a4] animate-pulse-soft" />
        </span>

        <span className="relative flex items-baseline gap-2 min-w-0">
          <span className="text-[9px] uppercase tracking-[0.28em] text-[#f5d6a4] shrink-0">
            {monthName} 18
          </span>
          <span className="font-serif italic text-[12px] text-candle truncate">
            Founders' monthiversary — tap to relive their story
          </span>
        </span>

        <span className="relative ml-1 text-[9px] uppercase tracking-[0.24em] text-petal opacity-80 group-hover:opacity-100 transition-opacity hidden sm:inline">
          Open ✨
        </span>

        <style>{`
          @keyframes monthiversary-shine {
            0% { transform: translateX(0); }
            100% { transform: translateX(500%); }
          }
        `}</style>
      </button>

      {/* Spacer so page content isn't hidden behind the fixed banner */}
      <div aria-hidden className="h-9" />

      <OwnersStoryOverlay open={storyOpen} onClose={() => setStoryOpen(false)} />
    </>
  );
}
