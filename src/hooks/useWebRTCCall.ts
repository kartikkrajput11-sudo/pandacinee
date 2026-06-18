import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type Mode = "video" | "audio";

export function useWebRTCCall(peerId: string | null, mode: Mode = "video", isCaller = true) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "ended" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const meRef = useRef<string | null>(null);

  useEffect(() => {
    if (!peerId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

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
          ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
        };

        pc.onicecandidate = async (ev) => {
          if (ev.candidate) {
            await supabase.from("call_signals").insert({
              from_id: meRef.current!,
              to_id: peerId,
              kind: "ice",
              payload: ev.candidate.toJSON() as any,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") setStatus("connected");
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") setStatus("ended");
        };

        channel = supabase
          .channel(`call-${meRef.current}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "call_signals", filter: `to_id=eq.${meRef.current}` },
            async (payload: any) => {
              const sig = payload.new;
              if (sig.from_id !== peerId) return;
              if (sig.kind === "offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await supabase.from("call_signals").insert({
                  from_id: meRef.current!,
                  to_id: peerId,
                  kind: "answer",
                  payload: answer as any,
                });
              } else if (sig.kind === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              } else if (sig.kind === "ice") {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
                } catch (e) {
                  console.warn("ICE add failed", e);
                }
              } else if (sig.kind === "hangup") {
                setStatus("ended");
              }
            }
          )
          .subscribe();

        if (isCaller) {
          // small delay so callee subscribes first
          setTimeout(async () => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await supabase.from("call_signals").insert({
              from_id: meRef.current!,
              to_id: peerId,
              kind: "offer",
              payload: offer as any,
            });
          }, 400);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Call failed");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      pcRef.current?.close();
      pcRef.current = null;
      setLocalStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [peerId, mode, isCaller]);

  async function hangup() {
    if (peerId && meRef.current) {
      await supabase.from("call_signals").insert({
        from_id: meRef.current,
        to_id: peerId,
        kind: "hangup",
        payload: {},
      });
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
