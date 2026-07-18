import { X } from "lucide-react";
import { DUEL_GAMES } from "@/hooks/useGroupMatch";

export function DuelGamePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (g: (typeof DUEL_GAMES)[number]) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-surface-elevated border border-border rounded-t-3xl sm:rounded-3xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Play together</p>
            <p className="font-serif italic text-lg">Duel game · others spectate</p>
          </div>
          <button onClick={onClose} className="text-candle-muted hover:text-candle">
            <X className="size-4" />
          </button>
        </div>
        <p className="text-[11px] text-candle-muted mb-3 italic">
          First joiners take the seats. The rest of the circle joins as observers with their own private chat, and can watch the players' banter unfold.
        </p>
        <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {DUEL_GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => onPick(g)}
              className="text-left p-3 rounded-2xl bg-surface border border-border hover:border-petal/60 hover:bg-petal/5 transition-colors flex flex-col items-start gap-1"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-2xl">{g.emoji}</span>
                <span className="ml-auto text-[9px] uppercase tracking-widest text-petal bg-petal/10 border border-petal/30 rounded-full px-1.5 py-0.5">
                  {g.maxPlayers} seat{g.maxPlayers === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-sm font-medium text-candle leading-tight">{g.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
