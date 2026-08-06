import { decorationOf, decorationSpots, type LetterStyle } from "@/lib/letter-style";

/**
 * Ambient decoration layer (petals / stars / hearts / bamboo) drifting over
 * the letter page. Purely decorative.
 */
export function LetterDecorations({
  style,
  seed,
  count = 12,
}: {
  style: LetterStyle | null | undefined;
  seed: string;
  count?: number;
}) {
  const deco = decorationOf(style);
  if (deco.id === "none") return null;
  const spots = decorationSpots(seed, count);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {spots.map((s, i) => (
        <span
          key={i}
          className="absolute animate-float-slow"
          style={{
            left: s.left,
            top: s.top,
            fontSize: s.size,
            opacity: s.opacity,
            animationDelay: s.delay,
          }}
        >
          {deco.emoji}
        </span>
      ))}
    </div>
  );
}
