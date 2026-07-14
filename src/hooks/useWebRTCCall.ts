import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// STUN + public TURN relays. TURN is critical for symmetric NAT / mobile
// carriers where STUN-only fails. openrelay.metered.ca is a free public TURN.
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

type Mode = "video" | "audio";
type FacingMode = "user" | "environment";
type SignalKind = "offer" | "answer" | "ice" | "hangup";

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

// High-quality audio: echo cancel, noise suppress, auto gain — the trio that
// makes voice actually intelligible. Stereo + higher sample rate where the
// browser allows it.
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
};

function videoConstraints(facing: FacingMode): MediaTrackConstraints {
  return {
    width: { ideal: 960, max: 1280 },
    height: { ideal: 540, max: 720 },
    frameRate: { ideal: 24, max: 30 },
    facingMode: { ideal: facing },
  };
}


export function useWebRTCCall(peerId: string | null, mode: Mode = "video", isCaller = true) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteRev, setRemoteRev] = useState(0);
  const [status, setStatus] = useState<"idle" | "connecting" | "ringing" | "connected" | "ended" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>("user");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const meRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const offerSentRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sendSignalRef = useRef<((kind: SignalKind, payload: unknown) => Promise<void>) | null>(null);
  const isCallerRef = useRef(isCaller);
  isCallerRef.current = isCaller;

  useEffect(() => {
    if (!peerId) return;
    let cancelled = false;

    (async () => {
      try {
        setStatus("connecting");
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Not signed in");
        meRef.current = u.user.id;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: mode === "video" ? videoConstraints("user") : false,
          audio: AUDIO_CONSTRAINTS,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = new RTCPeerConnection({
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 4,
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // Prefer higher-quality audio bitrate on the sender
        try {
          const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (audioSender) {
            const params = audioSender.getParameters();
            params.encodings = params.encodings?.length ? params.encodings : [{}];
            params.encodings[0].maxBitrate = 32_000; // 32 kbps mono Opus — clear voice, low jitter
            params.encodings[0].priority = "high";
            params.encodings[0].networkPriority = "high";
            await audioSender.setParameters(params).catch(() => {});
          }
          if (mode === "video") {
            const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (videoSender) {
              const params = videoSender.getParameters();
              params.encodings = params.encodings?.length ? params.encodings : [{}];
              params.encodings[0].maxBitrate = 700_000; // 700 kbps — smooth on mobile networks
              params.encodings[0].maxFramerate = 24;
              params.degradationPreference = "maintain-framerate";
              await videoSender.setParameters(params).catch(() => {});
            }
          }
        } catch { /* non-fatal */ }


        const remote = new MediaStream();
        setRemoteStream(remote);
        pc.ontrack = (ev) => {
          let added = false;
          const src = ev.streams[0];
          const tracks = src ? src.getTracks() : [ev.track];
          tracks.forEach((t) => {
            if (!remote.getTracks().find((x) => x.id === t.id)) {
              remote.addTrack(t);
              added = true;
            }
          });
          // Ask the browser for the lowest safe playout delay — smoother
          // real-time audio/video with less lip-sync buffering.
          try {
            const r = ev.receiver as RTCRtpReceiver & { playoutDelayHint?: number };
            if (typeof r.playoutDelayHint !== "undefined") r.playoutDelayHint = 0;
          } catch { /* ignore */ }
          if (added) setRemoteRev((n) => n + 1);
        };


        const ch = supabase.channel(`call-room:${pairKey(meRef.current, peerId)}`, {
          config: { broadcast: { self: false, ack: false }, presence: { key: meRef.current } },
        });
        channelRef.current = ch;

        const sendSignal = async (kind: SignalKind, payload: unknown) => {
          await ch.send({ type: "broadcast", event: kind, payload });
        };
        sendSignalRef.current = sendSignal;

        pc.onicecandidate = (ev) => {
          if (ev.candidate) void sendSignal("ice", ev.candidate.toJSON());
        };
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === "connected") setStatus("connected");
          else if (s === "closed") setStatus("ended");
        };
        pc.oniceconnectionstatechange = async () => {
          const s = pc.iceConnectionState;
          if (s === "failed") {
            // Try an ICE restart before giving up — only the caller re-offers
            if (isCallerRef.current) {
              try {
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                await sendSignal("offer", offer);
              } catch (e) {
                console.warn("ICE restart failed", e);
                setStatus("ended");
              }
            }
          } else if (s === "disconnected") {
            // Transient — WebRTC often recovers on its own within seconds
          }
        };

        async function flushIce() {
          for (const c of pendingIceRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn("ICE add failed", e); }
          }
          pendingIceRef.current = [];
        }

        async function makeOffer() {
          if (offerSentRef.current) return;
          offerSentRef.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal("offer", offer);
        }

        ch.on("broadcast", { event: "offer" }, async (e) => {
          const offer = e.payload as RTCSessionDescriptionInit;
          // Handle ICE-restart offers too (may arrive when already stable)
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          remoteSetRef.current = true;
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal("answer", answer);
        });
        ch.on("broadcast", { event: "answer" }, async (e) => {
          const answer = e.payload as RTCSessionDescriptionInit;
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            remoteSetRef.current = true;
            await flushIce();
          }
        });
        ch.on("broadcast", { event: "ice" }, async (e) => {
          const cand = e.payload as RTCIceCandidateInit;
          if (!remoteSetRef.current) { pendingIceRef.current.push(cand); return; }
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (err) { console.warn(err); }
        });
        ch.on("broadcast", { event: "hangup" }, () => setStatus("ended"));

        ch.on("presence", { event: "sync" }, () => {
          const state = ch.presenceState() as Record<string, unknown[]>;
          const peerHere = Boolean(state[peerId] && state[peerId].length);
          if (isCallerRef.current && peerHere && !offerSentRef.current) {
            void makeOffer();
          }
          if (!peerHere && !isCallerRef.current) setStatus("ringing");
        });

        await ch.subscribe(async (s) => {
          if (s !== "SUBSCRIBED") return;
          await ch.track({ joined_at: Date.now(), role: isCallerRef.current ? "caller" : "callee" });
          if (isCallerRef.current) {
            setTimeout(() => {
              const state = ch.presenceState() as Record<string, unknown[]>;
              if (state[peerId] && state[peerId].length && !offerSentRef.current) void makeOffer();
            }, 1500);
          }
        });
      } catch (e: any) {
        console.error("Call error", e);
        setError(e?.message ?? "Call failed");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      const ch = channelRef.current;
      if (ch) {
        try { ch.send({ type: "broadcast", event: "hangup", payload: {} }); } catch { /* ignore */ }
        supabase.removeChannel(ch);
        channelRef.current = null;
      }
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      offerSentRef.current = false;
      remoteSetRef.current = false;
      pendingIceRef.current = [];
      sendSignalRef.current = null;
    };
  }, [peerId, mode]);

  const hangup = useCallback(async () => {
    const ch = channelRef.current;
    if (ch) {
      try { await ch.send({ type: "broadcast", event: "hangup", payload: {} }); } catch { /* ignore */ }
    }
    setStatus("ended");
  }, []);

  const toggleAudio = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
  }, []);

  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
  }, []);

  // Flip between front and back camera on mobile — replaces the sender track
  // in-place so the peer sees the switch without renegotiating.
  const flipCamera = useCallback(async () => {
    if (mode !== "video") return;
    const pc = pcRef.current;
    const current = localStreamRef.current;
    if (!pc || !current) return;
    const next: FacingMode = facing === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(next),
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      // Swap into the local stream so the self-view updates
      current.getVideoTracks().forEach((t) => { t.stop(); current.removeTrack(t); });
      current.addTrack(newTrack);
      setFacing(next);
      setLocalStream(new MediaStream(current.getTracks()));
    } catch (e) {
      console.warn("Camera flip failed", e);
    }
  }, [facing, mode]);

  return { localStream, remoteStream, remoteRev, status, error, hangup, toggleAudio, toggleVideo, flipCamera, facing };
}
