// Watch party / couple-sync removed. Stub kept so the movie watch page
// compiles as a normal single-viewer player without shared playback state.

export function fmtTime(sec: number | null | undefined) {
  if (sec == null || !isFinite(sec)) return "0:00";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${mm}:${String(r).padStart(2, "0")}`;
}

export function useWatchSync(
  _meId: string | null,
  _partnerId: string | null,
  _roomId: string,
  _kind: "movie" | "tv",
) {
  return {
    mine: null as null,
    peer: null as null,
    partnerOnline: false,
    publish: (_: unknown) => {},
    sendSeek: (_: number) => {},
    sendCountdown: (_: number) => {},
    countdown: null as null,
    clearCountdown: () => {},
    incomingSeek: null as null,
    clearIncomingSeek: () => {},
    incomingReaction: null as null,
    clearIncomingReaction: () => {},
    sendReaction: (_: string) => {},
    hostId: null as string | null,
    claimHost: () => {},
    releaseHost: () => {},
    drift: 0,
  };
}
