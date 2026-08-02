/**
 * The Pandacine occasion calendar.
 *
 * Every occasion is a yearly recurrence. Fixed ones are month/day pairs;
 * floating ones (Friendship Day, Sweetest Day) resolve per year.
 */

export type OccasionTone = "love" | "friend" | "festive";

export type Occasion = {
  key: string;
  label: string;
  emoji: string;
  tone: OccasionTone;
  blurb: string;
  /** 1-12 */
  month: number;
  /** 1-31, or a resolver for floating dates */
  day: number | ((year: number) => number);
};

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const first = new Date(year, month - 1, 1).getDay();
  const offset = (weekday - first + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

export const OCCASIONS: Occasion[] = [
  { key: "new-year", label: "New Year's Day", emoji: "🎆", tone: "festive", blurb: "A brand new chapter, together.", month: 1, day: 1 },
  { key: "hug-day-intl", label: "National Hugging Day", emoji: "🫂", tone: "love", blurb: "Send a hug — the app has one built in.", month: 1, day: 21 },

  // Valentine's week
  { key: "rose-day", label: "Rose Day", emoji: "🌹", tone: "love", blurb: "Valentine's week opens with a single rose.", month: 2, day: 7 },
  { key: "propose-day", label: "Propose Day", emoji: "💍", tone: "love", blurb: "Say the thing you've been rehearsing.", month: 2, day: 8 },
  { key: "chocolate-day", label: "Chocolate Day", emoji: "🍫", tone: "love", blurb: "Sweet things for a sweeter person.", month: 2, day: 9 },
  { key: "teddy-day", label: "Teddy Day", emoji: "🧸", tone: "love", blurb: "Something soft to hold when they can't.", month: 2, day: 10 },
  { key: "promise-day", label: "Promise Day", emoji: "🤞", tone: "love", blurb: "One promise, kept properly.", month: 2, day: 11 },
  { key: "hug-day", label: "Hug Day", emoji: "🤗", tone: "love", blurb: "Hold on a few seconds longer.", month: 2, day: 12 },
  { key: "kiss-day", label: "Kiss Day", emoji: "💋", tone: "love", blurb: "You know which button to press.", month: 2, day: 13 },
  { key: "valentines", label: "Valentine's Day", emoji: "❤️", tone: "love", blurb: "The whole week was leading here.", month: 2, day: 14 },

  { key: "womens-day", label: "International Women's Day", emoji: "💐", tone: "festive", blurb: "Celebrate her, loudly.", month: 3, day: 8 },
  { key: "happiness-day", label: "Day of Happiness", emoji: "🌞", tone: "festive", blurb: "Do one small thing that makes them smile.", month: 3, day: 20 },
  { key: "kiss-intl", label: "International Kissing Day", emoji: "😘", tone: "love", blurb: "No excuse needed today.", month: 7, day: 6 },
  { key: "friendship-intl", label: "International Friendship Day", emoji: "🤝", tone: "friend", blurb: "Message the friends you've been meaning to.", month: 7, day: 30 },
  { key: "girlfriend-day", label: "National Girlfriend Day", emoji: "👑", tone: "love", blurb: "Her day. Spoil her.", month: 8, day: 1 },
  { key: "friendship-day", label: "Friendship Day", emoji: "🎈", tone: "friend", blurb: "First Sunday of August — for the crew.", month: 8, day: (y) => nthWeekdayOfMonth(y, 8, 0, 1) },
  { key: "boyfriend-day", label: "National Boyfriend Day", emoji: "🕶️", tone: "love", blurb: "His day. Spoil him.", month: 10, day: 3 },
  { key: "sweetest-day", label: "Sweetest Day", emoji: "🍬", tone: "love", blurb: "Third Saturday of October — small kindnesses.", month: 10, day: (y) => nthWeekdayOfMonth(y, 10, 6, 3) },
  { key: "christmas", label: "Christmas", emoji: "🎄", tone: "festive", blurb: "Lights, films, and a warm blanket.", month: 12, day: 25 },
  { key: "nye", label: "New Year's Eve", emoji: "🥂", tone: "festive", blurb: "Countdown together, wherever you are.", month: 12, day: 31 },
];

export function occasionDay(o: Occasion, year: number) {
  return typeof o.day === "function" ? o.day(year) : o.day;
}

export function ymd(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysUntil(target: Date, from = new Date()) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Next occurrence of a month/day pair, this year or next. */
export function nextAnnual(month: number, day: number, from = new Date()) {
  const thisYear = new Date(from.getFullYear(), month - 1, day);
  if (daysUntil(thisYear, from) >= 0) return thisYear;
  return new Date(from.getFullYear() + 1, month - 1, day);
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
