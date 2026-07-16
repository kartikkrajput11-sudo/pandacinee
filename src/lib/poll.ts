// Poll data lives in messages.media_meta when messages.type === 'poll'.
// Votes live in public.poll_votes.

export type PollKind = "text" | "movie" | "date" | "emoji";

export type PollOption = {
  id: string;
  label: string;
  // Optional per-kind metadata (poster url for movie, ISO date, emoji glyph)
  meta?: Record<string, unknown>;
};

export type PollMeta = {
  question: string;
  kind: PollKind;
  options: PollOption[];
  multi?: boolean;
  closed_at?: string | null;
};

export function isPollMeta(v: unknown): v is PollMeta {
  if (!v || typeof v !== "object") return false;
  const m = v as PollMeta;
  return typeof m.question === "string" && Array.isArray(m.options) && typeof m.kind === "string";
}

export function newOptionId() {
  return Math.random().toString(36).slice(2, 10);
}
