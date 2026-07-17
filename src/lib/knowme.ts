export type KnowMeQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string, string];
};

// Curated pool — pick N at random per match. Options are archetypes so any
// personality maps to one truthfully.
export const KNOWME_POOL: KnowMeQuestion[] = [
  { id: "comfort-food", prompt: "My ultimate comfort food is…", options: ["Warm pasta", "Spicy noodles", "A greasy burger", "Ice cream by the pint"] },
  { id: "weekend", prompt: "A perfect free weekend for me is…", options: ["Cozy at home", "Out with friends", "A spontaneous trip", "Getting lost in a project"] },
  { id: "love-language", prompt: "My love language is…", options: ["Words of affirmation", "Physical touch", "Acts of service", "Quality time"] },
  { id: "morning", prompt: "First thing I reach for in the morning…", options: ["My phone", "Coffee / tea", "A hug", "Snooze — again"] },
  { id: "dream-date", prompt: "My dream date looks like…", options: ["Candlelit dinner", "Long walk under stars", "Movie night in", "Something wildly unexpected"] },
  { id: "fear", prompt: "The thing I fear most is…", options: ["Being forgotten", "Losing people I love", "Failing at what I care about", "Missing out"] },
  { id: "gift", prompt: "The gift that would melt me is…", options: ["A handwritten letter", "Something we can share", "A meaningful object", "A wild surprise"] },
  { id: "music", prompt: "Music I secretly play on repeat…", options: ["Sad indie", "Old classics", "Pop bangers", "Something no one knows"] },
  { id: "argue", prompt: "When I'm upset with you, I…", options: ["Go quiet", "Talk it through immediately", "Need space then return", "Try to make you laugh"] },
  { id: "travel", prompt: "My kind of trip is…", options: ["Beach & nothing else", "Mountains & mist", "A buzzing city", "Somewhere no one goes"] },
  { id: "flaw", prompt: "The flaw I'd admit first…", options: ["I overthink", "I'm too stubborn", "I avoid hard talks", "I say yes too much"] },
  { id: "flex", prompt: "Something I'm quietly proud of…", options: ["How I love people", "How hard I work", "How I stay curious", "How I make things beautiful"] },
  { id: "drink", prompt: "Order me a drink and it's…", options: ["Wine, always", "A classic cocktail", "Something bubbly", "Just water, thanks"] },
  { id: "outfit", prompt: "My go-to look is…", options: ["Neutrals & clean lines", "Something with edge", "Cozy oversized layers", "Whatever's on top"] },
  { id: "career", prompt: "In ten years I hope to be…", options: ["Doing my own thing", "Somewhere quiet with you", "Deep in a career I love", "Somewhere I haven't imagined yet"] },
  { id: "childhood", prompt: "As a kid I wanted to be…", options: ["An artist", "A scientist / doctor", "Famous", "I had no idea"] },
  { id: "trait", prompt: "The trait I fall for hardest…", options: ["Kindness", "A sharp mind", "A wild sense of humor", "Confidence"] },
  { id: "regret", prompt: "The regret I carry is more about…", options: ["Words I didn't say", "Chances I didn't take", "People I let go", "Time I wasted"] },
  { id: "happy", prompt: "I'm happiest when…", options: ["It's just us", "I'm creating something", "I'm somewhere new", "Everyone I love is close"] },
  { id: "small-joy", prompt: "A tiny thing that makes my day…", options: ["Perfect coffee", "A great song", "A text from you", "Rain on the window"] },
];

export function pickQuestions(n: number, seed?: number): KnowMeQuestion[] {
  const arr = [...KNOWME_POOL];
  // Fisher–Yates with optional seed for repeatability
  let s = seed ?? Date.now();
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}
