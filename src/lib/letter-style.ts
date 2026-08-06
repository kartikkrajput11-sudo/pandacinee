/**
 * Letter styling presets — paper, handwriting and decorations.
 * Stored on love_letters.style (jsonb) so both sides render the letter the
 * exact way the writer designed it.
 */

export type LetterStyle = {
  paper?: string;
  font?: string;
  decoration?: string;
};

export const LETTER_PAPERS: {
  id: string;
  label: string;
  /** Inline background for the letter page. */
  background: string;
  ink: string;
}[] = [
  {
    id: "midnight",
    label: "Midnight",
    background:
      "radial-gradient(120% 80% at 50% 0%, rgba(236,72,153,0.10), transparent 60%), linear-gradient(160deg,#170d16,#0d070d)",
    ink: "#f3e6ee",
  },
  {
    id: "parchment",
    label: "Parchment",
    background:
      "radial-gradient(100% 70% at 20% 0%, rgba(201,181,144,0.22), transparent 65%), linear-gradient(160deg,#1c1811,#100d09)",
    ink: "#f2e8d5",
  },
  {
    id: "blush",
    label: "Blush",
    background:
      "radial-gradient(110% 80% at 80% 0%, rgba(240,192,204,0.18), transparent 60%), linear-gradient(160deg,#24101a,#150910)",
    ink: "#fbdfe7",
  },
  {
    id: "linen",
    label: "Linen",
    background:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 6px), linear-gradient(160deg,#1a1a18,#0e0e0d)",
    ink: "#eeeae1",
  },
  {
    id: "aurora",
    label: "Aurora",
    background:
      "radial-gradient(90% 70% at 10% 10%, rgba(92,189,185,0.18), transparent 60%), radial-gradient(90% 70% at 90% 90%, rgba(201,168,76,0.16), transparent 60%), linear-gradient(160deg,#0b1620,#060c12)",
    ink: "#e5f2f0",
  },
];

export const LETTER_FONTS: { id: string; label: string; stack: string }[] = [
  { id: "serif", label: "Classic", stack: "'Cormorant Garamond','Playfair Display',Georgia,serif" },
  { id: "script", label: "Script", stack: "'Brush Script MT','Segoe Script',cursive" },
  { id: "type", label: "Typewriter", stack: "'Courier New',ui-monospace,monospace" },
  { id: "modern", label: "Modern", stack: "ui-sans-serif,system-ui,'Segoe UI',sans-serif" },
];

export const LETTER_DECORATIONS: { id: string; label: string; emoji: string }[] = [
  { id: "none", label: "Bare", emoji: "◦" },
  { id: "petals", label: "Petals", emoji: "🌸" },
  { id: "stars", label: "Stars", emoji: "✦" },
  { id: "hearts", label: "Hearts", emoji: "❤" },
  { id: "bamboo", label: "Bamboo", emoji: "🎋" },
];

export function paperOf(style: LetterStyle | null | undefined) {
  return LETTER_PAPERS.find((p) => p.id === style?.paper) ?? null;
}

export function fontOf(style: LetterStyle | null | undefined) {
  return (
    LETTER_FONTS.find((f) => f.id === style?.font) ?? LETTER_FONTS[0]
  );
}

export function decorationOf(style: LetterStyle | null | undefined) {
  return LETTER_DECORATIONS.find((d) => d.id === style?.decoration) ?? LETTER_DECORATIONS[0];
}

/** Deterministic scatter positions so a letter always decorates the same way. */
export function decorationSpots(seed: string, count = 10) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    left: `${Math.round(rand() * 92) + 2}%`,
    top: `${Math.round(rand() * 88) + 4}%`,
    size: 10 + Math.round(rand() * 16),
    opacity: 0.12 + rand() * 0.24,
    delay: `${(rand() * 4).toFixed(2)}s`,
  }));
}
