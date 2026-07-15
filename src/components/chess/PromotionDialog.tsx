import type { Color } from "chess.js";
import { PIECE_GLYPH, type PromotionPiece } from "@/lib/chess";

export function PromotionDialog({
  color,
  onPick,
  onCancel,
}: {
  color: Color;
  onPick: (p: PromotionPiece) => void;
  onCancel: () => void;
}) {
  const opts: PromotionPiece[] = ["q", "r", "b", "n"];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-petal/30 rounded-3xl p-6 shadow-2xl max-w-sm w-full"
      >
        <p className="text-[10px] uppercase tracking-widest text-petal text-center mb-2">Promote to</p>
        <h3 className="font-serif italic text-2xl text-center mb-4">Choose a piece</h3>
        <div className="grid grid-cols-4 gap-2">
          {opts.map((p) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              className="aspect-square flex items-center justify-center rounded-2xl bg-velvet border border-petal/20 hover:border-petal/60 hover:bg-petal/10 transition-all text-5xl"
              style={{ color: color === "w" ? "white" : "black", textShadow: color === "w" ? "0 1px 2px rgba(0,0,0,0.6)" : "0 1px 2px rgba(255,255,255,0.35)" }}
            >
              {PIECE_GLYPH[color][p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
