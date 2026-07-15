import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import { endCall, leaveCall, timeoutCall, type CallRow } from "@/lib/callActions";

// STUN + free public TURN. TURN is required for symmetric NAT / cellular.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
};
type FacingMode = "user" | "environment";
function videoConstraints(facing: FacingMode): MediaTrackConstraints {
  return {
    width: { ideal: 960, max: 1280 },
    height: { ideal: 540, max: 720 },
    frameRate: { ideal: 24, max: 30 },
    facingMode: { ideal: facing },
  };
}

export type Participant = {
  user_id: string;
  device_id: string | null;
  state: "ringing" | "joined" | "declined" | "left" | "missed";
  joined_at: string | null;
  left_at: string | null;
};

export type RemoteFeed = {
  key: string; // user_id:device_id
  user_id: string;
  device_id: string;
  stream: MediaStream;
  rev: number;
};

type SignalRow = {
  id: string;
  call_id: string;
  from_user: string;
  from_device: string;
  to_user: string;
  to_device: string;
  kind: "offer" | "answer" | "ice" | "bye";
  payload: unknown;
  created_at: string;
};

// Deterministic tie-breaker: the "smaller" (user_id, device_id) initiates the offer.
function amIOfferer(myUser: string, myDevice: string, theirUser: string, theirDevice: string) {
  const me = `${myUser}:${myDevice}`;
  const them = `${theirUser}:${theirDevice}`;
  return me < them;
}

export function useCallMesh(opts: {
  callId: string | null;
  meId: string | null;
  kind: "voice" | "video";
}) {
  const { callId, meId, kind } = opts;
  const deviceId = getDeviceId();

  const [call, setCall] = useState<CallRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteFeeds, setRemoteFeeds] = useState<Record<string, RemoteFeed>>({});
  const [status, setStatus] = useState<"connecting" | "ringing" | "active" | "ended" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>("user");

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const seenSignalRef = useRef<Set<string>>(new Set());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const revRef = useRef(0);
  const teardownRef = useRef(false);

  // ---------- Media capture ----------
  useEffect(() => {
    if (!callId || !meId) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
          video: kind === "video" ? videoConstraints("user") : false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
        // Add tracks to any PCs that already exist
        for (const pc of pcsRef.current.values()) {
          stream.getTracks().forEach((t) => {
            const existing = pc.getSenders().find((s) => s.track?.kind === t.kind);
            if (existing) existing.replaceTrack(t).catch(() => {});
            else pc.addTrack(t, stream);
          });
        }
      } catch (e) {
        setError((e as Error).message ?? "Could not access mic/camera");
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [callId, meId, kind]);

  // ---------- Signaling helpers ----------
  const sendSignal = useCallback(
    async (toUser: string, toDevice: string, sigKind: SignalRow["kind"], payload: unknown) => {
      if (!callId || !meId) return;
      await supabase.from("call_signals").insert({
        call_id: callId,
        from_user: meId,
        from_device: deviceId,
        to_user: toUser,
        to_device: toDevice,
        kind: sigKind,
        payload: payload as never,
      });
    },
    [callId, meId, deviceId],
  );

  const bumpRev = () => {
    revRef.current += 1;
    const r = revRef.current;
    setRemoteFeeds((prev) => {
      const next: Record<string, RemoteFeed> = {};
      for (const [k, feed] of Object.entries(prev)) next[k] = { ...feed, rev: r };
      for (const [k, stream] of remoteStreamsRef.current.entries()) {
        if (!next[k]) {
          const [user_id, device_id] = k.split(":");
          next[k] = { key: k, user_id, device_id, stream, rev: r };
        }
      }
      return next;
    });
  };

  // ---------- PeerConnection factory ----------
  const ensurePC = useCallback(
    (theirUser: string, theirDevice: string): RTCPeerConnection => {
      const key = `${theirUser}:${theirDevice}`;
      const existing = pcsRef.current.get(key);
      if (existing) return existing;

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 4,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      pcsRef.current.set(key, pc);
      pendingIceRef.current.set(key, []);

      // Prepare remote stream container
      const remote = new MediaStream();
      remoteStreamsRef.current.set(key, remote);

      pc.ontrack = (ev) => {
        const src = ev.streams[0];
        const tracks = src ? src.getTracks() : [ev.track];
        let added = false;
        for (const t of tracks) {
          if (!remote.getTracks().find((x) => x.id === t.id)) {
            remote.addTrack(t);
            added = true;
          }
        }
        try {
          const r = ev.receiver as RTCRtpReceiver & { playoutDelayHint?: number };
          if (typeof r.playoutDelayHint !== "undefined") r.playoutDelayHint = 0;
        } catch { /* ignore */ }
        if (added) bumpRev();
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) void sendSignal(theirUser, theirDevice, "ice", ev.candidate.toJSON());
      };

      pc.oniceconnectionstatechange = async () => {
        const s = pc.iceConnectionState;
        if (s === "failed") {
          try {
            if (amIOfferer(meId ?? "", deviceId, theirUser, theirDevice)) {
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              await sendSignal(theirUser, theirDevice, "offer", offer);
            }
          } catch (e) { console.warn("ICE restart failed", e); }
        }
      };

      // Add local tracks if we already have them
      const localStream_ = localStreamRef.current;
      if (localStream_) {
        localStream_.getTracks().forEach((t) => pc.addTrack(t, localStream_));
      }
      return pc;
    },
    [deviceId, meId, sendSignal],
  );

  const destroyPC = useCallback((key: string, notify: boolean) => {
    const pc = pcsRef.current.get(key);
    if (!pc) return;
    if (notify) {
      const [u, d] = key.split(":");
      sendSignal(u, d, "bye", {}).catch(() => {});
    }
    try { pc.close(); } catch { /* ignore */ }
    pcsRef.current.delete(key);
    pendingIceRef.current.delete(key);
    remoteStreamsRef.current.delete(key);
    setRemoteFeeds((prev) => {
      const { [key]: _gone, ...rest } = prev;
      return rest;
    });
  }, [sendSignal]);

  // ---------- Handle a signal ----------
  const handleSignal = useCallback(
    async (sig: SignalRow) => {
      if (seenSignalRef.current.has(sig.id)) return;
      seenSignalRef.current.add(sig.id);
      if (!meId || sig.to_user !== meId || sig.to_device !== deviceId) return;
      const key = `${sig.from_user}:${sig.from_device}`;

      if (sig.kind === "bye") {
        destroyPC(key, false);
        return;
      }

      const pc = ensurePC(sig.from_user, sig.from_device);

      if (sig.kind === "offer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
          const buf = pendingIceRef.current.get(key) ?? [];
          for (const c of buf) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
          pendingIceRef.current.set(key, []);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(sig.from_user, sig.from_device, "answer", answer);
        } catch (e) { console.warn("offer handling failed", e); }
      } else if (sig.kind === "answer") {
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
            const buf = pendingIceRef.current.get(key) ?? [];
            for (const c of buf) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
            pendingIceRef.current.set(key, []);
          }
        } catch (e) { console.warn("answer handling failed", e); }
      } else if (sig.kind === "ice") {
        const cand = sig.payload as RTCIceCandidateInit;
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) { console.warn(e); }
        } else {
          const buf = pendingIceRef.current.get(key) ?? [];
          buf.push(cand);
          pendingIceRef.current.set(key, buf);
        }
      }
    },
    [deviceId, destroyPC, ensurePC, meId, sendSignal],
  );

  // ---------- Load initial state + subscribe realtime ----------
  useEffect(() => {
    if (!callId || !meId) return;
    let cancelled = false;
    teardownRef.current = false;

    (async () => {
      // 1. Load call + participants
      const [callRes, partsRes] = await Promise.all([
        supabase.from("calls").select("*").eq("id", callId).maybeSingle(),
        supabase.from("call_participants").select("user_id, device_id, state, joined_at, left_at").eq("call_id", callId),
      ]);
      if (cancelled) return;
      if (callRes.data) setCall(callRes.data as unknown as CallRow);
      if (partsRes.data) setParticipants(partsRes.data as unknown as Participant[]);

      // 2. Backfill any signals addressed to me that arrived before I subscribed
      const { data: pastSignals } = await supabase
        .from("call_signals")
        .select("*")
        .eq("call_id", callId)
        .eq("to_user", meId)
        .eq("to_device", deviceId)
        .order("created_at", { ascending: true });
      for (const s of pastSignals ?? []) await handleSignal(s as unknown as SignalRow);
    })();

    // Realtime: call + participants + signals for this call
    const ch = supabase
      .channel(`call:${callId}:${deviceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        (p) => setCall(p.new as unknown as CallRow),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_participants", filter: `call_id=eq.${callId}` },
        (p) => {
          const row = (p.new ?? p.old) as unknown as Participant & { call_id: string };
          if (!row) return;
          setParticipants((prev) => {
            const others = prev.filter((x) => x.user_id !== row.user_id);
            if (p.eventType === "DELETE") return others;
            return [...others, row];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` },
        (p) => { void handleSignal(p.new as unknown as SignalRow); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [callId, meId, deviceId, handleSignal]);

  // ---------- Ringing timeout ----------
  useEffect(() => {
    if (!call || call.status !== "ringing" || call.initiator_id !== meId) return;
    const t = window.setTimeout(() => { void timeoutCall(call.id); }, 50_000);
    return () => window.clearTimeout(t);
  }, [call, meId]);

  // ---------- Track call status → hook status ----------
  useEffect(() => {
    if (!call) return;
    if (call.status === "ended" || call.status === "missed") setStatus("ended");
    else if (call.status === "active") setStatus("active");
    else if (call.status === "ringing") setStatus("ringing");
  }, [call]);

  // ---------- Manage per-participant PCs (open when joined, close when left) ----------
  useEffect(() => {
    if (!meId) return;
    const joinedOthers = participants.filter(
      (p) => p.user_id !== meId && p.state === "joined" && p.device_id,
    );
    // Open missing PCs, offer if I'm the "smaller" side
    for (const p of joinedOthers) {
      const key = `${p.user_id}:${p.device_id}`;
      if (pcsRef.current.has(key)) continue;
      const pc = ensurePC(p.user_id, p.device_id!);
      if (amIOfferer(meId, deviceId, p.user_id, p.device_id!)) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendSignal(p.user_id, p.device_id!, "offer", offer);
          } catch (e) { console.warn("createOffer failed", e); }
        })();
      }
    }
    // Close PCs for participants no longer joined
    const stillJoined = new Set(joinedOthers.map((p) => `${p.user_id}:${p.device_id}`));
    for (const key of Array.from(pcsRef.current.keys())) {
      if (!stillJoined.has(key)) destroyPC(key, false);
    }
  }, [participants, meId, deviceId, ensurePC, destroyPC, sendSignal]);

  // ---------- Actions ----------
  const hangup = useCallback(async () => {
    teardownRef.current = true;
    // Notify each remote PC first (best-effort)
    for (const key of pcsRef.current.keys()) destroyPC(key, true);
    try {
      if (call && call.status === "ringing" && call.initiator_id === meId) {
        await endCall(call.id, "hangup");
      } else if (callId) {
        await leaveCall(callId);
      }
    } catch (e) { console.warn("hangup rpc failed", e); }
    setStatus("ended");
  }, [call, callId, meId, destroyPC]);

  const toggleAudio = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
  }, []);

  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
  }, []);

  const flipCamera = useCallback(async () => {
    if (kind !== "video") return;
    const current = localStreamRef.current;
    if (!current) return;
    const next: FacingMode = facing === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(next), audio: false });
      const newTrack = newStream.getVideoTracks()[0];
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(newTrack);
      }
      current.getVideoTracks().forEach((t) => { t.stop(); current.removeTrack(t); });
      current.addTrack(newTrack);
      setFacing(next);
      setLocalStream(new MediaStream(current.getTracks()));
    } catch (e) { console.warn("flipCamera failed", e); }
  }, [facing, kind]);

  // ---------- Cleanup on unmount ----------
  useEffect(() => {
    return () => {
      teardownRef.current = true;
      for (const pc of pcsRef.current.values()) { try { pc.close(); } catch { /* ignore */ } }
      pcsRef.current.clear();
      pendingIceRef.current.clear();
      remoteStreamsRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, []);

  const remoteFeedsList = Object.values(remoteFeeds);
  const answered = !!call?.answered_at;

  return {
    call,
    participants,
    localStream,
    remoteFeeds: remoteFeedsList,
    status,
    answered,
    error,
    hangup,
    toggleAudio,
    toggleVideo,
    flipCamera,
    facing,
  };
}
