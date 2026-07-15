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

type Mine = {
  currentTime: number;
  duration: number;
  playbackRate: number;
  updatedAt: number;
  event: string | null;
  sourceIdx: number;
  season: number | null;
  episode: number | null;
};

export function useWatchSync(
  _meId: string | null,
  _partnerId: string | null,
  _roomId: string,
  _kind: "movie" | "tv",
) {
  const mine: Mine = {
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    updatedAt: 0,
    event: null,
    sourceIdx: 0,
    season: null,
    episode: null,
  };
  return {
    mine,
    peer: null as Mine | null,
    partnerOnline: false,
    publish: (_: Partial<Mine>) => {},
    sendSeek: (..._args: unknown[]) => {},
    sendCountdown: (..._args: unknown[]) => {},
    countdown: null as { time: number; startAt: number } | null,
    clearCountdown: () => {},
    incomingSeek: null as ({ time: number; startAt?: number } | null),
    clearIncomingSeek: () => {},
    incomingReaction: null as { id: number; emoji: string } | null,
    clearIncomingReaction: () => {},
    sendReaction: (_: string) => {},
    hostId: null as string | null,
    claimHost: () => {},
    releaseHost: () => {},
    drift: 0,
  };
}
