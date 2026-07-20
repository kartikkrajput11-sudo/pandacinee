// Tracks per-user, per-peer "last read" timestamp in localStorage so unread
// badges clear locally even when the user has read receipts disabled (in
// which case we never write messages.read_at in the DB).

const keyFor = (userId: string, peerId: string) => `dm-read:${userId}:${peerId}`;

function toMs(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function getDmLastRead(userId: string, peerId: string): string | null {
  try {
    return localStorage.getItem(keyFor(userId, peerId));
  } catch {
    return null;
  }
}

export function setDmLastRead(userId: string, peerId: string, iso: string) {
  try {
    const prev = localStorage.getItem(keyFor(userId, peerId));
    if (!prev || toMs(prev) < toMs(iso)) {
      localStorage.setItem(keyFor(userId, peerId), iso);
      window.dispatchEvent(new CustomEvent("dm-read-updated", { detail: { peerId, iso } }));
    }
  } catch {
    /* ignore */
  }
}

export function markDmReadNow(userId: string, peerId: string) {
  setDmLastRead(userId, peerId, new Date().toISOString());
}

export function isDmMessageUnread(
  userId: string,
  peerId: string,
  createdAt: string,
  readAt: string | null,
): boolean {
  if (readAt) return false;
  const lastRead = getDmLastRead(userId, peerId);
  if (!lastRead) return true;
  return toMs(createdAt) > toMs(lastRead);
}
