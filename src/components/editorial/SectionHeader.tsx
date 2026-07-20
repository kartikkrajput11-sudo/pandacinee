import type { ReactNode } from "react";

/**
 * Aubergine Noir editorial section header.
 * A coral vertical hairline rule + uppercase eyebrow + italic serif title.
 * Used consistently across Home, Play, Chat, Me, Movies, etc.
 */
export function EditorialSectionHeader({
  eyebrow,
  title,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-3 mb-3 ${className}`}>
      <div className="flex items-stretch gap-3 min-w-0">
        <span
          aria-hidden
          className="w-px shrink-0 self-stretch bg-gradient-to-b from-petal/70 via-petal/30 to-transparent"
        />
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] uppercase tracking-[0.28em] text-petal/90">
              {eyebrow}
            </p>
          )}
          <h2 className="font-serif italic text-2xl md:text-3xl leading-tight text-candle truncate">
            {title}
          </h2>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Editorial page hero header. Larger italic serif + coral eyebrow +
 * bottom hairline rule that fades into the aubergine background.
 */
export function EditorialPageHeader({
  eyebrow,
  title,
  subtitle,
  leading,
  trailing,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`relative mb-6 ${className}`}>
      <div className="flex items-start gap-3">
        {leading && <div className="shrink-0 mt-1">{leading}</div>}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[10px] uppercase tracking-[0.28em] text-petal/90 mb-1">
              {eyebrow}
            </p>
          )}
          <h1 className="font-serif italic text-3xl md:text-4xl leading-[1.05] text-candle">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-candle-muted mt-1.5 max-w-md">
              {subtitle}
            </p>
          )}
        </div>
        {trailing && <div className="shrink-0 flex items-center gap-3">{trailing}</div>}
      </div>
      <div
        aria-hidden
        className="mt-4 h-px w-full bg-gradient-to-r from-petal/45 via-petal/15 to-transparent"
      />
    </header>
  );
}
