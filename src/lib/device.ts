// Per-browser device identity. Persisted in localStorage so a tab keeps its
// device_id across reloads. Each browser profile / device gets its own ID,
// which is what the call system uses to route signals to the exact tab/device
// that answered a ringing call.

const KEY = "panda_device_id";

export function getDeviceId(): string {
  try {
    let d = localStorage.getItem(KEY);
    if (!d) {
      d = crypto.randomUUID();
      localStorage.setItem(KEY, d);
    }
    return d;
  } catch {
    return "eph-" + Math.random().toString(36).slice(2, 12);
  }
}
