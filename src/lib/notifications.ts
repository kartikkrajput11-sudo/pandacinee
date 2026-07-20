// Persistent in-browser notification center store.
// Feeds the bell icon inbox — separate from transient toasts.

export type NotifKind =
  | "dm"
  | "group"
  | "broadcast"
  | "call"
  | "system";

export type NotifItem = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  icon?: string | null;      // avatar url or emoji
  href?: string;             // deep link
  createdAt: number;
  read: boolean;
  meta?: Record<string, any>;
};

const MAX = 60;
const keyFor = (uid: string | null) =>
  `pandacine.notifs.${uid ?? "anon"}`;

let currentUid: string | null = null;
let items: NotifItem[] = [];
const listeners = new Set<(items: NotifItem[]) => void>();

function load() {
  try {
    const raw = localStorage.getItem(keyFor(currentUid));
    items = raw ? (JSON.parse(raw) as NotifItem[]) : [];
  } catch {
    items = [];
  }
}

function save() {
  try {
    localStorage.setItem(keyFor(currentUid), JSON.stringify(items.slice(0, MAX)));
  } catch {
    // ignore quota
  }
}

function emit() {
  const snapshot = items.slice();
  for (const fn of listeners) fn(snapshot);
}

export function setNotifUser(uid: string | null) {
  if (currentUid === uid) return;
  currentUid = uid;
  load();
  emit();
}

export function pushNotification(
  n: Omit<NotifItem, "id" | "createdAt" | "read"> & { id?: string },
) {
  const id = n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // De-dupe by id — preserve prior read/createdAt so a re-broadcast doesn't
  // resurrect an already-dismissed notification as unread.
  const prior = items.find((x) => x.id === id);
  if (prior) return; // already tracked; nothing to do
  items.unshift({
    ...n,
    id,
    createdAt: Date.now(),
    read: false,
  });
  if (items.length > MAX) items.length = MAX;
  save();
  emit();
}

export function markAllRead() {
  let changed = false;
  items = items.map((x) => {
    if (!x.read) changed = true;
    return { ...x, read: true };
  });
  if (changed) {
    save();
    emit();
  }
}

export function markRead(id: string) {
  const idx = items.findIndex((x) => x.id === id);
  if (idx < 0 || items[idx].read) return;
  items[idx] = { ...items[idx], read: true };
  save();
  emit();
}

export function removeNotification(id: string) {
  const before = items.length;
  items = items.filter((x) => x.id !== id);
  if (items.length !== before) {
    save();
    emit();
  }
}

export function clearAll() {
  if (items.length === 0) return;
  items = [];
  save();
  emit();
}

export function getNotifications() {
  return items.slice();
}

export function subscribeNotifications(fn: (items: NotifItem[]) => void) {
  listeners.add(fn);
  fn(items.slice());
  return () => listeners.delete(fn);
}
