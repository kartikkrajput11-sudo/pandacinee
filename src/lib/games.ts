export type GameKind =
  | "truth-or-dare"
  | "this-or-that"
  | "would-you-rather"
  | "never-have-i-ever"
  | "guess-me"
  | "know-me"
  | "two-truths-lie"
  | "hot-takes"
  | "emoji-riddle"
  | "tic-tac-toe"
  | "rock-paper-scissors"
  | "paint-together"
  | "scribble-guess"
  | "daily-challenge"
  | "memory-challenge"
  | "puzzle-together"
  | "love-quiz"
  | "chess"
  | "ludo"
  | "uno"
  | "hide-seek";

// Games shown in the picker. Rock-Paper-Scissors is retired but the route
// still handles it for any deep-link, so it stays in GameKind above.
export const GAME_KINDS: GameKind[] = [
  "paint-together",
  "chess",
  "ludo",
  "uno",
  "hide-seek",
  "know-me",
  "scribble-guess",
  "two-truths-lie",
  "hot-takes",
  "emoji-riddle",
  "daily-challenge",
  "memory-challenge",
  "love-quiz",
  "truth-or-dare",
  "would-you-rather",
  "never-have-i-ever",
  "this-or-that",
  "guess-me",
];

export const GAMES: Record<GameKind, { name: string; emoji: string; body: string; ai?: boolean; href?: string; comingSoon?: boolean }> = {
  "paint-together": { name: "Paint Together", emoji: "🎨", body: "Live shared canvas.", href: "/app/paint" },
  "chess": { name: "Chess", emoji: "♟️", body: "Play with your panda, live.", href: "/app/chess" },
  "ludo": { name: "Ludo", emoji: "🎲", body: "Roll, race, capture — 2-player.", href: "/app/ludo" },
  "uno": { name: "Uno", emoji: "🃏", body: "Velvet card salon, live.", href: "/app/uno" },
  "hide-seek": { name: "Hide & Seek", emoji: "🫣", body: "Hide in a velvet room. Hunt with hints.", href: "/app/hideseek" },
  "know-me": { name: "How Well Do You Know Me?", emoji: "💌", body: "Pass-and-play couple quiz.", href: "/app/knowme" },
  "scribble-guess": { name: "Scribble & Guess", emoji: "✏️", body: "Draw. Guess. Win.", href: "/app/scribble" },
  "daily-challenge": { name: "Daily Challenge", emoji: "🌞", body: "One prompt each day.", href: "/app/daily-challenge" },
  "memory-challenge": { name: "Memory Challenge", emoji: "📸", body: "Photo prompts together.", href: "/app/memory-challenge" },
  "puzzle-together": { name: "Puzzle Together", emoji: "🧩", body: "Solve jigsaws live.", href: "/app/puzzle" },
  "love-quiz": { name: "Love Quiz", emoji: "💘", body: "AI quiz about the two of you.", href: "/app/love-quiz", ai: true },
  "tic-tac-toe": { name: "Tic Tac Toe", emoji: "❌⭕", body: "Live 3-in-a-row." },
  "rock-paper-scissors": { name: "Rock · Paper · Scissors", emoji: "✊✋✌️", body: "Best of 5, live." },
  "truth-or-dare": { name: "Truth or Dare", emoji: "🎯", body: "AI-crafted prompts, endless.", ai: true },
  "this-or-that": { name: "This or That", emoji: "⚖️", body: "AI taste comparisons.", ai: true },
  "would-you-rather": { name: "Would You Rather", emoji: "💭", body: "AI dilemmas, no repeats.", ai: true },
  "never-have-i-ever": { name: "Never Have I Ever", emoji: "🤫", body: "Reveal secrets together.", ai: true },
  "guess-me": { name: "Guess Me", emoji: "🐼", body: "How well do you know me?", ai: true },
  "two-truths-lie": { name: "Two Truths & a Lie", emoji: "🕵️", body: "Spot the fib — AI writes three.", ai: true },
  "hot-takes": { name: "Hot Takes", emoji: "🔥", body: "Rate a bold love opinion 1–5.", ai: true },
  "emoji-riddle": { name: "Emoji Riddle", emoji: "🧩", body: "Guess the movie, song or vibe.", ai: true },
};

export const TRUTH_OR_DARE: { type: "truth" | "dare"; text: string }[] = [
  { type: "truth", text: "What was your first impression of me?" },
  { type: "truth", text: "What's a memory of us you replay the most?" },
  { type: "truth", text: "What's one thing you've never told me?" },
  { type: "truth", text: "When did you know you loved me?" },
  { type: "dare", text: "Send a voice note singing our favorite song." },
  { type: "dare", text: "Text me three things you love about me right now." },
  { type: "dare", text: "Recreate our first photo together." },
  { type: "dare", text: "Pick our next movie — no questions asked." },
  { type: "truth", text: "What's your favorite place we've been together?" },
  { type: "dare", text: "Send me a selfie with the worst face you can make." },
];

export const THIS_OR_THAT: [string, string][] = [
  ["Beach", "Mountains"], ["Coffee", "Tea"], ["Morning", "Night"], ["Sweet", "Salty"],
  ["Cats", "Dogs"], ["City", "Countryside"], ["Movies", "Shows"], ["Sunrise", "Sunset"],
  ["Pizza", "Pasta"], ["Cozy in", "Night out"],
];

export const WOULD_YOU_RATHER: [string, string][] = [
  ["Travel the world for a year", "Buy our dream home"],
  ["Always be 30 mins early", "Always be 10 mins late"],
  ["Read minds", "Teleport"],
  ["Endless cuddles", "Endless kisses"],
  ["Only summer forever", "Only winter forever"],
  ["Sing every sentence", "Dance every step"],
  ["Live by the ocean", "Live in the woods"],
  ["Never use your phone", "Never watch TV"],
];

export const GUESS_ME: string[] = [
  "My favorite comfort food", "The song I secretly love", "My biggest fear",
  "My happiest childhood memory", "What I'd do with a free weekend alone",
  "My dream job as a kid", "The compliment that means most to me",
];

// Tic-tac-toe helpers
export type TTTCell = "X" | "O" | null;
export function checkWinner(board: TTTCell[]): "X" | "O" | "draw" | null {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a] as "X" | "O";
  }
  if (board.every((c) => c)) return "draw";
  return null;
}

export const RPS_CHOICES = ["rock", "paper", "scissors"] as const;
export type RPSChoice = (typeof RPS_CHOICES)[number];
export const RPS_EMOJI: Record<RPSChoice, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
export function rpsWinner(a: RPSChoice, b: RPSChoice): 0 | 1 | -1 {
  if (a === b) return -1;
  if ((a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper")) return 0;
  return 1;
}
