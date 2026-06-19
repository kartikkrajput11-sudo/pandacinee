import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

type Mode = "video" | "audio";
type SignalKind = "offer" | "answer" | "ice" | "hangup";

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export function useWebRTCCall(peerId: string | null, mode: Mode = "video", isCaller = true) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "ringing" | "connected" | "ended" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const meRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const offerSentRef = useRef(false);

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
          video: mode === "video",
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const remote = new MediaStream();
        setRemoteStream(remote);
        pc.ontrack = (ev) => {
          ev.streams[0].getTracks().forEach((t) => {
            if (!remote.getTracks().find((x) => x.id === t.id)) remote.addTrack(t);
          });
        };

        // shared room channel keyed by sorted ids — both peers join the same channel
        const ch = supabase.channel(`call-room:${pairKey(meRef.current, peerId)}`, {
          config: { broadcast: { self: false, ack: false }, presence: { key: meRef.current } },
        });
        channelRef.current = ch;

        async function sendSignal(kind: SignalKind, payload: unknown) {
          await ch.send({ type: "broadcast", event: kind, payload });
        }

        pc.onicecandidate = (ev) => {
          if (ev.candidate) void sendSignal("ice", ev.candidate.toJSON());
        };
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === "connected") setStatus("connected");
          else if (s === "failed" || s === "disconnected" || s === "closed") setStatus("ended");
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
          if (isCaller && peerHere && !offerSentRef.current) {
            void makeOffer();
          }
          if (!peerHere && !isCaller) setStatus("ringing");
        });

        await ch.subscribe(async (s) => {
          if (s !== "SUBSCRIBED") return;
          await ch.track({ joined_at: Date.now(), role: isCaller ? "caller" : "callee" });
          // Fallback: if no presence sync within 1.5s, caller still offers (in case peer already there)
          if (isCaller) {
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
      setLocalStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
      offerSentRef.current = false;
      remoteSetRef.current = false;
      pendingIceRef.current = [];
    };
  }, [peerId, mode, isCaller]);

  async function hangup() {
    const ch = channelRef.current;
    if (ch) {
      try { await ch.send({ type: "broadcast", event: "hangup", payload: {} }); } catch { /* ignore */ }
    }
    setStatus("ended");
  }
  function toggleAudio() {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
  }
  function toggleVideo() {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
  }

  return { localStream, remoteStream, status, error, hangup, toggleAudio, toggleVideo };
}
