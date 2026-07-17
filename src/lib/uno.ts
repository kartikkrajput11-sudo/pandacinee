// Uno core logic. 2-player. Reverse acts like skip.

export type UnoColor = "red" | "yellow" | "green" | "blue";
export type UnoValue =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "skip" | "reverse" | "draw2" | "wild" | "wild4";

export type UnoCard = {
  id: string;
  color: UnoColor | "wild";
  value: UnoValue;
};

export type UnoPlayer = "you" | "them";

export type UnoState = {
  deck: UnoCard[];
  discard: UnoCard[];      // top is last
  hands: Record<UnoPlayer, UnoCard[]>;
  turn: UnoPlayer;
  activeColor: UnoColor;   // color in effect (wild resolves to chosen)
  pendingDraw: number;     // stacked draws (2 or 4) for next player
  winner: UnoPlayer | null;
  lastAction: string | null;
  awaitingWildFrom: UnoPlayer | null; // player must pick a color
  awaitingWildCardId: string | null;
  unoCalled: Record<UnoPlayer, boolean>; // has each player called "Uno!"
};

export const COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];

const V_NUM: UnoValue[] = ["1","2","3","4","5","6","7","8","9"];
const V_ACT: UnoValue[] = ["skip", "reverse", "draw2"];

function makeDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let n = 0;
  for (const c of COLORS) {
    cards.push({ id: `c${n++}`, color: c, value: "0" });
    for (const v of V_NUM) {
      cards.push({ id: `c${n++}`, color: c, value: v });
      cards.push({ id: `c${n++}`, color: c, value: v });
    }
    for (const v of V_ACT) {
      cards.push({ id: `c${n++}`, color: c, value: v });
      cards.push({ id: `c${n++}`, color: c, value: v });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `c${n++}`, color: "wild", value: "wild" });
    cards.push({ id: `c${n++}`, color: "wild", value: "wild4" });
  }
  return cards;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initialState(seed = Date.now()): UnoState {
  const rand = mulberry32(seed);
  let deck = shuffle(makeDeck(), rand);
  const hands: Record<UnoPlayer, UnoCard[]> = { you: [], them: [] };
  for (let i = 0; i < 7; i++) {
    hands.you.push(deck.pop()!);
    hands.them.push(deck.pop()!);
  }
  // First discard: keep drawing until it's a plain colored number.
  let top: UnoCard | undefined;
  while (deck.length) {
    const c = deck.pop()!;
    if (c.color !== "wild" && !["skip","reverse","draw2"].includes(c.value)) {
      top = c;
      break;
    }
    deck.unshift(c); // put back at bottom
  }
  if (!top) top = { id: "fallback", color: "red", value: "0" };
  return {
    deck,
    discard: [top],
    hands,
    turn: rand() < 0.5 ? "you" : "them",
    activeColor: top.color as UnoColor,
    pendingDraw: 0,
    winner: null,
    lastAction: "The deck is dealt.",
    awaitingWildFrom: null,
    awaitingWildCardId: null,
    unoCalled: { you: false, them: false },
  };
}

export function top(s: UnoState): UnoCard {
  return s.discard[s.discard.length - 1];
}

export function canPlay(s: UnoState, card: UnoCard): boolean {
  if (s.winner || s.awaitingWildFrom) return false;
  const t = top(s);
  // If pending draws are in effect, only stackable draws of same kind can be played.
  if (s.pendingDraw > 0) {
    if (card.value === "draw2" && t.value === "draw2") return true;
    if (card.value === "wild4") return true; // allow escalation
    return false;
  }
  if (card.color === "wild") return true;
  if (card.color === s.activeColor) return true;
  if (card.value === t.value) return true;
  return false;
}

function other(p: UnoPlayer): UnoPlayer {
  return p === "you" ? "them" : "you";
}

function reshuffleIfNeeded(s: UnoState) {
  if (s.deck.length > 0) return;
  const t = s.discard.pop()!;
  const rand = mulberry32(Date.now() >>> 0);
  const pool = s.discard.map((c) =>
    c.color === "wild" ? { ...c, color: "wild" as const } : c
  );
  s.deck = shuffle(pool, rand);
  s.discard = [t];
}

export function drawCards(s: UnoState, who: UnoPlayer, n: number): UnoState {
  const ns = clone(s);
  for (let i = 0; i < n; i++) {
    reshuffleIfNeeded(ns);
    const c = ns.deck.pop();
    if (!c) break;
    ns.hands[who].push(c);
  }
  return ns;
}

function clone(s: UnoState): UnoState {
  return {
    ...s,
    deck: s.deck.slice(),
    discard: s.discard.slice(),
    hands: { you: s.hands.you.slice(), them: s.hands.them.slice() },
    unoCalled: { you: s.unoCalled?.you ?? false, them: s.unoCalled?.them ?? false },
  };
}

// Whenever a player's hand size is not exactly 1, they cannot be "on Uno".
function resetUnoFlags(ns: UnoState) {
  if (ns.hands.you.length !== 1) ns.unoCalled.you = false;
  if (ns.hands.them.length !== 1) ns.unoCalled.them = false;
}

// Player calls "Uno!" — only meaningful when their hand has exactly 1 card.
export function callUno(s: UnoState, who: UnoPlayer): UnoState {
  if (s.winner) return s;
  if (s.hands[who].length !== 1) return s;
  if (s.unoCalled[who]) return s;
  const ns = clone(s);
  ns.unoCalled[who] = true;
  ns.lastAction = `${who === "you" ? "You" : "They"} called Uno!`;
  return ns;
}

// Opponent catches a player who forgot to call Uno — penalty +2.
export function catchUno(s: UnoState, catcher: UnoPlayer): UnoState {
  const target = other(catcher);
  if (s.winner) return s;
  if (s.hands[target].length !== 1) return s;
  if (s.unoCalled[target]) return s;
  const ns = drawCards(s, target, 2);
  ns.unoCalled[target] = false;
  ns.lastAction = `${catcher === "you" ? "You" : "They"} caught them silent — +2.`;
  return ns;
}

export function playCard(
  s: UnoState,
  who: UnoPlayer,
  cardId: string,
  chosenColor?: UnoColor,
): UnoState {
  if (s.turn !== who || s.winner) return s;
  const hand = s.hands[who];
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return s;
  const card = hand[idx];
  if (!canPlay(s, card)) return s;

  const ns = clone(s);
  ns.hands[who] = ns.hands[who].filter((c) => c.id !== cardId);
  ns.discard.push(card);
  ns.lastAction = null;

  if (card.color === "wild") {
    if (!chosenColor) {
      ns.awaitingWildFrom = who;
      ns.awaitingWildCardId = card.id;
      return ns;
    }
    ns.activeColor = chosenColor;
  } else {
    ns.activeColor = card.color;
  }

  // Effects
  let skipNext = false;
  if (card.value === "skip" || card.value === "reverse") {
    skipNext = true;
    ns.lastAction = card.value === "skip" ? "Skipped." : "Reversed — skipped.";
  } else if (card.value === "draw2") {
    ns.pendingDraw += 2;
    ns.lastAction = `+${ns.pendingDraw} pending draw.`;
  } else if (card.value === "wild4") {
    ns.pendingDraw += 4;
    ns.lastAction = `+${ns.pendingDraw} pending draw.`;
  } else if (card.value === "wild") {
    ns.lastAction = `Color set to ${chosenColor}.`;
  } else {
    ns.lastAction = null;
  }

  if (ns.hands[who].length === 0) {
    ns.winner = who;
    return ns;
  }

  // Pass turn (skip/reverse in 2p returns to same player after opponent skipped)
  const opp = other(who);
  if (skipNext) {
    ns.turn = who; // opponent is skipped; you go again
  } else {
    ns.turn = opp;
    // If pending draws exist and opponent has no counter, they'll draw on their action.
  }
  resetUnoFlags(ns);
  return ns;
}

export function chooseWildColor(s: UnoState, who: UnoPlayer, color: UnoColor): UnoState {
  if (s.awaitingWildFrom !== who) return s;
  const ns = clone(s);
  ns.activeColor = color;
  const card = ns.discard[ns.discard.length - 1];
  ns.awaitingWildFrom = null;
  ns.awaitingWildCardId = null;
  // Apply post effects
  if (card.value === "wild4") {
    ns.pendingDraw += 4;
    ns.lastAction = `+${ns.pendingDraw} pending draw. Color: ${color}.`;
  } else {
    ns.lastAction = `Color set to ${color}.`;
  }
  if (ns.hands[who].length === 0) {
    ns.winner = who;
    return ns;
  }
  ns.turn = other(who);
  return ns;
}

// Player draws (either forced pending or voluntary).
export function drawTurn(s: UnoState, who: UnoPlayer): UnoState {
  if (s.turn !== who || s.winner || s.awaitingWildFrom) return s;
  if (s.pendingDraw > 0) {
    const ns = drawCards(s, who, s.pendingDraw);
    ns.pendingDraw = 0;
    ns.lastAction = `Drew ${s.pendingDraw || ""} penalty cards.`;
    ns.turn = other(who);
    return ns;
  }
  // Voluntary draw one; auto-pass if unplayable.
  const ns = drawCards(s, who, 1);
  const drawn = ns.hands[who][ns.hands[who].length - 1];
  if (drawn && canPlay(ns, drawn)) {
    ns.lastAction = "Drew a card.";
    return ns; // stays on player, they may play it
  }
  ns.lastAction = "Drew a card and passed.";
  ns.turn = other(who);
  return ns;
}

export const VALUE_LABEL: Record<UnoValue, string> = {
  "0":"0","1":"1","2":"2","3":"3","4":"4","5":"5","6":"6","7":"7","8":"8","9":"9",
  skip: "⊘",
  reverse: "⇄",
  draw2: "+2",
  wild: "★",
  wild4: "+4",
};
