import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageCircle,
  X,
  Volume2,
  VolumeX,
  Signal,
  SwitchCamera,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useProfile } from "@/hooks/useProfile";
import { useChat } from "@/hooks/useChat";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { MessageRow } from "@/lib/chat";
import { playDialTone } from "@/lib/ringtone";

function CallAvatar({ path, name }: { path: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    if (path.startsWith("http")) { setUrl(path); return; }
    supabase.storage.from("avatars").createSignedUrl(path, 3600).then(({ data }) => {
      if (alive) setUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [path]);
  if (url) return <img src={url} alt="" className="w-full h-full object-cover" />;
  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="font-serif text-6xl italic text-petal">
        {name?.[0]?.toUpperCase() ?? "🐼"}
      </span>
    </div>
  );
}

const searchSchema = z.object({
  role: z.enum(["caller", "callee"]).default("caller"),
  mode: z.enum(["video", "audio"]).default("video"),
});

export const Route = createFileRoute("/_authenticated/app/call/$peerId")({
  validateSearch: searchSchema,
  component: Call,
});

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function Call() {
  const { peerId } = Route.useParams();
  const { role, mode } = Route.useSearch();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const { localStream, remoteStream, remoteRev, status, error, hangup, toggleAudio, toggleVideo, flipCamera } = useWebRTCCall(
    peerId,
    mode,
    role === "caller",
  );
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [peer, setPeer] = useState<{ display_name: string; avatar_url: string | null }>({
    display_name: "",
    avatar_url: null,
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const connectedAtRef = useRef<number | null>(null);

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
    if (!remoteStream) return;
    // Re-attach on every ontrack revision so newly arriving audio/video tracks
    // are actually rendered. Some browsers (notably iOS Safari) won't start
    // playback when tracks are added to an already-set MediaStream — the
    // srcObject has to be assigned again.
    if (remoteRef.current) {
      remoteRef.current.srcObject = remoteStream;
      const p = remoteRef.current.play?.();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {});
      }
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = !speakerOn;
      const p = remoteAudioRef.current.play?.();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).then(() => setAudioBlocked(false)).catch((err) => {
          console.warn("Remote audio autoplay blocked", err);
          if (speakerOn) setAudioBlocked(true);
        });
      }
    }
  }, [remoteStream, remoteRev, speakerOn]);

  function enableSound() {
    if (!remoteAudioRef.current) return;
    remoteAudioRef.current.muted = false;
    const p = remoteAudioRef.current.play?.();
    if (p && typeof (p as Promise<void>).catch === "function") {
      (p as Promise<void>).then(() => setAudioBlocked(false)).catch(() => {});
    } else {
      setAudioBlocked(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", peerId)
        .maybeSingle();
      if (data) setPeer({ display_name: data.display_name, avatar_url: data.avatar_url ?? null });
    })();
  }, [peerId]);

  // Duration timer
  useEffect(() => {
    if (status === "connected" && connectedAtRef.current === null) {
      connectedAtRef.current = Date.now();
    }
    if (status !== "connected") return;
    const id = window.setInterval(() => {
      setDuration(Math.floor((Date.now() - (connectedAtRef.current ?? Date.now())) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [status]);

  // Dial tone for the caller until the call connects (or ends)
  useEffect(() => {
    if (role !== "caller") return;
    if (status === "connected" || status === "ended" || status === "error") return;
    const handle = playDialTone();
    return () => handle.stop();
  }, [role, status]);


  const loggedRef = useRef(false);
  useEffect(() => {
    if (status !== "ended") return;
    if (loggedRef.current) return;
    loggedRef.current = true;
    // Only the caller writes the log message to avoid duplicates.
    if (role === "caller") {
      (async () => {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const durSec = connectedAtRef.current
          ? Math.floor((Date.now() - connectedAtRef.current) / 1000)
          : 0;
        const outcome = connectedAtRef.current ? "completed" : "missed";
        await supabase.from("messages").insert({
          sender_id: u.user.id,
          receiver_id: peerId,
          type: "call",
          content:
            outcome === "missed"
              ? `Missed ${mode} call`
              : `${mode === "video" ? "Video" : "Voice"} call · ${fmtDuration(durSec)}`,
          media_meta: { mode, outcome, duration_sec: durSec } as never,
        });
      })();
    }
    const t = setTimeout(() => navigate({ to: "/app" }), 800);
    return () => clearTimeout(t);
  }, [status, navigate, role, peerId, mode]);

  // Speaker toggle: mute the dedicated remote audio element. The video
  // element is always muted (audio comes from the <audio> tag) to avoid
  // double playback.
  useEffect(() => {
    if (remoteRef.current) remoteRef.current.muted = true;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !speakerOn;
  }, [speakerOn, remoteStream]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "idle":
      case "connecting":
        return role === "caller" ? "Calling…" : "Answering…";
      case "ringing":
        return "Ringing…";
      case "connected":
        return fmtDuration(duration);
      case "ended":
        return "Call ended";
      case "error":
        return "Connection issue";
      default:
        return status;
    }
  }, [status, role, duration]);

  const isConnected = status === "connected";
  const showRings = !isConnected && status !== "ended";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-velvet text-candle">
      {/* Ambient gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--petal)/0.35),transparent_55%),radial-gradient(circle_at_85%_90%,hsl(var(--petal)/0.25),transparent_60%),linear-gradient(180deg,hsl(var(--velvet)),#0a0510)]" />
        <div className="absolute inset-0 opacity-40 mix-blend-screen bg-[conic-gradient(from_0deg_at_50%_50%,transparent,hsl(var(--petal)/0.15),transparent_30%)] animate-[spin_18s_linear_infinite]" />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-5 pt-5 pb-3">
        <Link
          to="/app"
          className="size-10 rounded-full bg-surface/70 backdrop-blur border border-border/60 flex items-center justify-center text-candle-muted hover:text-petal transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal flex items-center gap-1.5 justify-center">
            <Signal className={`size-3 ${isConnected ? "text-petal" : "text-candle-muted animate-pulse"}`} />
            {mode === "video" ? "Video call" : "Voice call"}
          </p>
          <p className="text-[11px] tabular-nums text-candle-muted mt-0.5">{statusLabel}</p>
        </div>
        <button
          onClick={() => setChatOpen((c) => !c)}
          className={`size-10 rounded-full backdrop-blur border flex items-center justify-center transition-colors ${
            chatOpen ? "bg-petal text-velvet border-petal" : "bg-surface/70 border-border/60 text-petal hover:bg-petal/10"
          }`}
          aria-label="Chat"
        >
          <MessageCircle className="size-4" />
        </button>
      </header>

      {/* Main stage */}
      <div className="relative flex-1 overflow-hidden">
        {mode === "video" && remoteStream ? (
          <>
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover bg-black"
            />
            {/* Local self-view */}
            <div className="absolute top-4 right-4 w-24 h-36 sm:w-28 sm:h-40 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
              <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {videoOff && (
                <div className="absolute inset-0 bg-velvet flex items-center justify-center">
                  <VideoOff className="size-5 text-candle-muted" />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="relative flex items-center justify-center">
              {showRings && (
                <>
                  <span className="absolute size-52 rounded-full bg-petal/15 animate-ping" />
                  <span className="absolute size-64 rounded-full border border-petal/30 animate-pulse" />
                  <span className="absolute size-80 rounded-full border border-petal/10" />
                </>
              )}
              <div className="relative size-40 rounded-full bg-gradient-to-br from-petal-soft to-petal/40 border border-petal/40 overflow-hidden shadow-[0_0_60px_hsl(var(--petal)/0.4)]">
                <CallAvatar path={peer.avatar_url} name={peer.display_name} />
              </div>
            </div>
            <p className="mt-8 font-serif italic text-2xl text-candle">
              {peer.display_name || "Connecting…"}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-candle-muted">
              {isConnected ? "in your ear" : statusLabel}
            </p>
          </div>
        )}

        {/* Dedicated remote-audio element — always mounted so the peer's
            voice plays even in video mode or before the video track arrives. */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

        {mode === "video" && !remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="relative flex items-center justify-center">
              <span className="absolute size-44 rounded-full bg-petal/15 animate-ping" />
              <div className="relative size-32 rounded-full bg-gradient-to-br from-petal-soft to-petal/40 border border-petal/40 overflow-hidden">
                <CallAvatar path={peer.avatar_url} name={peer.display_name} />
              </div>
            </div>
            <p className="mt-6 font-serif italic text-xl">{peer.display_name || "Connecting…"}</p>
          </div>
        )}

        {error && (
          <div className="absolute bottom-32 left-4 right-4 p-3 bg-surface/90 backdrop-blur border border-petal/40 rounded-2xl text-sm text-candle text-center">
            {error}
          </div>
        )}

        {chatOpen && me && (
          <InCallChat
            meId={me.id}
            partnerId={peerId}
            partnerName={peer.display_name}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>

      {/* Controls */}
      <div className="relative z-20 px-6 pb-10 pt-4">
        <div className="mx-auto max-w-md bg-surface/60 backdrop-blur-xl border border-border/60 rounded-full p-3 flex items-center justify-around shadow-2xl">
          <ControlButton
            active={muted}
            onClick={() => { toggleAudio(); setMuted((m) => !m); }}
            label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </ControlButton>

          {mode === "video" ? (
            <>
              <ControlButton
                active={videoOff}
                onClick={() => { toggleVideo(); setVideoOff((v) => !v); }}
                label={videoOff ? "Camera on" : "Camera off"}
              >
                {videoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
              </ControlButton>
              <ControlButton onClick={() => flipCamera()} label="Flip camera">
                <SwitchCamera className="size-5" />
              </ControlButton>
            </>
          ) : (
            <ControlButton
              active={!speakerOn}
              onClick={() => setSpeakerOn((s) => !s)}
              label={speakerOn ? "Speaker off" : "Speaker on"}
            >
              {speakerOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </ControlButton>
          )}

          <button
            onClick={() => { hangup(); navigate({ to: "/app" }); }}
            className="size-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95 transition-transform"
            aria-label="End call"
          >
            <PhoneOff className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`size-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
        active
          ? "bg-candle text-velvet"
          : "bg-surface/80 border border-border text-candle hover:border-petal/50 hover:text-petal"
      }`}
    >
      {children}
    </button>
  );
}

function InCallChat({ meId, partnerId, partnerName, onClose }: { meId: string; partnerId: string; partnerName: string; onClose: () => void }) {
  const { messages, send, react, togglePin, remove, setVanish, sendTyping } = useChat(meId, partnerId);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9 }); }, [messages.length]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-1/3 z-30 bg-velvet/95 backdrop-blur-xl border-t border-petal/40 rounded-t-3xl flex flex-col animate-fade-in">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <p className="font-serif italic text-sm">Chat with {partnerName}</p>
        <button onClick={onClose} className="text-candle-muted hover:text-candle transition-colors"><X className="size-4" /></button>
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
            onVanish={setVanish}
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
