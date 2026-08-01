/**
 * Persistent record of which affection/FX messages have already played their
 * animation for this user, so reopening a chat never replays an affection the
 * user has already seen. Stored per (me, peer) thread in localStorage.
 */

const PREFIX = "pandacine:seen-fx:";
const MAX_IDS = 400;

function key(meId: string, peerId: string) {
  return `${PREFIX}${meId}:${peerId}`;
}

export function loadSeenFx(meId: string, peerId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key(meId, peerId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === "string")) : new Set();
  } catch (err) {
    console.error("[seen-affections] failed to read seen set", err);
    return new Set();
  }
}

export function saveSeenFx(meId: string, peerId: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(ids).slice(-MAX_IDS);
    window.localStorage.setItem(key(meId, peerId), JSON.stringify(arr));
  } catch (err) {
    console.error("[seen-affections] failed to persist seen set", err);
  }
}
