import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 1:1 screen-share over WebRTC, signaled via Supabase Realtime.
 *
 * The "sharer" calls startShare(): prompts getDisplayMedia (screen/tab + audio),
 * offers to the peer. The other side auto-answers when it receives the offer
 * and exposes the incoming stream as `remoteStream`.
 *
 * Room is scoped to a movie/pair so two users always land on the same channel.
 */

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

type SignalKind = "offer" | "answer" | "ice" | "share-start" | "share-stop";

export type ScreenShareState = {
  /** Local stream while WE are sharing. */
  localStream: MediaStream | null;
  /** Incoming stream when the OTHER side is sharing. */
  remoteStream: MediaStream | null;
  /** True while we're the active sharer. */
  isSharing: boolean;
  /** ID of the peer currently sharing (either me or partner), or null. */
  sharerId: string | null;
  /** Connection status of the RTC pipe. */
  status: "idle" | "connecting" | "connected" | "ended" | "error";
  error: string | null;
};

export function useScreenShare(meId: string | null, partnerId: string | null, roomId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharerId, setSharerId] = useState<string | null>(null);
  const [status, setStatus] = useState<ScreenShareState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const isSharerRef = useRef(false);

  const teardownPc = useCallback(() => {
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    pendingIceRef.current = [];
    remoteSetRef.current = false;
    setRemoteStream(null);
  }, []);

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    isSharerRef.current = false;
    setIsSharing(false);
  }, []);

  const buildPc = useCallback((sendSignal: (kind: SignalKind, payload: unknown) => Promise<void>) => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 4,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    pcRef.current = pc;
    pc.onicecandidate = (ev) => { if (ev.candidate) void sendSignal("ice", ev.candidate.toJSON()); };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setStatus("connected");
      else if (s === "failed") setStatus("error");
      else if (s === "closed") setStatus("ended");
    };
    const remote = new MediaStream();
    pc.ontrack = (ev) => {
      ev.streams[0].getTracks().forEach((t) => {
        if (!remote.getTracks().find((x) => x.id === t.id)) remote.addTrack(t);
      });
      setRemoteStream(remote);
    };
    return pc;
  }, []);

  useEffect(() => {
    if (!meId || !partnerId || !roomId) return;
    const topic = `screen-share:${roomId}:${[meId, partnerId].sort().join(":")}`;
    const ch = supabase.channel(topic, { config: { broadcast: { self: false, ack: false } } });
    chRef.current = ch;

    const sendSignal = async (kind: SignalKind, payload: unknown) => {
      await ch.send({ type: "broadcast", event: kind, payload: { ...(payload as object), from: meId } });
    };

    async function flushIce() {
      const pc = pcRef.current;
      if (!pc) return;
      for (const c of pendingIceRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn("ICE add failed", e); }
      }
      pendingIceRef.current = [];
    }

    ch.on("broadcast", { event: "share-start" }, ({ payload }) => {
      const p = payload as { from: string };
      if (p.from === meId) return;
      // Partner started sharing — get ready to receive.
      setSharerId(p.from);
      setStatus("connecting");
      teardownPc();
      buildPc(sendSignal);
    });

    ch.on("broadcast", { event: "share-stop" }, ({ payload }) => {
      const p = payload as { from: string };
      if (p.from === meId) return;
      setSharerId(null);
      setStatus("ended");
      teardownPc();
    });

    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      const p = payload as RTCSessionDescriptionInit & { from: string };
      if (p.from === meId) return;
      // We're the viewer.
      let pc = pcRef.current;
      if (!pc) pc = buildPc(sendSignal);
      setSharerId(p.from);
      await pc.setRemoteDescription(new RTCSessionDescription({ type: p.type, sdp: p.sdp }));
      remoteSetRef.current = true;
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal("answer", answer);
    });

    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      const p = payload as RTCSessionDescriptionInit & { from: string };
      if (p.from === meId) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: p.type, sdp: p.sdp }));
        remoteSetRef.current = true;
        await flushIce();
      }
    });

    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      const p = payload as RTCIceCandidateInit & { from: string };
      if (p.from === meId) return;
      const pc = pcRef.current;
      if (!pc || !remoteSetRef.current) { pendingIceRef.current.push(p); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(p)); } catch (e) { console.warn(e); }
    });

    ch.subscribe();

    return () => {
      try { supabase.removeChannel(ch); } catch { /* ignore */ }
      chRef.current = null;
      teardownPc();
      stopLocal();
      setSharerId(null);
      setStatus("idle");
    };
  }, [meId, partnerId, roomId, buildPc, teardownPc, stopLocal]);

  const startShare = useCallback(async () => {
    if (!meId || !partnerId) return;
    const ch = chRef.current;
    if (!ch) return;
    try {
      setError(null);
      setStatus("connecting");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true,
      } as MediaStreamConstraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      isSharerRef.current = true;
      setIsSharing(true);
      setSharerId(meId);

      // If a viewer PC exists from a previous session, tear it down first.
      teardownPc();
      const sendSignal = async (kind: SignalKind, payload: unknown) => {
        await ch.send({ type: "broadcast", event: kind, payload: { ...(payload as object), from: meId } });
      };
      const pc = buildPc(sendSignal);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Prefer higher video bitrate — a 720p movie needs headroom.
      try {
        const vs = pc.getSenders().find((s) => s.track?.kind === "video");
        if (vs) {
          const params = vs.getParameters();
          params.encodings = params.encodings?.length ? params.encodings : [{}];
          params.encodings[0].maxBitrate = 2_500_000;
          await vs.setParameters(params).catch(() => {});
        }
      } catch { /* non-fatal */ }

      await sendSignal("share-start", {});
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal("offer", offer);

      // Auto-stop when the user ends the OS share prompt.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        void stopShare();
      });
    } catch (e: any) {
      console.error("Screen share failed", e);
      setError(e?.message ?? "Screen share failed");
      setStatus("error");
      stopLocal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, partnerId, buildPc, teardownPc, stopLocal]);

  const stopShare = useCallback(async () => {
    const ch = chRef.current;
    if (ch && meId) {
      try { await ch.send({ type: "broadcast", event: "share-stop", payload: { from: meId } }); } catch { /* ignore */ }
    }
    stopLocal();
    teardownPc();
    setStatus("ended");
    setSharerId(null);
  }, [meId, stopLocal, teardownPc]);

  return {
    localStream,
    remoteStream,
    isSharing,
    sharerId,
    status,
    error,
    startShare,
    stopShare,
  };
}
