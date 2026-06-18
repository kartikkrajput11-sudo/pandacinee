import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";

const searchSchema = z.object({
  role: z.enum(["caller", "callee"]).default("caller"),
  mode: z.enum(["video", "audio"]).default("video"),
});

export const Route = createFileRoute("/_authenticated/app/call/$peerId")({
  validateSearch: searchSchema,
  component: Call,
});

function Call() {
  const { peerId } = Route.useParams();
  const { role, mode } = Route.useSearch();
  const navigate = useNavigate();
  const { localStream, remoteStream, status, error, hangup, toggleAudio, toggleVideo } = useWebRTCCall(
    peerId,
    mode,
    role === "caller"
  );
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [peerName, setPeerName] = useState<string>("");
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", peerId).maybeSingle();
      if (data) setPeerName(data.display_name);
    })();
  }, [peerId]);

  useEffect(() => {
    if (status === "ended") {
      const t = setTimeout(() => navigate({ to: "/app" }), 800);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  return (
    <div className="fixed inset-0 bg-velvet flex flex-col">
      <header className="relative z-20 flex items-center justify-between p-5 text-candle">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-petal">{status}</p>
          <p className="font-serif italic text-lg">{peerName || "Connecting…"}</p>
        </div>
        <div className="size-5" />
      </header>

      <div className="relative flex-1 overflow-hidden">
        {mode === "video" ? (
          <>
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover bg-black"
            />
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="absolute top-4 right-4 w-28 h-40 object-cover rounded-2xl border border-border bg-black shadow-xl"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-40 rounded-full bg-petal-soft border border-petal/30 flex items-center justify-center petal-glow">
              <span className="font-serif text-6xl italic text-petal">
                {peerName?.[0]?.toUpperCase() ?? "🐼"}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute bottom-32 left-4 right-4 p-3 bg-surface border border-petal/40 rounded-2xl text-sm text-candle">
            {error}
          </div>
        )}
      </div>

      <div className="relative z-20 p-6 pb-10 flex items-center justify-center gap-4">
        <button
          onClick={() => {
            toggleAudio();
            setMuted((m) => !m);
          }}
          className="size-14 rounded-full bg-surface border border-border flex items-center justify-center text-candle"
        >
          {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        <button
          onClick={() => {
            hangup();
            navigate({ to: "/app" });
          }}
          className="size-16 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow"
        >
          <PhoneOff className="size-6" />
        </button>
        {mode === "video" && (
          <button
            onClick={() => {
              toggleVideo();
              setVideoOff((v) => !v);
            }}
            className="size-14 rounded-full bg-surface border border-border flex items-center justify-center text-candle"
          >
            {videoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
