import { X } from "lucide-react";
import { GAMES, GAME_KINDS, type GameKind } from "@/lib/games";

export type GamePick = { id: GameKind; name: string; emoji: string; body: string; href: string };

function hrefFor(kind: GameKind): string {
  return GAMES[kind].href ?? `/app/games/${kind}`;
}

export function GameInvitePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (g: GamePick) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-surface-elevated border border-border rounded-t-3xl sm:rounded-3xl p-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Invite to play</p>
            <p className="font-serif italic text-lg">Pick a game together 🎮</p>
          </div>
          <button onClick={onClose} className="text-candle-muted hover:text-candle"><X className="size-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {GAME_KINDS.filter((k) => !GAMES[k].comingSoon).map((k) => {
            const g = GAMES[k];
            return (
              <button
                key={k}
                onClick={() => onPick({ id: k, name: g.name, emoji: g.emoji, body: g.body, href: hrefFor(k) })}
                className="text-left p-3 rounded-2xl bg-surface border border-border hover:border-petal/60 transition-colors flex flex-col gap-1"
              >
                <span className="text-2xl">{g.emoji}</span>
                <span className="text-sm font-medium text-candle line-clamp-1">{g.name}</span>
                <span className="text-[11px] text-candle-muted line-clamp-2">{g.body}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
