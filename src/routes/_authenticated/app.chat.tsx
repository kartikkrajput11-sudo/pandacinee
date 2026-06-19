import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Phone, Video, Pin, ChevronDown } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useChat } from "@/hooks/useChat";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { MoodBar } from "@/components/chat/MoodBar";
import type { MessageRow } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/app/chat")({
  component: Chat,
});

function Chat() {
  const { data, isLoading } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const { messages, loading, partnerTyping, partnerOnline, send, react, togglePin, remove, sendTyping } =
    useChat(me?.id ?? null, partner?.id ?? null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesById = useMemo(() => {
    const map: Record<string, MessageRow> = {};
    messages.forEach((m) => (map[m.id] = m));
    return map;
  }, [messages]);

  const pinned = useMemo(() => messages.filter((m) => m.pinned), [messages]);
  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].sender_id === me?.id) return messages[i].id;
    return null;
  }, [messages, me?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, partnerTyping]);

  if (isLoading || loading) {
    return <ChatShell><div className="p-8 text-center text-candle-muted">Loading…</div></ChatShell>;
  }

  if (!me) return null;

  if (!partner) {
    return (
      <ChatShell>
        <div className="px-6 py-16 text-center">
          <h2 className="font-serif text-2xl italic mb-2">No one to chat with yet</h2>
          <p className="text-sm text-candle-muted mb-6">Pair with your partner to start a private conversation.</p>
          <Link to="/app/invite" className="inline-block px-6 py-3 bg-petal text-velvet rounded-full font-semibold text-sm">
            Invite partner
          </Link>
        </div>
      </ChatShell>
    );
  }

  const partnerDisplay = me.partner_nickname || partner.display_name;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <header className="px-4 pt-6 pb-3 flex items-center gap-3 border-b border-border bg-velvet/80 backdrop-blur sticky top-0 z-10">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="size-10 rounded-full bg-petal-soft flex items-center justify-center overflow-hidden">
          {partner.avatar_url ? <img src={partner.avatar_url} alt="" className="size-full object-cover" /> : <span className="text-lg">🐼</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif italic text-lg leading-tight truncate">{partnerDisplay}</h1>
          <p className="text-[10px] text-petal flex items-center gap-1">
            <span className={`size-1.5 rounded-full ${partnerOnline ? "bg-green-400" : "bg-candle-muted"}`} />
            {partnerTyping ? "typing…" : partnerOnline ? "online" : "offline"}
          </p>
        </div>
        <Link to="/app/call/$peerId" params={{ peerId: partner.id }} search={{ role: "caller", mode: "audio" }} className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal">
          <Phone className="size-4" />
        </Link>
        <Link to="/app/call/$peerId" params={{ peerId: partner.id }} search={{ role: "caller", mode: "video" }} className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal">
          <Video className="size-4" />
        </Link>
      </header>

      <MoodBar me={me} partner={partner} />

      {pinned.length > 0 && (
        <div className="border-b border-border bg-surface/30">
          <button onClick={() => setShowPinned((s) => !s)} className="w-full px-4 py-2 flex items-center gap-2 text-xs text-petal">
            <Pin className="size-3" />
            <span>{pinned.length} pinned</span>
            <ChevronDown className={`size-3 ml-auto transition-transform ${showPinned ? "rotate-180" : ""}`} />
          </button>
          {showPinned && (
            <div className="px-4 pb-3 space-y-1">
              {pinned.map((p) => (
                <div key={p.id} className="text-xs text-candle bg-surface px-3 py-2 rounded-lg border border-border truncate">
                  {p.type === "voice" ? "🎙 Voice message" : p.type === "image" ? "📷 Photo" : p.type === "file" ? `📎 ${p.content}` : p.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-sm text-candle-muted">
            <p className="font-serif italic text-lg text-candle mb-1">Say hi 🐼</p>
            <p>Voice, photos, stickers — make it cozy.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showAvatar = !prev || prev.sender_id !== m.sender_id;
          const isLastMine = m.id === lastMineId;
          return (
            <ChatBubble
              key={m.id}
              m={m}
              mine={m.sender_id === me.id}
              replyTo={m.reply_to_id ? messagesById[m.reply_to_id] ?? null : null}
              showAvatar={showAvatar}
              isLast={isLastMine}
              onReact={react}
              onReply={setReplyTo}
              onPin={togglePin}
              onDelete={remove}
            />
          );
        })}
        {partnerTyping && (
          <div className="px-3 mt-2 flex">
            <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-surface-elevated border border-border">
              <div className="flex gap-1">
                <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <ChatComposer
        meId={me.id}
        partnerName={partnerDisplay}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onTyping={sendTyping}
        onSend={send}
      />
    </div>
  );
}

function ChatShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3 border-b border-border">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Private chat</p>
          <h1 className="font-serif text-xl italic">Just you, for now</h1>
        </div>
      </header>
      {children}
    </div>
  );
}
