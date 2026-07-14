import { X } from "lucide-react";
import { PANDA_STICKERS, type PandaStickerId } from "@/lib/panda-stickers";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (id: PandaStickerId) => void;
};

export function PandaStickerPicker({ open, onClose, onPick }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-velvet/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface border-t border-petal/30 rounded-t-3xl p-4 pb-6 shadow-2xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Panda stickers</p>
            <p className="font-serif italic text-lg text-candle">Pick a mood</p>
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-candle-muted hover:text-petal transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto">
          {PANDA_STICKERS.map((s) => (
            <button
              key={s.id}
              onClick={() => { onPick(s.id); onClose(); }}
              className="group aspect-square rounded-2xl bg-surface-elevated border border-border hover:border-petal/60 hover:bg-petal/10 transition-all p-1.5 flex flex-col items-center justify-center gap-0.5 active:scale-95"
              aria-label={s.label}
            >
              <img
                src={s.url}
                alt={s.label}
                loading="lazy"
                width={512}
                height={512}
                className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
