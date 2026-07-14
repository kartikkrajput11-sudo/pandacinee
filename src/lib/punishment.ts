export type PunishmentType =
  | "write"
  | "compliment"
  | "funny"
  | "draw"
  | "photo"
  | "voice"
  | "quiz";

export type PunishmentLock = {
  id: string;
  locker_id: string;
  target_id: string;
  type: PunishmentType;
  prompt: string;
  required_count: number;
  progress: number;
  status: "active" | "completed" | "cancelled" | "expired";
  max_duration_seconds: number | null;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const PUNISHMENT_TYPES: {
  id: PunishmentType;
  label: string;
  emoji: string;
  hint: string;
  presets: { prompt: string; count?: number }[];
  countable: boolean;
  defaultCount: number;
}[] = [
  {
    id: "write",
    label: "Write Challenge",
    emoji: "✍️",
    hint: "Type a phrase N times exactly.",
    countable: true,
    defaultCount: 20,
    presets: [
      { prompt: "Sorry ❤️", count: 20 },
      { prompt: "I love you", count: 50 },
      { prompt: "You're the best", count: 30 },
    ],
  },
  {
    id: "compliment",
    label: "Compliment Challenge",
    emoji: "❤️",
    hint: "Write unique compliments (min 5 chars each).",
    countable: true,
    defaultCount: 10,
    presets: [
      { prompt: "10 compliments about your partner", count: 10 },
      { prompt: "20 reasons you love them", count: 20 },
    ],
  },
  {
    id: "funny",
    label: "Funny Challenge",
    emoji: "😂",
    hint: "One playful entry (joke, story, emoji story).",
    countable: true,
    defaultCount: 1,
    presets: [
      { prompt: "Tell a joke", count: 1 },
      { prompt: "Share an embarrassing story", count: 1 },
      { prompt: "Describe your partner using only emojis", count: 1 },
    ],
  },
  {
    id: "draw",
    label: "Draw Challenge",
    emoji: "🎨",
    hint: "Doodle on Paint Together, then mark done.",
    countable: false,
    defaultCount: 1,
    presets: [
      { prompt: "Draw a heart for your partner" },
      { prompt: "Sketch your partner as a panda" },
      { prompt: "Draw your favourite date" },
    ],
  },
  {
    id: "photo",
    label: "Photo Challenge",
    emoji: "📸",
    hint: "Send a photo to complete.",
    countable: false,
    defaultCount: 1,
    presets: [
      { prompt: "Send today's selfie" },
      { prompt: "Show your favourite snack" },
      { prompt: "Click something blue" },
      { prompt: "Show your workspace" },
    ],
  },
  {
    id: "voice",
    label: "Voice Challenge",
    emoji: "🎤",
    hint: "Record a voice note.",
    countable: false,
    defaultCount: 1,
    presets: [
      { prompt: 'Say: "I miss you"' },
      { prompt: 'Say: "You\'re the cutest"' },
      { prompt: "Sing 5 seconds of a love song" },
    ],
  },
  {
    id: "quiz",
    label: "Quiz Challenge",
    emoji: "📝",
    hint: "Answer Love Quiz questions correctly.",
    countable: true,
    defaultCount: 5,
    presets: [
      { prompt: "Answer 5 Love Quiz questions", count: 5 },
      { prompt: "Answer 3 Love Quiz questions", count: 3 },
    ],
  },
];

export const DURATION_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "Until completed", seconds: null },
  { label: "5 minutes", seconds: 300 },
  { label: "30 minutes", seconds: 1800 },
  { label: "1 hour", seconds: 3600 },
];

const BLOCKED = [
  "kill",
  "hate",
  "die",
  "hurt",
  "slap",
  "hit ",
  "abuse",
  "stupid",
  "idiot",
  "fuck",
  "shit",
  "bitch",
  "ugly",
  "worthless",
  "punch",
];

export function containsBlocked(text: string): boolean {
  const t = ` ${text.toLowerCase()} `;
  return BLOCKED.some((b) => t.includes(b));
}

export function typeMeta(t: PunishmentType) {
  return PUNISHMENT_TYPES.find((p) => p.id === t)!;
}
