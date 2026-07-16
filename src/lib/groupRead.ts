// Tracks per-user, per-group "last read" timestamp in localStorage so we can
// compute unread badges for group chats without a per-user read receipt table.

const keyFor = (userId: string, groupId: string) => `group-read:${userId}:${groupId}`;

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
    if (!prev || prev < iso) {
      localStorage.setItem(keyFor(userId, groupId), iso);
      window.dispatchEvent(new CustomEvent("group-read-updated", { detail: { groupId, iso } }));
    }
  } catch {
    /* ignore */
  }
}
