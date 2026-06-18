export type GameKind = "truth-or-dare" | "this-or-that" | "would-you-rather" | "guess-me";

export const GAMES: Record<GameKind, { name: string; emoji: string; body: string }> = {
  "truth-or-dare": { name: "Truth or Dare", emoji: "🎯", body: "Romantic, funny, or deep." },
  "this-or-that": { name: "This or That", emoji: "⚖️", body: "Quick taste comparisons." },
  "would-you-rather": { name: "Would You Rather", emoji: "💭", body: "Tough little dilemmas." },
  "guess-me": { name: "Guess Me", emoji: "🐼", body: "How well do you know me?" },
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
  ["Beach", "Mountains"],
  ["Coffee", "Tea"],
  ["Morning", "Night"],
  ["Sweet", "Salty"],
  ["Cats", "Dogs"],
  ["City", "Countryside"],
  ["Movies", "Shows"],
  ["Sunrise", "Sunset"],
  ["Pizza", "Pasta"],
  ["Cozy in", "Night out"],
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
  "My favorite comfort food",
  "The song I secretly love",
  "My biggest fear",
  "My happiest childhood memory",
  "What I'd do with a free weekend alone",
  "My dream job as a kid",
  "The compliment that means most to me",
];
