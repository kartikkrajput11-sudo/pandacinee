import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  createLocalVideoTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Participant,
} from "livekit-client";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import { endCall, leaveCall, timeoutCall, type CallRow } from "@/lib/callActions";
import { getLiveKitToken } from "@/lib/livekit.functions";

export type RemoteFeed = {
  key: string;        // participant identity = `${user_id}:${device_id}`
  user_id: string;
  device_id: string;
  stream: MediaStream;
  rev: number;
  isScreenShare: boolean;
};

type FacingMode = "user" | "environment";

function identityParts(identity: string): { user_id: string; device_id: string } {
  const idx = identity.indexOf(":");
  if (idx < 0) return { user_id: identity, device_id: "" };
  return { user_id: identity.slice(0, idx), device_id: identity.slice(idx + 1) };
}

export function useLiveKitCall(opts: {
  callId: string | null;
  meId: string | null;
  kind: "voice" | "video";
}) {
  const { callId, meId, kind } = opts;
  const deviceId = getDeviceId();
  const fetchToken = useServerFn(getLiveKitToken);

  const [call, setCall] = useState<CallRow | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteFeeds, setRemoteFeeds] = useState<Record<string, RemoteFeed>>({});
  const [status, setStatus] = useState<"connecting" | "ringing" | "active" | "ended" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>("user");
  const [screenSharing, setScreenSharing] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const revRef = useRef(0);
  const teardownRef = useRef(false);

  // Track calls table status for ringing/timeout/history
  useEffect(() => {
    if (!callId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("calls").select("*").eq("id", callId).maybeSingle();
      if (!cancelled && data) setCall(data as unknown as CallRow);
    })();
    const ch = supabase
      .channel(`call-status:${callId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        (p) => setCall(p.new as unknown as CallRow),
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [callId]);

  useEffect(() => {
    if (!call) return;
    if (call.status === "ended" || call.status === "missed") setStatus("ended");
    else if (call.status === "active") setStatus("active");
    else if (call.status === "ringing") setStatus("ringing");
  }, [call]);

  // Auto-timeout for caller if nobody picks up
  useEffect(() => {
    if (!call || call.status !== "ringing" || call.initiator_id !== meId) return;
    const t = window.setTimeout(() => { void timeoutCall(call.id); }, 50_000);
    return () => window.clearTimeout(t);
  }, [call, meId]);

  const bumpRev = () => { revRef.current += 1; };

  const rebuildFeedsFor = useCallback((p: RemoteParticipant) => {
    const { user_id, device_id } = identityParts(p.identity);
    const cameraStream = new MediaStream();
    const screenStream = new MediaStream();
    let hasCamera = false;
    let hasScreen = false;

    p.trackPublications.forEach((pub) => {
      const t = pub.track;
      if (!t || !t.mediaStreamTrack || !pub.isSubscribed) return;
      const isScreen = pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio;
      if (isScreen) { screenStream.addTrack(t.mediaStreamTrack); hasScreen = true; }
      else { cameraStream.addTrack(t.mediaStreamTrack); hasCamera = true; }
    });

    bumpRev();
    setRemoteFeeds((prev) => {
      const next = { ...prev };
      const camKey = `${p.identity}:cam`;
      const screenKey = `${p.identity}:screen`;
      if (hasCamera) next[camKey] = { key: camKey, user_id, device_id, stream: cameraStream, rev: revRef.current, isScreenShare: false };
      else delete next[camKey];
      if (hasScreen) next[screenKey] = { key: screenKey, user_id, device_id, stream: screenStream, rev: revRef.current, isScreenShare: true };
      else delete next[screenKey];
      return next;
    });
  }, []);

  const removeParticipant = useCallback((identity: string) => {
    setRemoteFeeds((prev) => {
      const next = { ...prev };
      delete next[`${identity}:cam`];
      delete next[`${identity}:screen`];
      return next;
    });
  }, []);

  // Connect to LiveKit room
  useEffect(() => {
    if (!callId || !meId) return;
    let cancelled = false;
    teardownRef.current = false;

    (async () => {
      try {
        const { token, wsUrl } = await fetchToken({ data: { callId, deviceId } });
        if (cancelled) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: { simulcast: true, videoSimulcastLayers: [] },
        });
        roomRef.current = room;

        const onSubOrUnsub = (_track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => rebuildFeedsFor(p);
        room
          .on(RoomEvent.TrackSubscribed, onSubOrUnsub)
          .on(RoomEvent.TrackUnsubscribed, onSubOrUnsub)
          .on(RoomEvent.TrackMuted, (_pub, p) => { if (p !== room.localParticipant) rebuildFeedsFor(p as RemoteParticipant); })
          .on(RoomEvent.TrackUnmuted, (_pub, p) => { if (p !== room.localParticipant) rebuildFeedsFor(p as RemoteParticipant); })
          .on(RoomEvent.ParticipantConnected, (p) => rebuildFeedsFor(p))
          .on(RoomEvent.ParticipantDisconnected, (p) => removeParticipant(p.identity))
          .on(RoomEvent.Disconnected, () => {
            if (!teardownRef.current) setStatus("ended");
          });

        await room.connect(wsUrl, token);
        if (cancelled) { void room.disconnect(); return; }

        // Publish mic (+ camera if video call)
        await room.localParticipant.setMicrophoneEnabled(true);
        if (kind === "video") {
          await room.localParticipant.setCameraEnabled(true, { facingMode: "user" });
        }

        // Assemble local preview stream from published tracks
        const local = new MediaStream();
        room.localParticipant.trackPublications.forEach((pub) => {
          const mst = pub.track?.mediaStreamTrack;
          if (mst) local.addTrack(mst);
        });
        localStreamRef.current = local;
        setLocalStream(local);

        // Rebuild feeds for anyone already in the room
        room.remoteParticipants.forEach((p) => rebuildFeedsFor(p));
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message ?? "Could not connect");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      const room = roomRef.current;
      if (room) { void room.disconnect(); roomRef.current = null; }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [callId, meId, deviceId, kind, fetchToken, rebuildFeedsFor, removeParticipant]);

  // ---------- Actions ----------
  const hangup = useCallback(async () => {
    teardownRef.current = true;
    const room = roomRef.current;
    if (room) { try { await room.disconnect(); } catch { /* ignore */ } roomRef.current = null; }
    try {
      if (call && call.scope === "direct") {
        // 1:1 call — whoever hangs up ends the call for both sides.
        await endCall(call.id, "hangup");
      } else if (call && call.status === "ringing" && call.initiator_id === meId) {
        await endCall(call.id, "hangup");
      } else if (callId) {
        await leaveCall(callId);
      }
    } catch (e) { console.warn("hangup rpc failed", e); }
    setStatus("ended");
  }, [call, callId, meId]);

  const toggleAudio = useCallback(() => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    void lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    void lp.setCameraEnabled(!lp.isCameraEnabled).then(() => {
      const local = new MediaStream();
      lp.trackPublications.forEach((pub) => { const mst = pub.track?.mediaStreamTrack; if (mst) local.addTrack(mst); });
      localStreamRef.current = local;
      setLocalStream(local);
    });
  }, []);

  const flipCamera = useCallback(async () => {
    if (kind !== "video") return;
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    const next: FacingMode = facing === "user" ? "environment" : "user";
    try {
      const newTrack = await createLocalVideoTrack({ facingMode: next });
      const camPub = Array.from(lp.trackPublications.values()).find(
        (p) => p.source === Track.Source.Camera,
      );
      if (camPub?.track instanceof LocalVideoTrack) {
        await camPub.track.replaceTrack(newTrack.mediaStreamTrack);
      } else {
        await lp.publishTrack(newTrack, { source: Track.Source.Camera });
      }
      setFacing(next);
      const local = new MediaStream();
      lp.trackPublications.forEach((pub) => { const mst = pub.track?.mediaStreamTrack; if (mst) local.addTrack(mst); });
      localStreamRef.current = local;
      setLocalStream(local);
    } catch (e) { console.warn("flipCamera failed", e); }
  }, [facing, kind]);

  const toggleScreenShare = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    try {
      const enabled = !screenSharing;
      await lp.setScreenShareEnabled(enabled, { audio: true });
      setScreenSharing(enabled);
    } catch (e) {
      console.warn("screen share failed", e);
      setScreenSharing(false);
    }
  }, [screenSharing]);

  const remoteFeedsList = Object.values(remoteFeeds);
  const answered = !!call?.answered_at;

  return {
    call,
    localStream,
    remoteFeeds: remoteFeedsList,
    status,
    answered,
    error,
    hangup,
    toggleAudio,
    toggleVideo,
    flipCamera,
    toggleScreenShare,
    screenSharing,
    facing,
  };
}

// Backwards compatible re-export so existing imports keep working.
export { useLiveKitCall as useCallMesh };
