export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export function computeCountdown(target: Date, now = Date.now()): Countdown {
  const totalMs = Math.max(0, target.getTime() - now);
  const days = Math.floor(totalMs / 86400000);
  const hours = Math.floor((totalMs % 86400000) / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  return { days, hours, minutes, seconds, totalMs };
}

export function nextAnniversary(anniversaryISO: string | null | undefined, paired: string | null | undefined) {
  const baseISO = anniversaryISO ?? paired ?? null;
  if (!baseISO) return null;
  const base = new Date(baseISO);
  if (isNaN(base.getTime())) return null;
  const now = new Date();
  const next = new Date(now.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setFullYear(now.getFullYear() + 1);
  const years = next.getFullYear() - base.getFullYear();
  return { base, next, years };
}

export function daysTogether(base: Date) {
  return Math.max(0, Math.floor((Date.now() - base.getTime()) / 86400000));
}

const MILESTONES = [7, 30, 50, 100, 200, 365, 500, 730, 1000, 1500, 2000, 2500, 3000, 3650];

export function nextMilestone(base: Date) {
  const days = daysTogether(base);
  const next = MILESTONES.find((m) => m > days);
  if (!next) return null;
  const target = new Date(base.getTime() + next * 86400000);
  return { days: next, target };
}

export function milestoneLabel(days: number): string {
  if (days % 365 === 0) return `${days / 365} year${days === 365 ? "" : "s"}`;
  if (days === 100) return "100 days 💯";
  if (days === 1000) return "1000 days ✨";
  return `${days} days`;
}
