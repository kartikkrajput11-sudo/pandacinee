import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Video, VideoOff, PhoneOff, MessageCircle, X, Signal, Volume2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useProfile } from "@/hooks/useProfile";
import { useChat } from "@/hooks/useChat";
import { useSpeakingLevel } from "@/hooks/useSpeakingLevel";
import { AudioWaveform } from "@/components/call/AudioWaveform";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { MessageRow } from "@/lib/chat";

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
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const { localStream, remoteStream, status, error, hangup, toggleAudio, toggleVideo } = useWebRTCCall(
    peerId,
    mode,
    role === "caller",
  );
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [peerName, setPeerName] = useState<string>("");
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [callStart, setCallStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  const remoteLevel = useSpeakingLevel(remoteStream);
  const localLevel = useSpeakingLevel(muted ? null : localStream);
  const remoteSpeaking = remoteLevel > 0.06;

  // Call duration ticker
  useEffect(() => {
    if (status === "connected" && callStart == null) setCallStart(Date.now());
  }, [status, callStart]);
  useEffect(() => {
    if (callStart == null) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - callStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [callStart]);

  // Send invite signal when caller mounts
  useEffect(() => {
    if (role !== "caller") return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("call_signals").insert({
        from_id: u.user.id, to_id: peerId, kind: "invite", payload: { mode } as never,
      });
    })();
  }, [peerId, role, mode]);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", peerId).maybeSingle();
      if (data) { setPeerName(data.display_name); setPeerAvatar(data.avatar_url); }
    })();
  }, [peerId]);

  useEffect(() => {
    if (status === "ended") {
      const t = setTimeout(() => navigate({ to: "/app" }), 800);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  const statusLabel = status === "connected"
    ? formatDuration(elapsed)
    : status === "connecting" ? "Connecting…"
    : status === "ringing" ? "Ringing…"
    : status === "ended" ? "Call ended" : status;

  return (
    <div className="fixed inset-0 velvet-bg flex flex-col overflow-hidden">
      {/* Ambient aurora */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-40 -left-20 size-96 rounded-full aurora-bg blur-3xl animate-gradient" />
        <div className="absolute -bottom-40 -right-20 size-[28rem] rounded-full aurora-bg blur-3xl animate-gradient" style={{ animationDelay: "2s" }} />
      </div>

      <header className="relative z-20 flex items-center justify-between p-5 text-candle">
        <Link to="/app" className="size-10 rounded-full glass flex items-center justify-center text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Signal className={`size-3 ${status === "connected" ? "text-emerald-400" : "text-candle-muted"}`} />
            <p className="text-[10px] uppercase tracking-widest text-petal">{statusLabel}</p>
          </div>
          <p className="font-serif italic text-2xl leading-tight mt-0.5">{peerName || "Connecting…"}</p>
        </div>
        <button
          onClick={() => setChatOpen((c) => !c)}
          className="size-10 rounded-full glass flex items-center justify-center text-petal relative"
          aria-label="Chat"
        >
          <MessageCircle className="size-4" />
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {mode === "video" ? (
          <>
            <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
            {/* Speaking ring on local pip */}
            <div
              className="absolute top-4 right-4 rounded-3xl transition-shadow duration-150"
              style={{ boxShadow: `0 0 ${8 + localLevel * 40}px color-mix(in oklab, var(--petal) ${20 + localLevel * 60}%, transparent)` }}
            >
              <video ref={localRef} autoPlay playsInline muted className="w-28 h-40 object-cover rounded-3xl border border-petal/30 bg-black" />
              {videoOff && (
                <div className="absolute inset-0 rounded-3xl bg-velvet/90 flex items-center justify-center">
                  <VideoOff className="size-6 text-candle-muted" />
                </div>
              )}
            </div>
            {/* Live remote audio waveform strip */}
            <div className="absolute bottom-4 left-4 right-4 h-14 rounded-2xl glass px-3 flex items-center gap-3">
              <div className={`size-8 rounded-full bg-petal-soft flex items-center justify-center ${remoteSpeaking ? "animate-pulse-soft" : ""}`}>
                <Volume2 className="size-4 text-petal" />
              </div>
              <div className="flex-1">
                <AudioWaveform stream={remoteStream} height={40} bars={40} />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6">
            <div className="relative">
              {/* Bloom rings when partner is speaking */}
              {remoteSpeaking && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-petal/30 animate-bloom-ring" />
                  <div className="absolute inset-0 rounded-full border-2 border-petal-bloom/40 animate-bloom-ring" style={{ animationDelay: "0.4s" }} />
                </>
              )}
              <div
                className="relative size-48 rounded-full overflow-hidden border border-petal/40 flex items-center justify-center transition-all"
                style={{ boxShadow: `0 0 ${30 + remoteLevel * 80}px color-mix(in oklab, var(--petal) ${30 + remoteLevel * 60}%, transparent)` }}
              >
                {peerAvatar ? (
                  <img src={peerAvatar} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 aurora-bg animate-gradient" />
                )}
                <span className="relative font-serif text-7xl italic text-candle drop-shadow-lg">
                  {peerName?.[0]?.toUpperCase() ?? "🐼"}
                </span>
              </div>
            </div>

            {/* Big animated waveform */}
            <div className="w-full max-w-md">
              <AudioWaveform stream={remoteStream} height={90} bars={44} />
              <p className="text-center text-[10px] uppercase tracking-[0.3em] text-candle-muted mt-3">
                {remoteSpeaking ? `${peerName || "Partner"} is speaking` : "Listening…"}
              </p>
            </div>

            {/* Local waveform mini */}
            <div className="w-40">
              <AudioWaveform stream={muted ? null : localStream} height={28} bars={24} color="var(--petal-bloom)" />
              <p className="text-center text-[9px] uppercase tracking-widest text-candle-muted mt-1">
                {muted ? "You're muted" : "You"}
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute bottom-32 left-4 right-4 p-3 glass rounded-2xl text-sm text-candle">{error}</div>
        )}

        {chatOpen && me && (
          <InCallChat
            meId={me.id}
            partnerId={peerId}
            partnerName={peerName}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>

      <div className="relative z-20 px-6 pb-10 pt-4 flex items-center justify-center gap-4">
        <button
          onClick={() => { toggleAudio(); setMuted((m) => !m); }}
          className={`size-14 rounded-full flex items-center justify-center transition-all ${muted ? "bg-petal text-velvet petal-glow" : "glass text-candle"}`}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        <button
          onClick={() => { hangup(); navigate({ to: "/app" }); }}
          className="size-[68px] rounded-full bg-gradient-to-br from-red-500 to-petal text-white flex items-center justify-center petal-glow hover:scale-105 transition-transform"
          aria-label="End call"
        >
          <PhoneOff className="size-6" />
        </button>
        {mode === "video" && (
          <button
            onClick={() => { toggleVideo(); setVideoOff((v) => !v); }}
            className={`size-14 rounded-full flex items-center justify-center transition-all ${videoOff ? "bg-petal text-velvet petal-glow" : "glass text-candle"}`}
            aria-label={videoOff ? "Turn on camera" : "Turn off camera"}
          >
            {videoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
          </button>
        )}
        {mode === "audio" && (
          <button
            onClick={() => setChatOpen((c) => !c)}
            className="size-14 rounded-full glass flex items-center justify-center text-candle"
            aria-label="Chat"
          >
            <MessageCircle className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function InCallChat({ meId, partnerId, partnerName, onClose }: { meId: string; partnerId: string; partnerName: string; onClose: () => void }) {
  const { messages, send, react, togglePin, remove, sendTyping } = useChat(meId, partnerId);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9 }); }, [messages.length]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-1/3 z-30 bg-velvet/95 backdrop-blur-xl border-t border-petal/40 rounded-t-3xl flex flex-col animate-fade-in">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <p className="font-serif italic text-sm">Chat with {partnerName}</p>
        <button onClick={onClose} className="text-candle-muted"><X className="size-4" /></button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-3">
        {messages.slice(-30).map((m) => (
          <ChatBubble
            key={m.id}
            m={m}
            mine={m.sender_id === meId}
            replyTo={m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) ?? null : null}
            showAvatar
            isLast={false}
            onReact={react}
            onReply={setReplyTo}
            onPin={togglePin}
            onDelete={remove}
          />
        ))}
      </div>
      <ChatComposer
        meId={meId}
        partnerName={partnerName}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onTyping={sendTyping}
        onSend={send}
      />
    </div>
  );
}
