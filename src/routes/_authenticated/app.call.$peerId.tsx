import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Video, VideoOff, PhoneOff, MessageCircle, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useProfile } from "@/hooks/useProfile";
import { useChat } from "@/hooks/useChat";
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
  const [chatOpen, setChatOpen] = useState(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

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
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-petal">{status}</p>
          <p className="font-serif italic text-lg">{peerName || "Connecting…"}</p>
        </div>
        <button
          onClick={() => setChatOpen((c) => !c)}
          className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-petal"
          aria-label="Chat"
        >
          <MessageCircle className="size-4" />
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {mode === "video" ? (
          <>
            <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
            <video ref={localRef} autoPlay playsInline muted className="absolute top-4 right-4 w-28 h-40 object-cover rounded-2xl border border-border bg-black shadow-xl" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-40 rounded-full bg-petal-soft border border-petal/30 flex items-center justify-center petal-glow">
              <span className="font-serif text-6xl italic text-petal">{peerName?.[0]?.toUpperCase() ?? "🐼"}</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute bottom-32 left-4 right-4 p-3 bg-surface border border-petal/40 rounded-2xl text-sm text-candle">{error}</div>
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

      <div className="relative z-20 p-6 pb-10 flex items-center justify-center gap-4">
        <button onClick={() => { toggleAudio(); setMuted((m) => !m); }} className="size-14 rounded-full bg-surface border border-border flex items-center justify-center text-candle">
          {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        <button onClick={() => { hangup(); navigate({ to: "/app" }); }} className="size-16 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow">
          <PhoneOff className="size-6" />
        </button>
        {mode === "video" && (
          <button onClick={() => { toggleVideo(); setVideoOff((v) => !v); }} className="size-14 rounded-full bg-surface border border-border flex items-center justify-center text-candle">
            {videoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
          </button>
        )}
      </div>
    </div>
  );
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
