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

type Capture = {
  id: number;
  sq: Square;
  color: Color;
  type: PieceSymbol;
  dx: number; // % offset from destination toward source
  dy: number;
};

export function ChessBoard({ chess, orientation, canMoveColor, lastMove, onMove }: Props) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastMove) return;
    const key = `${lastMove.from}-${lastMove.to}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    const hist = chess.history({ verbose: true });
    const last = hist[hist.length - 1];
    if (!last || !last.captured) return;
    const dir = orientation === "w" ? 1 : -1;
    // Offset from destination BACK toward the source square (both axes use from - to).
    // Board rows are drawn top-down (rank 8 at top), so a rank increase moves visually UP → negate dy.
    const dx = (FILES.indexOf(lastMove.from[0] as typeof FILES[number]) - FILES.indexOf(lastMove.to[0] as typeof FILES[number])) * dir * 100;
    const dy = (parseInt(lastMove.from[1]) - parseInt(lastMove.to[1])) * -1 * dir * 100;
    const victimColor: Color = last.color === "w" ? "b" : "w";
    const cap: Capture = { id: Date.now(), sq: lastMove.to, color: victimColor, type: last.captured as PieceSymbol, dx, dy };
    setCapture(cap);
    const t = window.setTimeout(() => {
      setCapture((c) => (c && c.id === cap.id ? null : c));
    }, 3000);
    return () => window.clearTimeout(t);
  }, [lastMove, chess, orientation]);

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
                {capture && capture.sq === sq && (
                  <>
                    {/* victim being dragged by the killer */}
                    <span
                      key={`victim-${capture.id}`}
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 flex items-center justify-center text-[clamp(1.8rem,7vw,3.2rem)] leading-none ${
                        capture.color === "w" ? "text-white" : "text-black"
                      }`}
                      style={{
                        textShadow: capture.color === "w" ? "0 1px 2px rgba(0,0,0,0.6)" : "0 1px 2px rgba(255,255,255,0.35)",
                        zIndex: 4,
                        willChange: "transform, opacity",
                        ["--dx" as string]: `${capture.dx}%`,
                        ["--dy" as string]: `${capture.dy}%`,
                        animation: "chess-victim-drag 3s cubic-bezier(0.4, 0, 0.6, 1) both",
                      }}
                    >
                      {PIECE_GLYPH[capture.color][capture.type]}
                    </span>
                    {/* blood spots */}
                    {[
                      { l: 42, t: 46, s: 10, d: 0 },
                      { l: 60, t: 38, s: 6,  d: 80 },
                      { l: 35, t: 60, s: 5,  d: 140 },
                      { l: 68, t: 62, s: 4,  d: 220 },
                      { l: 50, t: 30, s: 3,  d: 300 },
                      { l: 30, t: 42, s: 3,  d: 380 },
                    ].map((b, i) => (
                      <span
                        key={`blood-${capture.id}-${i}`}
                        aria-hidden
                        className="pointer-events-none absolute rounded-full"
                        style={{
                          left: `${b.l}%`,
                          top: `${b.t}%`,
                          width: `${b.s}px`,
                          height: `${b.s}px`,
                          background: "radial-gradient(ellipse at 40% 35%, #7a1414 0%, #4a0808 55%, #240202 100%)",
                          boxShadow: "inset 0 0 2px rgba(0,0,0,0.6), 0 0 3px rgba(40,0,0,0.7)",
                          filter: "blur(0.3px)",
                          opacity: 0.92,
                          zIndex: 3,
                          animation: `chess-blood-splat 3s ease-out ${b.d}ms both`,
                        }}
                      />
                    ))}
                    {/* one drip */}
                    <span
                      key={`drip-${capture.id}`}
                      aria-hidden
                      className="pointer-events-none absolute rounded-b-full"
                      style={{
                        left: "48%",
                        top: "52%",
                        width: "4px",
                        height: "10px",
                        background: "linear-gradient(to bottom, #5a0a0a, #1a0000)",
                        opacity: 0.85,
                        filter: "blur(0.3px)",
                        transformOrigin: "top center",
                        zIndex: 3,
                        animation: "chess-blood-drip 3s ease-in 200ms both",
                      }}
                    />
                  </>
                )}
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
