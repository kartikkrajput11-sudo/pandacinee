export type PunishmentType =
  | "write"
  | "compliment"
  | "funny"
  | "draw"
  | "photo"
  | "voice"
  | "quiz"
  | "card"
  | "video"
  | "activity"
  | "creative";

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
  shared?: boolean;
  verification_status?: "none" | "pending" | "approved" | "retry";
  verification_feedback?: string | null;
};

/**
 * Category verification model:
 *  - "auto": progress-tracked, no partner approval needed (write, compliment, funny, quiz).
 *  - "verify": submissions go through the Verification Chat and partner must approve.
 */
export type VerificationMode = "auto" | "verify";

export const PUNISHMENT_TYPES: {
  id: PunishmentType;
  label: string;
  emoji: string;
  hint: string;
  presets: { prompt: string; count?: number }[];
  countable: boolean;
  defaultCount: number;
  mode: VerificationMode;
  /** Profile flag both partners must have enabled to allow this category. Undefined = always allowed when Punishment Lock master toggle is on. */
  optInKey?:
    | "pl_cat_writing"
    | "pl_cat_card"
    | "pl_cat_video"
    | "pl_cat_voice"
    | "pl_cat_photo"
    | "pl_cat_activity"
    | "pl_cat_creative";
}[] = [
  {
    id: "write",
    label: "Writing",
    emoji: "✍️",
    hint: "Type a phrase N times exactly.",
    countable: true,
    defaultCount: 20,
    mode: "auto",
    optInKey: "pl_cat_writing",
    presets: [
      { prompt: "Sorry ❤️", count: 20 },
      { prompt: "I love you", count: 50 },
      { prompt: "You're the best", count: 30 },
    ],
  },
  {
    id: "compliment",
    label: "Compliments",
    emoji: "❤️",
    hint: "Write unique compliments (min 5 chars each).",
    countable: true,
    defaultCount: 10,
    mode: "auto",
    optInKey: "pl_cat_writing",
    presets: [
      { prompt: "10 compliments about your partner", count: 10 },
      { prompt: "20 reasons you love them", count: 20 },
    ],
  },
  {
    id: "funny",
    label: "Funny",
    emoji: "😂",
    hint: "One playful entry (joke, story, emoji story).",
    countable: true,
    defaultCount: 1,
    mode: "auto",
    optInKey: "pl_cat_writing",
    presets: [
      { prompt: "Tell a joke", count: 1 },
      { prompt: "Share an embarrassing story", count: 1 },
      { prompt: "Describe your partner using only emojis", count: 1 },
    ],
  },
  {
    id: "quiz",
    label: "Love Quiz",
    emoji: "📝",
    hint: "Answer Love Quiz questions correctly.",
    countable: true,
    defaultCount: 5,
    mode: "auto",
    presets: [
      { prompt: "Answer 5 Love Quiz questions", count: 5 },
      { prompt: "Answer 3 Love Quiz questions", count: 3 },
    ],
  },
  {
    id: "card",
    label: "Digital Card",
    emoji: "💌",
    hint: "Design a cute apology or love card.",
    countable: false,
    defaultCount: 1,
    mode: "verify",
    optInKey: "pl_cat_card",
    presets: [
      { prompt: "Create a cute apology card" },
      { prompt: "Make a thank-you card" },
      { prompt: "Design a love note" },
      { prompt: "Send a virtual flower card" },
    ],
  },
  {
    id: "video",
    label: "Video",
    emoji: "🎥",
    hint: "Record and upload a short video.",
    countable: false,
    defaultCount: 1,
    mode: "verify",
    optInKey: "pl_cat_video",
    presets: [
      { prompt: "Send a cute good morning video" },
      { prompt: "Do a silly dance for 10 seconds" },
      { prompt: "Blow a kiss to the camera" },
      { prompt: 'Say "I love you" in 5 different ways' },
    ],
  },
  {
    id: "voice",
    label: "Voice",
    emoji: "🎤",
    hint: "Record a voice note.",
    countable: false,
    defaultCount: 1,
    mode: "verify",
    optInKey: "pl_cat_voice",
    presets: [
      { prompt: "Record an apology" },
      { prompt: "Sing a favourite song for 15 seconds" },
      { prompt: "Read a love letter aloud" },
    ],
  },
  {
    id: "photo",
    label: "Photo",
    emoji: "📸",
    hint: "Send a photo to complete.",
    countable: false,
    defaultCount: 1,
    mode: "verify",
    optInKey: "pl_cat_photo",
    presets: [
      { prompt: "Send today's cutest selfie" },
      { prompt: "Show your favourite outfit" },
      { prompt: "Share your favourite place right now" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    emoji: "💪",
    hint: "Complete a light activity; send a short proof video.",
    countable: false,
    defaultCount: 1,
    mode: "verify",
    optInKey: "pl_cat_activity",
    presets: [
      { prompt: "10 sit-ups" },
      { prompt: "20 jumping jacks" },
      { prompt: "Hold a 30 second plank" },
      { prompt: "15 squats" },
    ],
  },
  {
    id: "creative",
    label: "Creative",
    emoji: "🎨",
    hint: "Poem, doodle, meme — get creative.",
    countable: false,
    defaultCount: 1,
    mode: "verify",
    optInKey: "pl_cat_creative",
    presets: [
      { prompt: "Write a short poem for your partner" },
      { prompt: "Draw your partner as a panda" },
      { prompt: "Create a couple meme" },
      { prompt: "Make a doodle about your day" },
    ],
  },
  {
    id: "draw",
    label: "Drawing",
    emoji: "🖌️",
    hint: "Doodle on Paint Together and share it.",
    countable: false,
    defaultCount: 1,
    mode: "verify",
    optInKey: "pl_cat_creative",
    presets: [
      { prompt: "Draw a heart for your partner" },
      { prompt: "Sketch your partner as a panda" },
      { prompt: "Draw your favourite date" },
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
  "naked",
  "strip",
];

export function containsBlocked(text: string): boolean {
  const t = ` ${text.toLowerCase()} `;
  return BLOCKED.some((b) => t.includes(b));
}

export function typeMeta(t: PunishmentType) {
  return PUNISHMENT_TYPES.find((p) => p.id === t)!;
}

export const CATEGORY_SETTINGS: {
  key: NonNullable<ReturnType<typeof typeMeta>["optInKey"]>;
  label: string;
  emoji: string;
  description: string;
}[] = [
  { key: "pl_cat_writing",  label: "Writing challenges",  emoji: "✍️", description: "Write phrases, compliments, jokes." },
  { key: "pl_cat_card",     label: "Digital cards",       emoji: "💌", description: "Apology / thank-you / love cards." },
  { key: "pl_cat_video",    label: "Video challenges",    emoji: "🎥", description: "Short recorded videos." },
  { key: "pl_cat_voice",    label: "Voice challenges",    emoji: "🎤", description: "Recorded voice notes." },
  { key: "pl_cat_photo",    label: "Photo challenges",    emoji: "📸", description: "Selfies, outfit-of-the-day, moments." },
  { key: "pl_cat_activity", label: "Activity challenges", emoji: "💪", description: "Light physical activities. Opt-in only." },
  { key: "pl_cat_creative", label: "Creative challenges", emoji: "🎨", description: "Doodles, poems, memes." },
];
