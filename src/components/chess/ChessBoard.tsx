import { useMemo, useState } from "react";
import type { Chess, Square, Color, PieceSymbol } from "chess.js";
import { FILES, RANKS, PIECE_GLYPH, legalTargets, squareOf } from "@/lib/chess";
import { useEquippedItems } from "@/hooks/useEquippedItems";

type Props = {
  chess: Chess;
  orientation: Color;
  canMoveColor: Color | "both" | null; // null = view only
  lastMove: { from: Square; to: Square } | null;
  onMove: (from: Square, to: Square) => void;
};

export function ChessBoard({ chess, orientation, canMoveColor, lastMove, onMove }: Props) {
  const [selected, setSelected] = useState<Square | null>(null);
  const { chessBoard, chessPieces } = useEquippedItems();
  const lightSq = chessBoard?.light ?? "oklch(0.82 0.04 320)";
  const darkSq = chessBoard?.dark ?? "oklch(0.42 0.09 310)";
  const accent = chessBoard?.accent ?? "var(--petal)";
  const pieceGlyph = (color: Color, type: PieceSymbol): string => {
    const g = chessPieces?.glyphs?.[color]?.[type];
    return g ?? PIECE_GLYPH[color][type];
  };
  const emojiPieces = chessPieces?.emoji === true;
  const glassPieces = chessPieces?.style === "glass";

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
                  isLast ? "ring-2 ring-inset ring-amber-300/70" : "",
                  isSelected ? "ring-2 ring-inset" : "",
                  isCheck ? "!bg-red-500/60" : "",
                ].join(" ")}
                style={{
                  background: light ? lightSq : darkSq,
                  ...(isSelected ? { boxShadow: `inset 0 0 0 2px ${accent}` } : {}),
                }}
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
                {piece && (
                  glassPieces ? (
                    <span
                      draggable={canMove(piece)}
                      onDragStart={(e) => onDragStart(e, sq)}
                      className="relative flex items-center justify-center rounded-full"
                      style={{
                        width: "78%",
                        height: "78%",
                        background: piece.color === "w"
                          ? "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(220,240,255,0.15))"
                          : "linear-gradient(135deg, rgba(40,20,60,0.85), rgba(10,10,25,0.55))",
                        backdropFilter: "blur(6px) saturate(160%)",
                        border: piece.color === "w"
                          ? "1px solid rgba(255,255,255,0.7)"
                          : "1px solid rgba(180,140,220,0.5)",
                        boxShadow: piece.color === "w"
                          ? "inset 0 1px 2px rgba(255,255,255,0.9), 0 2px 8px rgba(120,180,255,0.35)"
                          : "inset 0 1px 2px rgba(200,150,255,0.35), 0 2px 8px rgba(0,0,0,0.5)",
                      }}
                    >
                      <span
                        className="text-[clamp(1.4rem,5.6vw,2.6rem)] leading-none"
                        style={{
                          background: piece.color === "w"
                            ? "linear-gradient(180deg, #ffffff, #c7ecff 60%, #7fb8ff)"
                            : "linear-gradient(180deg, #f4d5ff, #b58bff 55%, #4a2a7a)",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                          textShadow: "0 1px 1px rgba(0,0,0,0.2)",
                          filter: "drop-shadow(0 0 3px rgba(255,255,255,0.4))",
                        }}
                      >
                        {pieceGlyph(piece.color as Color, piece.type as PieceSymbol)}
                      </span>
                    </span>
                  ) : (
                    <span
                      draggable={canMove(piece)}
                      onDragStart={(e) => onDragStart(e, sq)}
                      className={`text-[clamp(1.8rem,7vw,3.2rem)] leading-none drop-shadow-md ${
                        emojiPieces
                          ? piece.color === "w" ? "grayscale-0" : "grayscale contrast-125"
                          : piece.color === "w" ? "text-white" : "text-black"
                      }`}
                      style={{
                        textShadow: emojiPieces
                          ? "0 1px 2px rgba(0,0,0,0.5)"
                          : piece.color === "w"
                            ? "0 1px 2px rgba(0,0,0,0.6)"
                            : "0 1px 2px rgba(255,255,255,0.35)",
                        filter: emojiPieces && piece.color === "b" ? "drop-shadow(0 0 1px rgba(0,0,0,0.9))" : undefined,
                      }}
                    >
                      {pieceGlyph(piece.color as Color, piece.type as PieceSymbol)}
                    </span>
                  )
                )}
                {isTarget && !piece && (
                  <span className="absolute w-3 h-3 rounded-full" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
                )}
                {isTarget && isCapture && (
                  <span className="absolute inset-1 rounded-full border-4" style={{ borderColor: accent, boxShadow: `0 0 16px ${accent}` }} />
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
