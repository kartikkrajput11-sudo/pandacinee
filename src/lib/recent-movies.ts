// Track recently viewed movies in localStorage for the "Continue Watching" rail.
const KEY = "pandacine-recent-movies-v1";
const MAX = 12;

export function trackRecentMovie(id: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: number[] = raw ? JSON.parse(raw) : [];
    const next = [id, ...list.filter((x) => x !== id)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function readRecentMovies(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}
