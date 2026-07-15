// Shared catalog of purchasable achievement tags. Keep in sync between server
// award logic and client shop UI. `cost` is in coins.
export type AchievementTag = {
  key: string;
  name: string;
  emoji: string;
  cost: number;
  blurb: string;
  hue: string; // tailwind-friendly hex for the badge glow
};

export const ACHIEVEMENT_TAGS: AchievementTag[] = [
  { key: "candle_keeper", name: "Candle Keeper", emoji: "🕯️", cost: 30, blurb: "Held a full candle hour together.", hue: "#e8c464" },
  { key: "grateful_heart", name: "Grateful Heart", emoji: "🌸", cost: 40, blurb: "Named the good, over and over.", hue: "#ff9db1" },
  { key: "steady_breath", name: "Steady Breath", emoji: "🫧", cost: 40, blurb: "Breathed as one.", hue: "#a3d5ff" },
  { key: "night_owls", name: "Night Owls", emoji: "🌙", cost: 60, blurb: "Ritualed past midnight.", hue: "#c9a3ff" },
  { key: "warm_hands", name: "Warm Hands", emoji: "🔥", cost: 80, blurb: "Never let the other go cold.", hue: "#ff8a5c" },
  { key: "love_letter_seal", name: "Sealed with Wax", emoji: "✉️", cost: 100, blurb: "Wrote a letter worth waiting for.", hue: "#c96b7a" },
  { key: "constellation_maker", name: "Star Cartographer", emoji: "✧", cost: 120, blurb: "Charted a sky of moments.", hue: "#c9a84c" },
  { key: "devoted", name: "Devoted", emoji: "❤︎", cost: 200, blurb: "Showed up, again and again.", hue: "#ff5c7a" },
  { key: "eternal_flame", name: "Eternal Flame", emoji: "✦", cost: 500, blurb: "A rare, quiet kind of love.", hue: "#f5efd8" },
];

export const TAG_BY_KEY: Record<string, AchievementTag> = Object.fromEntries(
  ACHIEVEMENT_TAGS.map((t) => [t.key, t]),
);

// Coin rewards per ritual kind (both partners get this each).
export const RITUAL_REWARD: Record<string, number> = {
  candle: 30,
  breathing: 15,
  gratitude: 20,
};
