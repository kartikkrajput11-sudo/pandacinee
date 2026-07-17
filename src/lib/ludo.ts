// Ludo game logic — 2 players (Red vs Yellow), 4 tokens each.
// Standard 15x15 grid path with 52 main-track cells + 6 home column cells per player.

export type Player = "red" | "yellow";
export const PLAYERS: Player[] = ["red", "yellow"];

export const PLAYER_META: Record<Player, { name: string; color: string; light: string; emoji: string; start: number; homeEntry: number }> = {
  red: { name: "Rose", color: "#e11d74", light: "oklch(0.32 0.09 340)", emoji: "🌹", start: 0, homeEntry: 50 },
  yellow: { name: "Champagne", color: "#d4a24c", light: "oklch(0.32 0.06 75)", emoji: "🥂", start: 26, homeEntry: 24 },
};

// Main-track cell coordinates (col, row) on a 15x15 grid, index 0 = Red's start.
export const TRACK: [number, number][] = [
  [1, 6],[2, 6],[3, 6],[4, 6],[5, 6],
  [6, 5],[6, 4],[6, 3],[6, 2],[6, 1],[6, 0],
  [7, 0],
  [8, 0],[8, 1],[8, 2],[8, 3],[8, 4],[8, 5],
  [9, 6],[10, 6],[11, 6],[12, 6],[13, 6],[14, 6],
  [14, 7],
  [14, 8],[13, 8],[12, 8],[11, 8],[10, 8],[9, 8],
  [8, 9],[8, 10],[8, 11],[8, 12],[8, 13],[8, 14],
  [7, 14],
  [6, 14],[6, 13],[6, 12],[6, 11],[6, 10],[6, 9],
  [5, 8],[4, 8],[3, 8],[2, 8],[1, 8],[0, 8],
  [0, 7],
  [0, 6],
];

// Home-column cells (from entry to center) per player.
export const HOME_COL: Record<Player, [number, number][]> = {
  red: [[1, 7],[2, 7],[3, 7],[4, 7],[5, 7],[6, 7]],
  yellow: [[7, 13],[7, 12],[7, 11],[7, 10],[7, 9],[7, 8]],
};

// Yard slots (starting home) per player — where tokens sit before entering play.
export const YARD: Record<Player, [number, number][]> = {
  red: [[1.5, 10.5],[3.5, 10.5],[1.5, 12.5],[3.5, 12.5]],
  yellow: [[10.5, 1.5],[12.5, 1.5],[10.5, 3.5],[12.5, 3.5]],
};

// Safe squares (star cells) — no capture here.
export const SAFE = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

// Position encoding:
// -1 = in yard, 0-51 = main-track index, 100-105 = home column step 0..5, 200 = finished
export type Pos = number;

export type Token = { player: Player; idx: 0 | 1 | 2 | 3; pos: Pos };

export type State = {
  tokens: Token[]; // 8 tokens
  turn: Player;
  dice: number | null; // last rolled value 1..6
  rolls: number[]; // consecutive rolls this turn (for 6-bonus)
  mustMove: boolean; // dice rolled and awaiting a move
  winner: Player | null;
};

export function initialState(): State {
  const tokens: Token[] = [];
  for (const p of PLAYERS) {
    for (let i = 0; i < 4; i++) tokens.push({ player: p, idx: i as 0 | 1 | 2 | 3, pos: -1 });
  }
  return { tokens, turn: "red", dice: null, rolls: [], mustMove: false, winner: null };
}

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

// Compute the destination for a token given a dice value; null = illegal.
export function destinationOf(t: Token, dice: number): Pos | null {
  const meta = PLAYER_META[t.player];
  if (t.pos === -1) {
    return dice === 6 ? meta.start : null;
  }
  if (t.pos === 200) return null;
  if (t.pos >= 100) {
    const step = t.pos - 100 + dice;
    if (step > 6) return null;
    if (step === 6) return 200;
    return 100 + step;
  }
  // On main track
  // Distance from token to homeEntry
  const distToEntry = (meta.homeEntry - t.pos + 52) % 52;
  if (dice <= distToEntry) {
    return (t.pos + dice) % 52;
  }
  const extra = dice - distToEntry - 1; // steps into home column (0..5) then finish at extra==6
  if (extra > 6) return null;
  if (extra === 6) return 200;
  return 100 + extra;
}

// Full step-by-step path a token walks for a given dice value. Empty if illegal.
export function pathOf(t: Token, dice: number): Pos[] {
  const meta = PLAYER_META[t.player];
  const path: Pos[] = [];
  if (t.pos === -1) {
    if (dice !== 6) return [];
    return [meta.start];
  }
  if (t.pos === 200) return [];
  if (t.pos >= 100) {
    for (let s = 1; s <= dice; s++) {
      const step = (t.pos - 100) + s;
      if (step > 6) return [];
      path.push(step === 6 ? 200 : 100 + step);
    }
    return path;
  }
  const distToEntry = (meta.homeEntry - t.pos + 52) % 52;
  for (let s = 1; s <= dice; s++) {
    if (s <= distToEntry) {
      path.push((t.pos + s) % 52);
    } else {
      const extra = s - distToEntry - 1;
      if (extra > 6) return [];
      path.push(extra === 6 ? 200 : 100 + extra);
    }
  }
  return path;
}

export function legalMoves(state: State): Token[] {
  if (state.dice == null) return [];
  const moves: Token[] = [];
  for (const t of state.tokens) {
    if (t.player !== state.turn) continue;
    if (destinationOf(t, state.dice) != null) moves.push(t);
  }
  return moves;
}

// Apply a move; returns new state. Assumes move is legal.
export function applyMove(state: State, tokenPlayer: Player, tokenIdx: number): State {
  const dice = state.dice!;
  const tokens = state.tokens.map((t) => ({ ...t }));
  const t = tokens.find((x) => x.player === tokenPlayer && x.idx === tokenIdx)!;
  const dest = destinationOf(t, dice)!;
  t.pos = dest;

  // Capture: if landed on main track and not a safe square, send opponents home.
  if (dest >= 0 && dest < 52 && !SAFE.has(dest)) {
    for (const other of tokens) {
      if (other.player !== t.player && other.pos === dest) {
        other.pos = -1;
      }
    }
  }

  // Check winner
  const finishedCount = tokens.filter((x) => x.player === t.player && x.pos === 200).length;
  let winner: Player | null = null;
  if (finishedCount === 4) winner = t.player;

  // Bonus turn if rolled 6 or captured or finished a token
  const captured = dest >= 0 && dest < 52 && !SAFE.has(dest) && state.tokens.some((o) => o.player !== t.player && o.pos === dest);
  const bonus = dice === 6 || captured || dest === 200;
  const rolls = [...state.rolls, dice];
  // Three sixes in a row → forfeit turn
  const threeSixes = rolls.filter((r) => r === 6).length >= 3;

  let nextTurn = state.turn;
  let nextRolls = rolls;
  if (winner) {
    // game over
  } else if (bonus && !threeSixes) {
    nextTurn = state.turn;
  } else {
    nextTurn = other(state.turn);
    nextRolls = [];
  }

  return {
    tokens,
    turn: nextTurn,
    dice: null,
    rolls: nextRolls,
    mustMove: false,
    winner,
  };
}

// Roll the dice. If no legal moves, pass turn (unless it was a 6 — still pass).
export function applyRoll(state: State, value: number): State {
  if (state.winner || state.mustMove || state.dice != null) return state;
  const s2: State = { ...state, dice: value, rolls: [...state.rolls, value], mustMove: true };
  const moves = legalMoves(s2);
  if (moves.length === 0) {
    // No move possible. If rolled 6, still pass to next.
    const threeSixes = s2.rolls.filter((r) => r === 6).length >= 3;
    const passIfSix = value === 6 && !threeSixes;
    return {
      ...state,
      dice: null,
      rolls: passIfSix ? s2.rolls : [],
      mustMove: false,
      turn: passIfSix ? state.turn : other(state.turn),
    };
  }
  return s2;
}

export function other(p: Player): Player {
  return p === "red" ? "yellow" : "red";
}

// Board cell size — SVG grid is 15 units; we render at a scaled viewbox.
export const GRID = 15;

export function cellOf(pos: Pos, player: Player): [number, number] {
  if (pos === -1) return [-1, -1];
  if (pos === 200) return [7, 7]; // center
  if (pos >= 100) return HOME_COL[player][pos - 100];
  return TRACK[pos];
}
