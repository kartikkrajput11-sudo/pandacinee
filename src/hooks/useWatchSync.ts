// Couple watch sync — Supabase Realtime (presence + broadcast).
// Two-person private sync: partner presence, host election, playback state
// mirroring, seek/countdown/reaction events, and drift tracking.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

export type Mine = {
  currentTime: number;
  duration: number;
  playbackRate: number;
  updatedAt: number;
  event: string | null;
  sourceIdx: number;
  season: number | null;
  episode: number | null;
};

type SourceKind = "pandacine" | "iframe" | "unknown";
type PresenceMeta = { userId: string; joinedAt: number; ready?: boolean; sourceKind?: SourceKind };

const emptyMine = (): Mine => ({
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  updatedAt: 0,
  event: null,
  sourceIdx: 0,
  season: null,
  episode: null,
});

export function useWatchSync(
  meId: string | null,
  partnerId: string | null,
  roomId: string,
  _kind: "movie" | "tv",
) {
  const [peer, setPeer] = useState<Mine | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ time: number; startAt: number } | null>(null);
  const [incomingSeek, setIncomingSeek] = useState<{ time: number; startAt?: number } | null>(null);
  const [incomingReaction, setIncomingReaction] = useState<{ id: number; emoji: string } | null>(null);
  const [drift, setDrift] = useState(0);
  const [myReady, setMyReadyState] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [peerSourceKind, setPeerSourceKind] = useState<SourceKind>("unknown");
  const [peerPreparing, setPeerPreparing] = useState<{ time: number; ts: number } | null>(null);

  const mineRef = useRef<Mine>(emptyMine());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAtRef = useRef<number>(0);
  const myReadyRef = useRef(false);
  const mySourceKindRef = useRef<SourceKind>("unknown");

  // Deterministic channel name from sorted user IDs + room, so only the couple share it.
  const channelName = useMemo(() => {
    if (!meId || !partnerId) return null;
    const pair = [meId, partnerId].sort().join("~");
    return `watchsync:${pair}:${roomId}`;
  }, [meId, partnerId, roomId]);

  useEffect(() => {
    if (!channelName || !meId) return;
    joinedAtRef.current = Date.now();
    const ch = supabase.channel(channelName, {
      config: { presence: { key: meId }, broadcast: { self: false, ack: false } },
    });
    channelRef.current = ch;

    const recomputeHost = () => {
      const state = ch.presenceState() as Record<string, PresenceMeta[]>;
      const entries: PresenceMeta[] = [];
      for (const k of Object.keys(state)) {
        const arr = state[k];
        if (arr?.[0]) entries.push(arr[0]);
      }
      entries.sort((a, b) => a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId));
      const host = entries[0]?.userId ?? null;
      setHostId(host);
      const others = entries.filter((e) => e.userId !== meId);
      setPartnerOnline(others.length > 0);
      setPeerReady(others.length > 0 && others.every((e) => !!e.ready));
      const firstOther = others[0];
      setPeerSourceKind(firstOther?.sourceKind ?? "unknown");
    };

    ch
      .on("presence", { event: "sync" }, recomputeHost)
      .on("presence", { event: "join" }, recomputeHost)
      .on("presence", { event: "leave" }, recomputeHost)
      .on("broadcast", { event: "state" }, ({ payload }) => {
        const p = payload as Mine & { from: string };
        if (p.from === meId) return;
        setPeer((prev) => {
          if (prev && prev.updatedAt >= p.updatedAt) return prev;
          return {
            currentTime: p.currentTime,
            duration: p.duration,
            playbackRate: p.playbackRate,
            updatedAt: p.updatedAt,
            event: p.event,
            sourceIdx: p.sourceIdx,
            season: p.season,
            episode: p.episode,
          };
        });
        const d = mineRef.current.currentTime - p.currentTime;
        setDrift(d);
      })
      .on("broadcast", { event: "seek" }, ({ payload }) => {
        const p = payload as { from: string; time: number; startAt?: number };
        if (p.from === meId) return;
        setIncomingSeek({ time: p.time, startAt: p.startAt });
      })
      .on("broadcast", { event: "countdown" }, ({ payload }) => {
        const p = payload as { from: string; time: number; startAt: number };
        if (p.from === meId) return;
        setCountdown({ time: p.time, startAt: p.startAt });
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const p = payload as { from: string; emoji: string };
        if (p.from === meId) return;
        setIncomingReaction({ id: Date.now() + Math.random(), emoji: p.emoji });
      })
      .on("broadcast", { event: "host" }, ({ payload }) => {
        const p = payload as { userId: string | null };
        if (p.userId) setHostId(p.userId);
      })
      .on("broadcast", { event: "prepare" }, ({ payload }) => {
        const p = payload as { from: string; time: number };
        if (p.from === meId) return;
        setPeerPreparing({ time: p.time ?? 0, ts: Date.now() });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ userId: meId, joinedAt: joinedAtRef.current, ready: myReadyRef.current, sourceKind: mySourceKindRef.current });
        }
      });

    return () => {
      try { ch.untrack(); } catch { /* ignore */ }
      supabase.removeChannel(ch);
      channelRef.current = null;
      setPeer(null);
      setPartnerOnline(false);
      setHostId(null);
      setPeerReady(false);
      setPeerSourceKind("unknown");
      setPeerPreparing(null);
      myReadyRef.current = false;
      mySourceKindRef.current = "unknown";
      setMyReadyState(false);
    };
  }, [channelName, meId]);

  const setReady = useCallback((ready: boolean) => {
    myReadyRef.current = ready;
    setMyReadyState(ready);
    const ch = channelRef.current;
    if (!ch || !meId) return;
    ch.track({ userId: meId, joinedAt: joinedAtRef.current, ready, sourceKind: mySourceKindRef.current }).catch(() => {});
  }, [meId]);

  const setSourceKind = useCallback((kind: SourceKind) => {
    mySourceKindRef.current = kind;
    const ch = channelRef.current;
    if (!ch || !meId) return;
    ch.track({ userId: meId, joinedAt: joinedAtRef.current, ready: myReadyRef.current, sourceKind: kind }).catch(() => {});
  }, [meId]);

  const sendPrepare = useCallback((time: number) => {
    const ch = channelRef.current;
    if (!ch || !meId) return;
    ch.send({ type: "broadcast", event: "prepare", payload: { from: meId, time } });
  }, [meId]);

  const clearPeerPreparing = useCallback(() => setPeerPreparing(null), []);

  const publish = useCallback((patch: Partial<Mine>) => {
    const now = Date.now();
    const next: Mine = { ...mineRef.current, ...patch, updatedAt: now };
    mineRef.current = next;
    const ch = channelRef.current;
    if (!ch || !meId) return;
    ch.send({ type: "broadcast", event: "state", payload: { ...next, from: meId } });
  }, [meId]);

  const sendSeek = useCallback((time: number, startAt?: number) => {
    const ch = channelRef.current;
    if (!ch || !meId) return;
    ch.send({ type: "broadcast", event: "seek", payload: { from: meId, time, startAt } });
  }, [meId]);

  const sendCountdown = useCallback((seconds: number, time?: number) => {
    const ch = channelRef.current;
    if (!ch || !meId) return;
    const startAt = Date.now() + seconds * 1000;
    const payload = { from: meId, time: typeof time === "number" ? time : mineRef.current.currentTime, startAt };
    ch.send({ type: "broadcast", event: "countdown", payload });
    setCountdown({ time: payload.time, startAt });
  }, [meId]);

  const sendReaction = useCallback((emoji: string) => {
    const ch = channelRef.current;
    if (!ch || !meId) return;
    ch.send({ type: "broadcast", event: "reaction", payload: { from: meId, emoji } });
  }, [meId]);

  const claimHost = useCallback(() => {
    if (!meId) return;
    setHostId(meId);
    const ch = channelRef.current;
    ch?.send({ type: "broadcast", event: "host", payload: { userId: meId } });
  }, [meId]);

  const releaseHost = useCallback(() => {
    setHostId(null);
    const ch = channelRef.current;
    ch?.send({ type: "broadcast", event: "host", payload: { userId: null } });
  }, []);

  const clearCountdown = useCallback(() => setCountdown(null), []);
  const clearIncomingSeek = useCallback(() => setIncomingSeek(null), []);
  const clearIncomingReaction = useCallback(() => setIncomingReaction(null), []);

  return {
    mine: mineRef.current,
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
    myReady,
    peerReady,
    setReady,
    sendPrepare,
    peerPreparing,
    clearPeerPreparing,
    peerSourceKind,
    setSourceKind,
  };
}
