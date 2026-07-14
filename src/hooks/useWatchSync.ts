import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Realtime "watch party" sync between two partners for a single title.
 *
 * We can't fully remote-control the VidKing iframe, but VidKing broadcasts
 * PLAYER_EVENT via window.postMessage with { event, currentTime, duration }.
 * We capture ours locally and broadcast to the partner over a Supabase
 * Realtime channel. Either partner can then:
 *   - see partner's live time / play state / drift
 *   - "sync to partner" (reload iframe at their timestamp)
 *   - schedule a synced countdown so both press play together
 *
 * Nothing is persisted. The room is scoped to the pair + title + mediaType.
 */

export type PlayerEvent = "play" | "pause" | "seeked" | "timeupdate" | "ended" | "ready" | string;

export type PeerState = {
  event: PlayerEvent;
  currentTime: number;
  duration: number;
  updatedAt: number;
  sourceIdx?: number;
};

export type SyncCommand =
  | { kind: "seekTo"; time: number; from: string }
  | { kind: "countdown"; startAt: number; from: string; time?: number }
  | { kind: "requestSync"; from: string }
  | { kind: "claimHost"; from: string }
  | { kind: "releaseHost"; from: string };

export function useWatchSync(
  meId: string | null,
  partnerId: string | null,
  movieId: number,
  mediaType: "movie" | "tv" = "movie",
) {
  const [mine, setMine] = useState<PeerState>({
    event: "ready",
    currentTime: 0,
    duration: 0,
    updatedAt: Date.now(),
  });
  const [peer, setPeer] = useState<PeerState | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [countdown, setCountdown] = useState<{ startAt: number; time?: number; from: string } | null>(null);
  const [incomingSeek, setIncomingSeek] = useState<{ time: number; from: string; id: number } | null>(null);
  const [incomingReaction, setIncomingReaction] = useState<{ emoji: string; id: number } | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const hostRef = useRef<string | null>(null);
  hostRef.current = hostId;

  useEffect(() => {
    if (!meId || !partnerId || !movieId) return;
    const topic = `watch-sync:${mediaType}:${movieId}:${[meId, partnerId].sort().join(":")}`;
    const ch = supabase.channel(topic, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      setPeer(payload as PeerState);
    });
    ch.on("broadcast", { event: "cmd" }, ({ payload }) => {
      const cmd = payload as SyncCommand;
      if (cmd.kind === "seekTo") {
        setIncomingSeek({ time: cmd.time, from: cmd.from, id: Date.now() });
      } else if (cmd.kind === "countdown") {
        setCountdown({ startAt: cmd.startAt, time: cmd.time, from: cmd.from });
      } else if (cmd.kind === "requestSync") {
        ch.send({ type: "broadcast", event: "state", payload: mineRef.current });
        // Also announce host status so late joiner sees it
        if (hostRef.current === meId) {
          ch.send({ type: "broadcast", event: "cmd", payload: { kind: "claimHost", from: meId } });
        }
      } else if (cmd.kind === "claimHost") {
        setHostId(cmd.from);
      } else if (cmd.kind === "releaseHost") {
        setHostId((prev) => (prev === cmd.from ? null : prev));
      }
    });
    ch.on("broadcast", { event: "reaction" }, ({ payload }) => {
      const p = payload as { emoji: string };
      setIncomingReaction({ emoji: p.emoji, id: Date.now() + Math.random() });
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown>;
      setPartnerOnline(Boolean(state[partnerId]));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ at: Date.now() });
        // ask partner for their current state on join
        ch.send({ type: "broadcast", event: "cmd", payload: { kind: "requestSync", from: meId } });
      }
    });
    chRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
      setPeer(null);
      setPartnerOnline(false);
      setCountdown(null);
    };
  }, [meId, partnerId, movieId, mediaType]);

  // publish my state (throttled by caller — we just send whatever it gives us)
  const publish = useCallback((patch: Partial<PeerState>) => {
    const next: PeerState = { ...mineRef.current, ...patch, updatedAt: Date.now() };
    mineRef.current = next;
    setMine(next);
    chRef.current?.send({ type: "broadcast", event: "state", payload: next });
  }, []);

  const sendSeek = useCallback((time: number) => {
    if (!meId) return;
    chRef.current?.send({
      type: "broadcast",
      event: "cmd",
      payload: { kind: "seekTo", time, from: meId } satisfies SyncCommand,
    });
  }, [meId]);

  const sendCountdown = useCallback((seconds: number, time?: number) => {
    if (!meId) return;
    const startAt = Date.now() + seconds * 1000;
    const payload: SyncCommand = { kind: "countdown", startAt, from: meId, time };
    chRef.current?.send({ type: "broadcast", event: "cmd", payload });
    setCountdown({ startAt, time, from: meId });
  }, [meId]);

  const clearCountdown = useCallback(() => setCountdown(null), []);
  const clearIncomingSeek = useCallback(() => setIncomingSeek(null), []);
  const clearIncomingReaction = useCallback(() => setIncomingReaction(null), []);

  const sendReaction = useCallback((emoji: string) => {
    chRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } });
  }, []);

  const claimHost = useCallback(() => {
    if (!meId) return;
    setHostId(meId);
    chRef.current?.send({
      type: "broadcast",
      event: "cmd",
      payload: { kind: "claimHost", from: meId } satisfies SyncCommand,
    });
  }, [meId]);

  const releaseHost = useCallback(() => {
    if (!meId) return;
    setHostId((prev) => (prev === meId ? null : prev));
    chRef.current?.send({
      type: "broadcast",
      event: "cmd",
      payload: { kind: "releaseHost", from: meId } satisfies SyncCommand,
    });
  }, [meId]);

  // drift (positive => I'm ahead of partner)
  const drift =
    peer && mine.duration > 0
      ? mine.currentTime - peer.currentTime
      : null;

  return {
    mine,
    peer,
    partnerOnline,
    publish,
    sendSeek,
    sendCountdown,
    countdown,
    clearCountdown,
    incomingSeek,
    clearIncomingSeek,
    incomingReaction,
    clearIncomingReaction,
    sendReaction,
    hostId,
    claimHost,
    releaseHost,
    drift,
  };
}

export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
