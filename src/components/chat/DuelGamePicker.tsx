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
          First two joiners take the seats. The rest of the circle joins as observers with their own private chat, and can watch the players' banter unfold.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {DUEL_GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => onPick(g)}
              className="text-left p-3 rounded-2xl bg-surface border border-border hover:border-petal/60 transition-colors flex items-center gap-3"
            >
              <span className="text-3xl">{g.emoji}</span>
              <span className="text-sm font-medium text-candle">{g.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
