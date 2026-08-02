import { Heart, Users } from "lucide-react";

/**
 * A small fixed pill that tells players which kind of room they're in.
 * Partner rooms get the petal/velvet treatment; friend rooms stay neutral.
 */
export function GameRoomBadge({
  partnerRoom,
  name,
}: {
  partnerRoom: boolean;
  name?: string | null;
}) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-30 pointer-events-none">
      <div
        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 backdrop-blur-xl shadow-lg ${
          partnerRoom
            ? "border-petal/50 bg-petal/15 shadow-petal/20"
            : "border-border bg-surface-elevated/90"
        }`}
      >
        {partnerRoom ? (
          <Heart className="size-3.5 text-petal" />
        ) : (
          <Users className="size-3.5 text-candle-muted" />
        )}
        <span
          className={`text-[10px] uppercase tracking-[0.22em] font-semibold ${
            partnerRoom ? "text-petal" : "text-candle-muted"
          }`}
        >
          {partnerRoom ? "Partner room" : "Friend room"}
        </span>
        {name && (
          <span className="text-[11px] text-candle/80 max-w-[9rem] truncate">· {name}</span>
        )}
      </div>
    </div>
  );
}
