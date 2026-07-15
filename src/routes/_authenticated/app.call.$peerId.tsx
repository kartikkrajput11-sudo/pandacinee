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
    // Attach srcObject ONCE per stream identity. New tracks added to the same
    // MediaStream propagate to the element automatically — re-assigning
    // srcObject mid-call aborts the current playback ("play() interrupted by
    // a new load request") and produces audible glitches / lag spikes.
    const v = remoteRef.current;
    if (v && v.srcObject !== remoteStream) {
      v.srcObject = remoteStream;
      const p = v.play?.();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {});
      }
    }
    const a = remoteAudioRef.current;
    if (a && a.srcObject !== remoteStream) {
      a.srcObject = remoteStream;
    }
    if (a) {
      a.muted = !speakerOn;
      // Kick playback every time a new track arrives (remoteRev bumps on
      // ontrack). Without this, if the audio track lands AFTER the initial
      // srcObject attach, the element stays silent because .play() was only
      // called during the first attach when the stream had no audio yet.
      const p = a.play?.();
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
    const t = setTimeout(() => navigate({ to: "/app/chat/$peerId", params: { peerId } }), 800);
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
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#0f0714] text-white">
      {/* Candlelit background — velvet vignette + rose/amber glows + film grain */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0f0714_0%,#160820_45%,#0a0510_100%)]" />
        <div className="absolute top-1/4 -left-10 w-72 h-72 rounded-full bg-rose-900/20 blur-[110px] animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 -right-10 w-80 h-80 rounded-full bg-amber-900/15 blur-[130px] animate-[pulse_7s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_10%,#0f0714_110%)]" />
      </div>
      {/* Fine noise grain for cinematic texture */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')",
        }}
      />

      {/* Header */}
      <header className="relative z-20 flex items-start justify-between px-5 pt-6 pb-3">
        <Link
          to="/app"
          className="size-10 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-amber-200/90 transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex flex-col items-center gap-1 pt-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/40 flex items-center gap-2">
            <Signal className={`size-2.5 ${isConnected ? "text-amber-300/80" : "text-white/30 animate-pulse"}`} />
            {mode === "video" ? "Video Call" : "Voice Call"}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-light tracking-wide text-white/85">
              {isConnected ? "" : role === "caller" ? "Calling" : "Ringing"}
            </span>
            <span className="font-serif italic text-xl sm:text-2xl text-amber-100/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
              {peer.display_name || "…"}
            </span>
          </div>
          {isConnected ? (
            <p className="text-[11px] tabular-nums text-amber-200/60 tracking-[0.2em]">{statusLabel}</p>
          ) : (
            <div className="flex gap-1.5 mt-1">
              <span className="size-1 rounded-full bg-amber-300/80 animate-pulse" />
              <span className="size-1 rounded-full bg-amber-300/50 animate-pulse [animation-delay:150ms]" />
              <span className="size-1 rounded-full bg-amber-300/30 animate-pulse [animation-delay:300ms]" />
            </div>
          )}
        </div>
        <button
          onClick={() => setChatOpen((c) => !c)}
          className={`size-10 rounded-full backdrop-blur-xl border flex items-center justify-center transition-colors ${
            chatOpen
              ? "bg-amber-200/90 text-[#0f0714] border-amber-200"
              : "bg-white/[0.04] border-white/10 text-amber-100/80 hover:bg-white/10"
          }`}
          aria-label="Chat"
        >
          <MessageCircle className="size-4" />
        </button>
      </header>

      {/* Main stage */}
      <div className="relative flex-1 overflow-hidden">
        {mode === "video" && remoteStream && remoteRev > 0 ? (
          <>
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Cinematic overlays on top of the remote video */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0f0714] via-transparent to-[#0f0714]/40" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(15,7,20,0.55)_100%)]" />

            {/* Self-view PiP — glass-edged, candle-glow shadow */}
            <div className="absolute bottom-32 right-5 w-24 h-36 sm:w-28 sm:h-40 rounded-[28px] overflow-hidden border border-white/15 ring-1 ring-white/5 shadow-[0_18px_40px_rgba(0,0,0,0.7)] bg-black">
              <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              {videoOff && (
                <div className="absolute inset-0 bg-[#0f0714] flex items-center justify-center">
                  <VideoOff className="size-5 text-white/50" />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="relative flex items-center justify-center">
              {showRings && (
                <>
                  <span className="absolute size-56 rounded-full bg-amber-300/10 animate-ping" />
                  <span className="absolute size-72 rounded-full border border-amber-200/20 animate-pulse" />
                  <span className="absolute size-[22rem] rounded-full border border-amber-200/5" />
                </>
              )}
              <div className="relative size-40 rounded-full bg-gradient-to-br from-amber-100/30 to-rose-900/40 border border-amber-200/30 overflow-hidden shadow-[0_0_80px_rgba(251,191,36,0.25)]">
                <CallAvatar path={peer.avatar_url} name={peer.display_name} />
              </div>
            </div>
            <p className="mt-10 font-serif italic text-3xl text-amber-100/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              {peer.display_name || "Connecting…"}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.4em] text-white/40">
              {isConnected ? "In your ear" : statusLabel}
            </p>
          </div>
        )}

        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />


        {audioBlocked && !error && (
          <button
            onClick={enableSound}
            className="absolute bottom-36 left-5 right-5 p-3 bg-amber-200/95 text-[#0f0714] rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(251,191,36,0.35)] animate-fade-in"
          >
            <Volume2 className="size-4" /> Tap to hear {peer.display_name || "them"}
          </button>
        )}

        {error && (
          <div className="absolute bottom-36 left-5 right-5 p-3 bg-white/[0.06] backdrop-blur-xl border border-rose-400/30 rounded-2xl text-sm text-white/90 text-center">
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

      {/* Control dock — candlelit glass */}
      <div className="relative z-20 px-5 pb-8 pt-3">
        <div className="mx-auto max-w-md bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[36px] p-2 flex items-center justify-between shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.06)]">
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
            onClick={() => { hangup(); navigate({ to: "/app/chat/$peerId", params: { peerId } }); }}
            className="relative w-20 h-12 rounded-[24px] bg-[#e11d48] text-white flex items-center justify-center shadow-[0_8px_25px_rgba(225,29,72,0.45),inset_0_2px_4px_rgba(255,255,255,0.28)] active:scale-95 active:brightness-90 transition-transform"
            aria-label="End call"
          >
            <PhoneOff className="size-5" />
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
      className={`size-12 rounded-full flex items-center justify-center transition-all active:scale-95 border ${
        active
          ? "bg-amber-100/90 text-[#0f0714] border-amber-200 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)]"
          : "bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/10 hover:text-amber-100"
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
