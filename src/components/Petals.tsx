/**
 * Decorative floating petals — used on landing + anniversary mode.
 * Pure CSS, no JS animation cost.
 */
export function Petals({ count = 8 }: { count?: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 97) % 100;
        const delay = (i * 1.7) % 12;
        const duration = 10 + ((i * 3) % 8);
        const size = 6 + ((i * 5) % 10);
        const isPetal = i % 2 === 0;
        return (
          <span
            key={i}
            className="absolute top-0 rounded-full animate-petal blur-[1px]"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: isPetal
                ? "color-mix(in oklab, var(--petal) 60%, transparent)"
                : "color-mix(in oklab, var(--lavender) 70%, transparent)",
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        );
      })}
    </div>
  );
}
