// Lazy-loaded lightweight built-in AI. Uses a minimax with alpha-beta pruning
// running in the main thread — depth scales with difficulty. Keeps the app
// dependency-free and Worker-friendly without shipping a large WASM engine.
import { Chess, type Move } from "chess.js";
import type { AiLevel } from "./chess";

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square tables (basic) — encourage central control and king safety.
const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, -20, -20, 10, 10, 5,
  5, -5, -10, 0, 0, -10, -5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, 5, 10, 25, 25, 10, 5, 5,
  10, 10, 20, 30, 30, 20, 10, 10,
  50, 50, 50, 50, 50, 50, 50, 50,
  0, 0, 0, 0, 0, 0, 0, 0,
];

function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100000 : 100000;
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) return 0;
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      const v = VALUE[sq.type];
      const idx = sq.color === "w" ? (7 - r) * 8 + f : r * 8 + f;
      const pst = sq.type === "p" ? PST_PAWN[idx] : 0;
      const s = v + pst;
      score += sq.color === "w" ? s : -s;
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const av = (a.captured ? VALUE[a.captured] : 0) + (a.promotion ? VALUE[a.promotion] : 0);
    const bv = (b.captured ? VALUE[b.captured] : 0) + (b.promotion ? VALUE[b.promotion] : 0);
    return bv - av;
  });
}

function search(chess: Chess, depth: number, alpha: number, beta: number, maxPlayer: boolean): number {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess);
  const moves = orderMoves(chess.moves({ verbose: true }) as Move[]);
  if (maxPlayer) {
    let value = -Infinity;
    for (const m of moves) {
      chess.move(m);
      value = Math.max(value, search(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const m of moves) {
      chess.move(m);
      value = Math.min(value, search(chess, depth - 1, alpha, beta, true));
      chess.undo();
      beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return value;
  }
}

function depthFor(level: AiLevel): number {
  return { easy: 1, medium: 2, hard: 3, expert: 4 }[level];
}

function randomnessFor(level: AiLevel): number {
  // Probability of choosing a random legal move to simulate weaker play.
  return { easy: 0.4, medium: 0.15, hard: 0.03, expert: 0 }[level];
}

export async function aiPickMove(fen: string, level: AiLevel): Promise<Move | null> {
  // Yield to the event loop so the UI can render "thinking" state.
  await new Promise((r) => setTimeout(r, 30));
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return null;

  if (Math.random() < randomnessFor(level)) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = depthFor(level);
  const maxPlayer = chess.turn() === "w";
  let bestMove: Move = moves[0];
  let bestScore = maxPlayer ? -Infinity : Infinity;
  for (const m of orderMoves(moves)) {
    chess.move(m);
    const score = search(chess, depth - 1, -Infinity, Infinity, !maxPlayer);
    chess.undo();
    if (maxPlayer ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return bestMove;
}
