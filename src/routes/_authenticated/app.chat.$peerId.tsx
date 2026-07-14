import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Phone, Video, Pin, ChevronDown, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useChat } from "@/hooks/useChat";
import { usePunishmentLock } from "@/hooks/usePunishmentLock";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { formatLastSeen } from "@/hooks/usePresenceHeartbeat";
import { ChatSearch } from "@/components/chat/ChatSearch";
import { MoodBar } from "@/components/chat/MoodBar";
import { KissOverlay } from "@/components/chat/KissOverlay";
import { PunishmentLockDialog } from "@/components/chat/PunishmentLockDialog";
import { PunishmentLockOverlay } from "@/components/chat/PunishmentLockOverlay";
import { PunishmentLockBanner } from "@/components/chat/PunishmentLockBanner";
import { PunishmentVerificationChat } from "@/components/chat/PunishmentVerificationChat";
import { usePunishmentVerification } from "@/hooks/usePunishmentVerification";
import { typeMeta } from "@/lib/punishment";
import type { MessageRow } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/app/chat/$peerId")({
  component: ChatPeer,
});

function ChatPeer() {
  const { peerId } = Route.useParams();
  const { data, isLoading } = useProfile();
  const me = data?.profile;

  const peerQ = useQuery({
    enabled: !!peerId,
    queryKey: ["peer", peerId],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", peerId)
        .maybeSingle();
      return (p as Profile) ?? null;
    },
  });
  const peer = peerQ.data ?? null;

  const { messages, loading, partnerTyping, partnerOnline, send, react, togglePin, remove, setVanish, sendTyping } =
    useChat(me?.id ?? null, peer?.id ?? null);
  const { activeLock, iAmLocked, iAmLocker, createLock, incrementProgress, completeLock, cancelLock } =
    usePunishmentLock(me?.id ?? null, peer?.id ?? null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isVerifyMode = !!activeLock && typeMeta(activeLock.type).mode === "verify";
  const { messages: verifMessages } = usePunishmentVerification(
    isVerifyMode ? activeLock!.id : null,
    me?.id ?? null,
  );
  const hasPendingSubmission = verifMessages.some((m) => m.submission && m.approved === null);

  // Auto-open verification chat for the locked partner so they immediately land in it.
  useEffect(() => {
    if (isVerifyMode && iAmLocked) setVerifyOpen(true);
  }, [isVerifyMode, iAmLocked]);

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

  const [kissTick, setKissTick] = useState(0);
  const [kissEmoji, setKissEmoji] = useState("💜");
  const [shake, setShake] = useState(false);
  const lastFxIdRef = useRef<string | null>(null);

  const jumpTo = useCallback((id: string) => {
    const el = bubbleRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, partnerTyping]);

  // Trigger kiss / nudge FX when a fresh message arrives from the partner
  useEffect(() => {
    if (messages.length === 0 || !me) return;
    const last = messages[messages.length - 1];
    if (last.id === lastFxIdRef.current) return;
    lastFxIdRef.current = last.id;

    const ageMs = Date.now() - new Date(last.created_at).getTime();
    if (ageMs > 15000) return; // ignore history

    if (last.type === "kiss") {
      setKissEmoji(last.content || "💜");
      setKissTick((t) => t + 1);
      if (last.sender_id !== me.id && "vibrate" in navigator) navigator.vibrate?.(60);
    } else if (last.type === "nudge" && last.sender_id !== me.id) {
      setShake(true);
      if ("vibrate" in navigator) navigator.vibrate?.([80, 40, 80]);
      window.setTimeout(() => setShake(false), 800);
    }
  }, [messages, me]);


  if (isLoading || peerQ.isLoading) {
    return <div className="flex flex-col h-screen items-center justify-center text-candle-muted">Loading…</div>;
  }
  if (!me) return null;
  if (!peer) {
    return (
      <div className="px-5 pt-10">
        <Link to="/app/chat" className="text-petal text-sm">← Back to chats</Link>
        <p className="mt-6 text-candle-muted">Couldn't find that person.</p>
      </div>
    );
  }

  const isPartner = me.partner_id === peer.id;
  const peerDisplay = (isPartner && me.partner_nickname) ? me.partner_nickname : peer.display_name;

  return (
    <div className={`flex flex-col h-screen ${shake ? "animate-chat-shake" : ""}`}>
      <header className="relative px-4 pt-6 pb-3 flex items-center gap-2 border-b border-border bg-velvet/80 backdrop-blur sticky top-0 z-10">
        <Link to="/app/chat" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <Link
          to="/app/user/$userId"
          params={{ userId: peer.id }}
          className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
        >
          <div className="size-10 rounded-full bg-petal-soft flex items-center justify-center overflow-hidden shrink-0">
            {peer.avatar_url ? <img src={peer.avatar_url} alt="" className="size-full object-cover" /> : <span className="text-lg">🐼</span>}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif italic text-lg leading-tight truncate">{peerDisplay}</h1>
            <p className="text-[10px] text-petal flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${partnerOnline ? "bg-green-400" : "bg-candle-muted"}`} />
              {partnerTyping ? "typing…" : partnerOnline ? "online" : "offline"}
              {isPartner && <span className="text-candle-muted">· 💜 partner</span>}
            </p>
          </div>
        </Link>
        <ChatSearch messages={messages} onJump={jumpTo} />
        <Link to="/app/call/$peerId" params={{ peerId: peer.id }} search={{ role: "caller", mode: "audio" }} className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal">
          <Phone className="size-4" />
        </Link>
        <Link to="/app/call/$peerId" params={{ peerId: peer.id }} search={{ role: "caller", mode: "video" }} className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal">
          <Video className="size-4" />
        </Link>
        {isPartner && !activeLock && (me as any).punishment_lock_enabled !== false && (peer as any).punishment_lock_enabled !== false && (
          <button
            onClick={() => setLockDialogOpen(true)}
            className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal"
            title="Lock chat as punishment"
            aria-label="Lock chat as punishment"
          >
            <Lock className="size-4" />
          </button>
        )}
      </header>

      <MoodBar me={me} partner={peer} />

      {activeLock && iAmLocker && (
        <PunishmentLockBanner
          lock={activeLock}
          targetName={peerDisplay}
          onCancel={cancelLock}
          onOpenVerification={isVerifyMode ? () => setVerifyOpen(true) : undefined}
          hasPending={hasPendingSubmission}
        />
      )}
      {activeLock && iAmLocked && isVerifyMode && !verifyOpen && (
        <button
          onClick={() => setVerifyOpen(true)}
          className="w-full px-4 py-2 border-b border-petal/40 bg-petal-soft/20 text-xs text-petal font-semibold flex items-center justify-center gap-2"
        >
          <Lock className="size-3" />
          Chat locked · Open Verification Chat →
        </button>
      )}

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
        {loading && <div className="text-center py-8 text-sm text-candle-muted">Loading messages…</div>}
        {!loading && messages.length === 0 && (
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
            <div
              key={m.id}
              ref={(el) => { bubbleRefs.current[m.id] = el; }}
              className={`transition-colors rounded-2xl ${highlightId === m.id ? "bg-petal/15 ring-1 ring-petal/40" : ""}`}
            >
              <ChatBubble
                m={m}
                mine={m.sender_id === me.id}
                replyTo={m.reply_to_id ? messagesById[m.reply_to_id] ?? null : null}
                showAvatar={showAvatar}
                isLast={isLastMine}
                onReact={react}
                onReply={setReplyTo}
                onPin={togglePin}
                onDelete={remove}
                onVanish={setVanish}
              />
            </div>
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
        partnerName={peerDisplay}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onTyping={sendTyping}
        onSend={send}
        locked={iAmLocked && activeLock ? { reason: `Complete your ${activeLock.type} challenge to unlock` } : null}
      />
      <KissOverlay trigger={kissTick} emoji={kissEmoji} />

      {activeLock && iAmLocked && !isVerifyMode && (
        <PunishmentLockOverlay
          lock={activeLock}
          meId={me.id}
          partnerId={peer.id}
          partnerName={peerDisplay}
          onIncrement={incrementProgress}
          onComplete={completeLock}
        />
      )}

      {activeLock && isVerifyMode && verifyOpen && (
        <PunishmentVerificationChat
          lock={activeLock}
          meId={me.id}
          partnerName={peerDisplay}
          iAmLocked={iAmLocked}
          iAmLocker={iAmLocker}
          onClose={() => setVerifyOpen(false)}
          onCancel={iAmLocker ? () => cancelLock(activeLock.id) : undefined}
        />
      )}

      <PunishmentLockDialog
        open={lockDialogOpen}
        onClose={() => setLockDialogOpen(false)}
        targetName={peerDisplay}
        mePrefs={me as unknown as Record<string, boolean>}
        peerPrefs={peer as unknown as Record<string, boolean>}
        onCreate={createLock}
      />
    </div>
  );
}
