/**
 * Anniversary Day Mode — decides whether "today" is a couple's special day.
 * Purely date math on the anchor date (anniversary_date, else paired_at).
 */

export type AnnivDay =
  | { kind: "year"; count: number; anchor: Date }
  | { kind: "month"; count: number; anchor: Date }
  | null;

export function anniversaryDayFor(
  anniversaryDate: string | null | undefined,
  pairedAt: string | null | undefined,
  now = new Date(),
): AnnivDay {
  const iso = anniversaryDate || pairedAt;
  if (!iso) return null;
  const anchor = new Date(iso);
  if (isNaN(anchor.getTime())) return null;

  const sameDayOfMonth = now.getDate() === anchor.getDate();
  if (!sameDayOfMonth) return null;

  if (now.getMonth() === anchor.getMonth() && now.getFullYear() > anchor.getFullYear()) {
    return { kind: "year", count: now.getFullYear() - anchor.getFullYear(), anchor };
  }

  const months =
    (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth());
  if (months >= 1) return { kind: "month", count: months, anchor };

  return null;
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function annivTitle(day: NonNullable<AnnivDay>) {
  return day.kind === "year"
    ? `${ordinal(day.count)} Anniversary`
    : `${ordinal(day.count)} Month Together`;
}

export function daysTogetherFrom(anchor: Date, now = new Date()) {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.floor((b - a) / 86400000));
}

export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
