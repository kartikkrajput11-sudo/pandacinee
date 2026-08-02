import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

/**
 * One labelled settings section. Rows inside sit on a single card so the
 * page reads as a few organised groups instead of a stack of loose buttons.
 */
export function SettingsGroup({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-5 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[10px] uppercase tracking-[0.28em] text-petal">{title}</h2>
        {hint ? <span className="text-[10px] text-candle-muted">{hint}</span> : null}
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-surface divide-y divide-border/60">
        {children}
      </div>
    </section>
  );
}

type RowInner = {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  trailing?: React.ReactNode;
};

function RowBody({ icon, label, description, trailing }: RowInner) {
  return (
    <>
      {icon ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-petal-soft/40 text-petal">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-candle">{label}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-[11px] text-candle-muted">{description}</span>
        ) : null}
      </span>
      {trailing ?? <ChevronRight className="size-4 shrink-0 text-candle-muted" />}
    </>
  );
}

const ROW = "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-petal-soft/10";

export function SettingsLinkRow({ to, ...rest }: RowInner & { to: string }) {
  return (
    <Link to={to as never} className={ROW}>
      <RowBody {...rest} />
    </Link>
  );
}

export function SettingsButtonRow({
  onClick,
  ...rest
}: RowInner & { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={ROW}>
      <RowBody {...rest} />
    </button>
  );
}

/** A row that just hosts custom content (toggles, pickers, grids). */
export function SettingsPanelRow({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>;
}
