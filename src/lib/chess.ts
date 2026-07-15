import { Chess, type Square, type Move, type PieceSymbol, type Color } from "chess.js";

export type ChessMode = "partner" | "self" | "ai";
export type AiLevel = "easy" | "medium" | "hard" | "expert";

export type PromotionPiece = "q" | "r" | "b" | "n";

// Unicode chess piece glyphs — high-quality, scale with font-size, work everywhere.
export const PIECE_GLYPH: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export function squareOf(file: number, rank: number): Square {
  return `${FILES[file]}${rank}` as Square;
}

export function legalTargets(chess: Chess, from: Square): { to: Square; capture: boolean }[] {
  const moves = chess.moves({ square: from, verbose: true }) as Move[];
  return moves.map((m) => ({ to: m.to as Square, capture: !!m.captured || m.flags.includes("e") }));
}

export function isPromotion(chess: Chess, from: Square, to: Square): boolean {
  const piece = chess.get(from);
  if (!piece || piece.type !== "p") return false;
  const rank = to[1];
  return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
}

export function toPairPGN(chess: Chess): string[] {
  const history = chess.history();
  const rows: string[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push([history[i], history[i + 1] ?? ""].filter(Boolean).join(" "));
  }
  return rows;
}

export function capturedPieces(chess: Chess): { w: PieceSymbol[]; b: PieceSymbol[] } {
  // Standard starting inventory
  const start: Record<PieceSymbol, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const remaining: Record<Color, Record<PieceSymbol, number>> = {
    w: { ...start },
    b: { ...start },
  };
  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq) remaining[sq.color][sq.type]--;
    }
  }
  const captured: { w: PieceSymbol[]; b: PieceSymbol[] } = { w: [], b: [] };
  (Object.keys(start) as PieceSymbol[]).forEach((p) => {
    for (let i = 0; i < remaining.w[p]; i++) captured.b.push(p); // white pieces missing = captured by black
    for (let i = 0; i < remaining.b[p]; i++) captured.w.push(p);
  });
  const order: PieceSymbol[] = ["q", "r", "b", "n", "p"];
  captured.w.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  captured.b.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return captured;
}

export function pieceValue(p: PieceSymbol): number {
  return { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[p];
}

export function materialAdvantage(chess: Chess): number {
  const cap = capturedPieces(chess);
  const w = cap.w.reduce((s, p) => s + pieceValue(p), 0);
  const b = cap.b.reduce((s, p) => s + pieceValue(p), 0);
  return w - b; // positive = white ahead
}

export function computeResult(chess: Chess): {
  status: "active" | "checkmate" | "stalemate" | "draw";
  winner: "w" | "b" | "draw" | null;
} {
  if (chess.isCheckmate()) {
    // The side to move has been checkmated -> opponent wins.
    return { status: "checkmate", winner: chess.turn() === "w" ? "b" : "w" };
  }
  if (chess.isStalemate()) return { status: "stalemate", winner: "draw" };
  if (chess.isThreefoldRepetition() || chess.isInsufficientMaterial() || chess.isDraw()) {
    return { status: "draw", winner: "draw" };
  }
  return { status: "active", winner: null };
}

export { Chess };
export type { Square, Move, PieceSymbol, Color };
