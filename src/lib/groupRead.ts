// Tracks per-user, per-group "last read" timestamp in localStorage so we can
// compute unread badges for group chats without a per-user read receipt table.

const keyFor = (userId: string, groupId: string) => `group-read:${userId}:${groupId}`;

function toMs(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function getGroupLastRead(userId: string, groupId: string): string | null {
  try {
    return localStorage.getItem(keyFor(userId, groupId));
  } catch {
    return null;
  }
}

export function setGroupLastRead(userId: string, groupId: string, iso: string) {
  try {
    const prev = localStorage.getItem(keyFor(userId, groupId));
    if (!prev || toMs(prev) < toMs(iso)) {
      localStorage.setItem(keyFor(userId, groupId), iso);
      window.dispatchEvent(new CustomEvent("group-read-updated", { detail: { groupId, iso } }));
    }
  } catch {
    /* ignore */
  }
}

export function markGroupReadNow(userId: string, groupId: string) {
  setGroupLastRead(userId, groupId, new Date().toISOString());
}

export function isGroupMessageUnread(userId: string, groupId: string, createdAt: string): boolean {
  const lastRead = getGroupLastRead(userId, groupId);
  return !lastRead || toMs(createdAt) > toMs(lastRead);
}
