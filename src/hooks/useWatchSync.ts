// Couple watch sync — realtime first, database-backed as the source of truth.
// Realtime broadcast keeps controls instant; the backend heartbeat keeps ready,
// host, and playback state from getting stuck when presence packets are missed.

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

type WatchSyncRow = {
  room_key: string;
  user_id: string;
  partner_id: string | null;
  joined_at: string;
  last_seen_at: string;
  ready: boolean;
  source_kind: SourceKind;
  current_seconds: number;
  duration_seconds: number;
  playback_rate: number;
  source_idx: number;
  season: number | null;
  episode: number | null;
  event: string | null;
  event_at: string | null;
  is_host: boolean;
};

const safeSeconds = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const safeRate = (value: unknown, fallback = 1) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

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
  const [presencePartnerOnline, setPresencePartnerOnline] = useState(false);
  const [backendPartnerOnline, setBackendPartnerOnline] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ time: number; startAt: number } | null>(null);
  const [incomingSeek, setIncomingSeek] = useState<{ time: number; startAt?: number } | null>(null);
  const [incomingReaction, setIncomingReaction] = useState<{ id: number; emoji: string } | null>(null);
  const [drift, setDrift] = useState(0);
  const [myReady, setMyReadyState] = useState(false);
  const [presencePeerReady, setPresencePeerReady] = useState(false);
  const [backendPeerReady, setBackendPeerReady] = useState(false);
  const [presencePeerSourceKind, setPresencePeerSourceKind] = useState<SourceKind>("unknown");
  const [backendPeerSourceKind, setBackendPeerSourceKind] = useState<SourceKind>("unknown");
  const [peerPreparing, setPeerPreparing] = useState<{ time: number; ts: number } | null>(null);

  const mineRef = useRef<Mine>(emptyMine());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAtRef = useRef<number>(0);
  const myReadyRef = useRef(false);
  const mySourceKindRef = useRef<SourceKind>("unknown");
  const lastBackendWriteRef = useRef(0);

  // Deterministic channel name from sorted user IDs + room, so only the couple share it.
  const channelName = useMemo(() => {
    if (!meId || !partnerId) return null;
    const pair = [meId, partnerId].sort().join("~");
    return `watchsync:${pair}:${roomId}`;
  }, [meId, partnerId, roomId]);

  const writeBackendState = useCallback((patch: Partial<WatchSyncRow> = {}) => {
    if (!channelName || !meId) return;
    const now = new Date().toISOString();
    const mine = mineRef.current;
    const row = {
      room_key: channelName,
      user_id: meId,
      partner_id: partnerId,
      joined_at: new Date(joinedAtRef.current || Date.now()).toISOString(),
      last_seen_at: now,
      ready: myReadyRef.current,
      source_kind: mySourceKindRef.current,
      current_seconds: safeSeconds(mine.currentTime),
      duration_seconds: safeSeconds(mine.duration),
      playback_rate: safeRate(mine.playbackRate),
      source_idx: Number.isFinite(Number(mine.sourceIdx)) ? Number(mine.sourceIdx) : 0,
      season: mine.season,
      episode: mine.episode,
      event: mine.event,
      event_at: mine.updatedAt ? new Date(mine.updatedAt).toISOString() : null,
      ...patch,
    };
    row.current_seconds = safeSeconds(row.current_seconds);
    row.duration_seconds = safeSeconds(row.duration_seconds);
    row.playback_rate = safeRate(row.playback_rate);
    row.source_idx = Number.isFinite(Number(row.source_idx)) ? Number(row.source_idx) : 0;
    (supabase as any)
      .from("watch_sync_members")
      .upsert(row, { onConflict: "room_key,user_id" })
      .then(({ error }: { error: Error | null }) => {
        if (error) console.warn("watch sync backend write failed", error.message);
      });
  }, [channelName, meId, partnerId]);

  const refreshBackendState = useCallback(async () => {
    if (!channelName || !meId) return;
    const cutoff = new Date(Date.now() - 45_000).toISOString();
    const { data, error } = await (supabase as any)
      .from("watch_sync_members")
      .select("room_key,user_id,partner_id,joined_at,last_seen_at,ready,source_kind,current_seconds,duration_seconds,playback_rate,source_idx,season,episode,event,event_at,is_host")
      .eq("room_key", channelName)
      .gte("last_seen_at", cutoff);

    if (error) {
      console.warn("watch sync backend read failed", error.message);
      return;
    }

    const rows = ((data ?? []) as WatchSyncRow[]).filter((row) => row.user_id);
    const others = rows.filter((row) => row.user_id !== meId);
    setBackendPartnerOnline(others.length > 0);
    setBackendPeerReady(others.some((row) => row.ready));

    const other = others
      .slice()
      .sort((a, b) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at))[0];
    setBackendPeerSourceKind(other?.source_kind ?? "unknown");

    const claimedHost = rows
      .filter((row) => row.is_host)
      .sort((a, b) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at))[0];
    const electedHost = rows
      .slice()
      .sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at) || a.user_id.localeCompare(b.user_id))[0];
    setHostId(claimedHost?.user_id ?? electedHost?.user_id ?? null);

    if (!other || !other.event_at) return;
    const updatedAt = Date.parse(other.event_at);
    if (!Number.isFinite(updatedAt)) return;
    setPeer((prev) => {
      if (prev && prev.updatedAt >= updatedAt) return prev;
      return {
        currentTime: safeSeconds(other.current_seconds),
        duration: safeSeconds(other.duration_seconds),
        playbackRate: safeRate(other.playback_rate),
        updatedAt,
        event: other.event,
        sourceIdx: Number.isFinite(Number(other.source_idx)) ? Number(other.source_idx) : 0,
        season: other.season,
        episode: other.episode,
      };
    });
    setDrift(safeSeconds(mineRef.current.currentTime) - safeSeconds(other.current_seconds));
  }, [channelName, meId]);

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
      setPresencePartnerOnline(others.length > 0);
      setPresencePeerReady(others.length > 0 && others.every((e) => !!e.ready));
      const firstOther = others[0];
      setPresencePeerSourceKind(firstOther?.sourceKind ?? "unknown");
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
            currentTime: safeSeconds(p.currentTime),
            duration: safeSeconds(p.duration),
            playbackRate: safeRate(p.playbackRate),
            updatedAt: p.updatedAt,
            event: p.event,
            sourceIdx: Number.isFinite(Number(p.sourceIdx)) ? Number(p.sourceIdx) : 0,
            season: p.season,
            episode: p.episode,
          };
        });
        const d = safeSeconds(mineRef.current.currentTime) - safeSeconds(p.currentTime);
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
          writeBackendState({ is_host: false });
          refreshBackendState();
        }
      });

    const heartbeat = window.setInterval(() => {
      writeBackendState();
      refreshBackendState();
    }, 1500);

    return () => {
      window.clearInterval(heartbeat);
      writeBackendState({ ready: false, is_host: false, last_seen_at: new Date(0).toISOString() });
      try { ch.untrack(); } catch { /* ignore */ }
      supabase.removeChannel(ch);
      channelRef.current = null;
      setPeer(null);
      setPresencePartnerOnline(false);
      setBackendPartnerOnline(false);
      setHostId(null);
      setPresencePeerReady(false);
      setBackendPeerReady(false);
      setPresencePeerSourceKind("unknown");
      setBackendPeerSourceKind("unknown");
      setPeerPreparing(null);
      myReadyRef.current = false;
      mySourceKindRef.current = "unknown";
      setMyReadyState(false);
    };
  }, [channelName, meId, refreshBackendState, writeBackendState]);

  const setReady = useCallback((ready: boolean) => {
    myReadyRef.current = ready;
    setMyReadyState(ready);
    const ch = channelRef.current;
    ch?.track({ userId: meId, joinedAt: joinedAtRef.current, ready, sourceKind: mySourceKindRef.current }).catch(() => {});
    writeBackendState({ ready });
  }, [meId, writeBackendState]);

  const setSourceKind = useCallback((kind: SourceKind) => {
    mySourceKindRef.current = kind;
    const ch = channelRef.current;
    ch?.track({ userId: meId, joinedAt: joinedAtRef.current, ready: myReadyRef.current, sourceKind: kind }).catch(() => {});
    writeBackendState({ source_kind: kind });
  }, [meId, writeBackendState]);

  const sendPrepare = useCallback((time: number) => {
    const ch = channelRef.current;
    if (!ch || !meId) return;
    ch.send({ type: "broadcast", event: "prepare", payload: { from: meId, time } });
  }, [meId]);

  const clearPeerPreparing = useCallback(() => setPeerPreparing(null), []);

  const publish = useCallback((patch: Partial<Mine>) => {
    const now = Date.now();
    const merged = { ...mineRef.current, ...patch };
    const next: Mine = {
      ...merged,
      currentTime: safeSeconds(merged.currentTime),
      duration: safeSeconds(merged.duration),
      playbackRate: safeRate(merged.playbackRate),
      sourceIdx: Number.isFinite(Number(merged.sourceIdx)) ? Number(merged.sourceIdx) : 0,
      updatedAt: now,
    };
    mineRef.current = next;
    const ch = channelRef.current;
    ch?.send({ type: "broadcast", event: "state", payload: { ...next, from: meId } });
    const discrete = patch.event === "play" || patch.event === "pause" || patch.event === "seeked" || patch.event === "ended" || patch.event === "ratechange";
    if (discrete || now - lastBackendWriteRef.current > 1000) {
      lastBackendWriteRef.current = now;
      writeBackendState({
        current_seconds: next.currentTime,
        duration_seconds: next.duration,
        playback_rate: next.playbackRate,
        source_idx: next.sourceIdx,
        season: next.season,
        episode: next.episode,
        event: next.event,
        event_at: new Date(now).toISOString(),
      });
    }
  }, [meId, writeBackendState]);

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
    writeBackendState({ is_host: true });
  }, [meId, writeBackendState]);

  const releaseHost = useCallback(() => {
    setHostId(null);
    const ch = channelRef.current;
    ch?.send({ type: "broadcast", event: "host", payload: { userId: null } });
    writeBackendState({ is_host: false });
  }, [writeBackendState]);

  const clearCountdown = useCallback(() => setCountdown(null), []);
  const clearIncomingSeek = useCallback(() => setIncomingSeek(null), []);
  const clearIncomingReaction = useCallback(() => setIncomingReaction(null), []);

  const partnerOnline = presencePartnerOnline || backendPartnerOnline;
  const peerReady = presencePeerReady || backendPeerReady;
  const peerSourceKind = backendPeerSourceKind !== "unknown" ? backendPeerSourceKind : presencePeerSourceKind;

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
