import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff } from "lucide-react";
import { z } from "zod";
import { useProfile } from "@/hooks/useProfile";
import { useGroup } from "@/hooks/useGroups";
import { useLiveKitCall } from "@/hooks/useLiveKitCall";

const searchSchema = z.object({
  role: z.enum(["caller", "callee"]).default("caller"),
  mode: z.enum(["voice", "video"]).default("video"),
  callId: z.string(),
});

export const Route = createFileRoute("/_authenticated/app/call/group/$groupId")({
  validateSearch: searchSchema,
  component: GroupCall,
});

function GroupCall() {
  const { groupId } = Route.useParams();
  const { callId, mode } = Route.useSearch();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const { data: groupData } = useGroup(groupId);
  const meId = profileData?.profile?.id ?? null;

  const call = useLiveKitCall({ callId, meId, kind: mode });
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(mode === "voice");

  const localRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (localRef.current && call.localStream) {
      localRef.current.srcObject = call.localStream;
    }
  }, [call.localStream]);

  function toggleMic() {
    if (!call.localStream) return;
    call.localStream.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  }
  function toggleCam() {
    if (!call.localStream) return;
    call.localStream.getVideoTracks().forEach((t) => (t.enabled = camOff));
    setCamOff((c) => !c);
  }

  async function hangup() {
    try { await call.hangup(); } catch {}
    navigate({ to: "/app/chat/group/$groupId", params: { groupId } });
  }

  const feeds = Object.values(call.remoteFeeds);
  const group = groupData?.group;

  return (
    <div className="min-h-[100dvh] bg-black text-candle flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Link to="/app/chat/group/$groupId" params={{ groupId }} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">
            {mode === "video" ? "Video" : "Voice"} · group
          </p>
          <p className="font-serif italic text-lg truncate">{group?.name ?? "Circle"}</p>
        </div>
        <span className="text-[10px] text-candle-muted">
          {call.status === "ringing" ? "Ringing…" : call.status === "active" ? "Live" : call.status}
        </span>
      </header>

      <div className="flex-1 grid grid-cols-2 gap-2 p-2 auto-rows-fr">
        {mode === "video" && (
          <div className="relative bg-surface rounded-2xl overflow-hidden">
            <video ref={localRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <span className="absolute bottom-1 left-2 text-[10px] bg-black/50 px-2 py-0.5 rounded-full">You</span>
          </div>
        )}
        {feeds.map((f) => (
          <RemoteTile key={f.key} stream={f.stream} />
        ))}
        {feeds.length === 0 && mode === "voice" && (
          <div className="col-span-2 flex items-center justify-center text-candle-muted text-sm">
            Waiting for others to join…
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4 py-6 border-t border-white/10">
        <button
          onClick={toggleMic}
          className={`size-14 rounded-full flex items-center justify-center ${muted ? "bg-red-500/30 text-red-300" : "bg-surface border border-border text-candle"}`}
        >
          {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        {mode === "video" && (
          <button
            onClick={toggleCam}
            className={`size-14 rounded-full flex items-center justify-center ${camOff ? "bg-red-500/30 text-red-300" : "bg-surface border border-border text-candle"}`}
          >
            {camOff ? <VideoOff className="size-5" /> : <VideoIcon className="size-5" />}
          </button>
        )}
        <button
          onClick={hangup}
          className="size-14 rounded-full bg-red-500 text-white flex items-center justify-center"
        >
          <PhoneOff className="size-5" />
        </button>
      </div>
    </div>
  );
}

function RemoteTile({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative bg-surface rounded-2xl overflow-hidden">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
    </div>
  );
}
