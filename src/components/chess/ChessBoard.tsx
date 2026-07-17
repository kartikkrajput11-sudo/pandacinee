import { useEffect, useMemo, useRef, useState } from "react";
import type { Chess, Square, Color, PieceSymbol } from "chess.js";
import { FILES, RANKS, PIECE_GLYPH, legalTargets, squareOf } from "@/lib/chess";

type Props = {
  chess: Chess;
  orientation: Color;
  canMoveColor: Color | "both" | null; // null = view only
  lastMove: { from: Square; to: Square } | null;
  onMove: (from: Square, to: Square) => void;
};

export function ChessBoard({ chess, orientation, canMoveColor, lastMove, onMove }: Props) {
  const [selected, setSelected] = useState<Square | null>(null);

  const targets = useMemo(() => {
    if (!selected) return new Map<Square, boolean>();
    const m = new Map<Square, boolean>();
    legalTargets(chess, selected).forEach((t) => m.set(t.to, t.capture));
    return m;
  }, [chess, selected]);

  const checkedKing = useMemo<Square | null>(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = board[r][f];
        if (sq && sq.type === "k" && sq.color === turn) return squareOf(f, 8 - r);
      }
    }
    return null;
  }, [chess]);

  const canMove = (piece: { color: Color } | null | undefined): boolean => {
    if (!piece || canMoveColor === null) return false;
    if (canMoveColor === "both") return true;
    return piece.color === canMoveColor && chess.turn() === piece.color;
  };

  const handleSquare = (sq: Square) => {
    const piece = chess.get(sq);
    if (selected && targets.has(sq)) {
      onMove(selected, sq);
      setSelected(null);
      return;
    }
    if (piece && canMove(piece)) {
      setSelected(sq === selected ? null : sq);
      return;
    }
    setSelected(null);
  };

  const files = orientation === "w" ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === "w" ? [...RANKS] : [...RANKS].reverse();

  const onDragStart = (e: React.DragEvent, sq: Square) => {
    const piece = chess.get(sq);
    if (!canMove(piece)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", sq);
    setSelected(sq);
  };
  const onDrop = (e: React.DragEvent, sq: Square) => {
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain") as Square;
    if (from && targets.has(sq)) {
      onMove(from, sq);
      setSelected(null);
    }
  };

  return (
    <div
      className="relative w-full aspect-square rounded-3xl overflow-hidden border border-petal/20 shadow-2xl bg-gradient-to-br from-velvet to-surface"
      style={{ maxWidth: "min(92vw, 640px)" }}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranks.map((rank) =>
          files.map((file) => {
            const sq = `${file}${rank}` as Square;
            const piece = chess.get(sq);
            const fileIdx = FILES.indexOf(file);
            const rankIdx = 8 - rank;
            const light = (fileIdx + rankIdx) % 2 === 0;
            const isSelected = selected === sq;
            const isTarget = targets.has(sq);
            const isCapture = targets.get(sq) === true;
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isCheck = checkedKing === sq;
            const showFile = orientation === "w" ? rank === 1 : rank === 8;
            const showRank = orientation === "w" ? file === "a" : file === "h";

            return (
              <button
                key={sq}
                type="button"
                onClick={() => handleSquare(sq)}
                onDragOver={(e) => isTarget && e.preventDefault()}
                onDrop={(e) => onDrop(e, sq)}
                className={[
                  "relative flex items-center justify-center select-none transition-colors",
                  light ? "bg-[oklch(0.82_0.04_320)]" : "bg-[oklch(0.42_0.09_310)]",
                  isLast ? "ring-2 ring-inset ring-amber-300/70" : "",
                  isSelected ? "ring-2 ring-inset ring-petal" : "",
                  isCheck ? "bg-red-500/60" : "",
                ].join(" ")}
                aria-label={sq}
              >
                {showRank && (
                  <span className={`absolute top-0.5 left-1 text-[9px] font-semibold ${light ? "text-velvet/60" : "text-candle/70"}`}>
                    {rank}
                  </span>
                )}
                {showFile && (
                  <span className={`absolute bottom-0 right-1 text-[9px] font-semibold ${light ? "text-velvet/60" : "text-candle/70"}`}>
                    {file}
                  </span>
                )}
                {piece && (() => {
                  const gliding = lastMove && lastMove.to === sq;
                  const dir = orientation === "w" ? 1 : -1;
                  const dx = gliding ? (FILES.indexOf(lastMove.from[0] as typeof FILES[number]) - FILES.indexOf(lastMove.to[0] as typeof FILES[number])) * dir * 100 : 0;
                  const dy = gliding ? (parseInt(lastMove.to[1]) - parseInt(lastMove.from[1])) * dir * 100 : 0;
                  return (
                    <span
                      key={gliding ? `${lastMove.from}-${lastMove.to}` : undefined}
                      draggable={canMove(piece)}
                      onDragStart={(e) => onDragStart(e, sq)}
                      className={`text-[clamp(1.8rem,7vw,3.2rem)] leading-none drop-shadow-md ${
                        piece.color === "w" ? "text-white" : "text-black"
                      }`}
                      style={{
                        textShadow: piece.color === "w" ? "0 1px 2px rgba(0,0,0,0.6)" : "0 1px 2px rgba(255,255,255,0.35)",
                        display: "inline-block",
                        willChange: gliding ? "transform" : undefined,
                        zIndex: gliding ? 5 : undefined,
                        ...(gliding ? {
                          ["--dx" as string]: `${dx}%`,
                          ["--dy" as string]: `${dy}%`,
                          animation: "chess-piece-glide 460ms cubic-bezier(0.34,1.5,0.64,1) both",
                        } : {}),
                      }}
                    >
                      {PIECE_GLYPH[piece.color as Color][piece.type as PieceSymbol]}
                    </span>
                  );
                })()}
                {isTarget && !piece && (
                  <span className="absolute w-3 h-3 rounded-full bg-petal/70 shadow-[0_0_12px_var(--petal)]" />
                )}
                {isTarget && isCapture && (
                  <span className="absolute inset-1 rounded-full border-4 border-petal/70 shadow-[0_0_16px_var(--petal)]" />
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
