import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Phone, Video, Pin, ChevronDown, Lock, Flame, ArrowDown, Heart as HeartIcon } from "lucide-react";
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
import { UnlockCelebration } from "@/components/chat/UnlockCelebration";
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

  const { messages, loading, loadingOlder, hasMore, loadOlder, partnerTyping, partnerOnline, send, react, togglePin, remove, setVanish, sendTyping } =
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

  // Chat richness: streak (consecutive days with 2-way activity), shared media, anniversary, day dividers.
  const { streakDays, sharedMedia, daysTogether } = useMemo(() => {
    if (messages.length === 0) return { streakDays: 0, sharedMedia: [] as MessageRow[], daysTogether: 0 };
    const dayKey = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const dayMap = new Map<string, Set<string>>();
    for (const m of messages) {
      const k = dayKey(m.created_at);
      if (!dayMap.has(k)) dayMap.set(k, new Set());
      dayMap.get(k)!.add(m.sender_id);
    }
    // count consecutive days ending today (or most recent activity day) with both sides
    const today = new Date();
    let streak = 0;
    const cursor = new Date(today);
    while (streak < 365) {
      const k = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
      const s = dayMap.get(k);
      if (s && s.size >= 2) streak++;
      else if (streak === 0 && s && s.size >= 1) {
        // allow 1-sided today so streak isn't 0 the moment you open
        streak++;
      } else break;
      cursor.setDate(cursor.getDate() - 1);
    }
    const media = messages
      .filter((m) => m.type === "image" || m.type === "video")
      .slice(-6)
      .reverse();
    const first = messages[0]?.created_at;
    const days = first ? Math.max(1, Math.floor((Date.now() - new Date(first).getTime()) / 86400000)) : 0;
    return { streakDays: streak, sharedMedia: media, daysTogether: days };
  }, [messages]);


  // Note: the 10-message cap now lives inside the temporary verification chat
  // (PunishmentVerificationChat) — the actual DM is not throttled.

  // Play the unlock animation whenever an active lock ends (punisher approved,
  // canceled, or otherwise wiped). Fires for both sides so the moment feels shared.
  const [unlockTick, setUnlockTick] = useState(0);
  const prevLockIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevLockIdRef.current;
    const now = activeLock?.id ?? null;
    if (prev && !now) setUnlockTick((n) => n + 1);
    prevLockIdRef.current = now;
  }, [activeLock?.id]);



  const [kissTick, setKissTick] = useState(0);
  const [kissEmoji, setKissEmoji] = useState("💜");
  const [shake, setShake] = useState(false);
  const lastFxIdRef = useRef<string | null>(null);
  const playedFxRef = useRef<Set<string>>(new Set());

  const jumpTo = useCallback((id: string) => {
    const el = bubbleRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
  }, []);

  // Smart scroll: stick to bottom on new tail messages, preserve position
  // when older messages prepend (infinite-scroll up).
  const prevFirstIdRef = useRef<string | null>(null);
  const prevLastIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    const firstId = messages[0].id;
    const lastId = messages[messages.length - 1].id;
    const prevFirst = prevFirstIdRef.current;
    const prevLast = prevLastIdRef.current;
    if (prevFirst && firstId !== prevFirst) {
      // older prepended — keep viewport anchored on what user was reading
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop = el.scrollTop + delta;
    } else if (!prevLast || lastId !== prevLast) {
      // new message at bottom (or first load) — scroll to bottom
      el.scrollTo({ top: el.scrollHeight, behavior: prevLast ? "smooth" : "auto" });
    }
    prevFirstIdRef.current = firstId;
    prevLastIdRef.current = lastId;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages, partnerTyping]);

  // Auto-load older when user scrolls near the top, and track scroll-to-bottom FAB visibility.
  const [showScrollFab, setShowScrollFab] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop < 80 && hasMore && !loadingOlder && !loading) {
        prevScrollHeightRef.current = el.scrollHeight;
        loadOlder();
      }
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollFab(distanceFromBottom > 240);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingOlder, loading, loadOlder]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);


  // Trigger kiss / nudge FX for partner messages. Plays for anything that is
  // (a) freshly arrived (< 15s old) OR (b) still unread — so if the partner
  // sent a kiss/nudge while I was offline, the animation fires when I open
  // the chat, right as I "see" it. Each message plays at most once per session.
  useEffect(() => {
    if (messages.length === 0 || !me) return;
    const now = Date.now();
    const candidates = messages.filter((m) => {
      if (m.sender_id === me.id) return false;
      if (m.type !== "kiss" && m.type !== "nudge") return false;
      if (playedFxRef.current.has(m.id)) return false;
      const fresh = now - new Date(m.created_at).getTime() <= 15000;
      const unseen = !m.read_at;
      return fresh || unseen;
    });
    if (candidates.length === 0) return;

    // Stagger kiss showers; nudge shakes only fire once even if there are many.
    let delay = 0;
    let nudgePlayed = false;
    for (const m of candidates) {
      playedFxRef.current.add(m.id);
      lastFxIdRef.current = m.id;
      if (m.type === "kiss") {
        const emoji = m.content || "💜";
        window.setTimeout(() => {
          setKissEmoji(emoji);
          setKissTick((t) => t + 1);
          if ("vibrate" in navigator) navigator.vibrate?.(60);
        }, delay);
        delay += 450;
      } else if (m.type === "nudge" && !nudgePlayed) {
        nudgePlayed = true;
        window.setTimeout(() => {
          setShake(true);
          if ("vibrate" in navigator) navigator.vibrate?.([80, 40, 80]);
          window.setTimeout(() => setShake(false), 800);
        }, delay);
        delay += 350;
      }
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
    <div className={`relative flex flex-col h-screen ${shake ? "animate-chat-shake" : ""}`}>
      <header className="relative px-4 pt-6 pb-3 flex items-center gap-2 border-b border-border bg-velvet sticky top-0 z-10">
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
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="font-serif italic text-lg leading-tight truncate">{peerDisplay}</h1>
              {isPartner && streakDays > 0 && (
                <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-petal/15 text-[10px] text-petal font-bold border border-petal/25">
                  <Flame className="size-2.5" />
                  {streakDays}
                </span>
              )}
            </div>
            <p className="text-[10px] text-petal flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${partnerOnline ? "bg-green-400" : "bg-candle-muted"}`} />
              {partnerTyping ? "typing…" : formatLastSeen(peer.last_seen_at, partnerOnline)}
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

      {isPartner && (sharedMedia.length > 0 || daysTogether > 0) && (
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-petal/5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
            {sharedMedia.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => jumpTo(m.id)}
                className="size-9 shrink-0 rounded-lg bg-surface border border-petal/20 overflow-hidden hover:border-petal/50 transition-colors"
                title="Jump to media"
              >
                {m.media_url && m.type === "image" ? (
                  <img src={m.media_url} alt="" className="size-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center text-[13px]">🎬</div>
                )}
              </button>
            ))}
            {sharedMedia.length === 0 && (
              <span className="text-[10px] text-candle-muted italic px-1">No shared photos yet — send one 💫</span>
            )}
          </div>
          {daysTogether > 0 && (
            <div className="pl-2.5 ml-1 border-l border-petal/15 flex flex-col items-end shrink-0">
              <span className="text-[9px] text-candle-muted uppercase font-bold tracking-wider flex items-center gap-1">
                <HeartIcon className="size-2.5 text-petal" /> Together
              </span>
              <span className="text-[11px] font-semibold text-petal">{daysTogether}d</span>
            </div>
          )}
        </div>
      )}


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
        {!loading && hasMore && (
          <div className="flex justify-center pb-3">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="px-3 py-1.5 rounded-full bg-surface border border-border text-xs text-candle-muted hover:text-petal disabled:opacity-60"
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}
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
          const curDay = new Date(m.created_at).toDateString();
          const prevDay = prev ? new Date(prev.created_at).toDateString() : null;
          const showDivider = curDay !== prevDay;
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          const label = curDay === today ? "Today" : curDay === yesterday ? "Yesterday" :
            new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <div key={m.id}>
              {showDivider && (
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 rounded-full bg-surface/60 border border-border text-[10px] text-candle-muted tracking-widest uppercase font-bold">
                    {label}
                  </span>
                </div>
              )}
              <div
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

      {showScrollFab && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to latest"
          className="absolute right-4 bottom-40 size-10 rounded-full bg-surface-elevated/90 backdrop-blur-md border border-petal/30 flex items-center justify-center text-petal shadow-lg animate-fade-in z-20"
        >
          <ArrowDownIcon className="size-4" />
        </button>
      )}

      <div className="px-3 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar border-t border-border/40 bg-velvet">
        {["Miss you 💜", "Call?", "Omw!", "Hahaha", "Goodnight 🌙"].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => { void send({ content: q, type: "text" }); }}
            className="shrink-0 px-3 py-1.5 rounded-full bg-surface border border-border text-[11px] font-medium text-candle hover:border-petal/40 hover:text-petal transition-colors"
          >
            {q}
          </button>
        ))}
      </div>


      <ChatComposer
        meId={me.id}
        partnerName={peerDisplay}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onTyping={sendTyping}
        onSend={send}
        locked={null}
        lockedHint={null}


      />
      <KissOverlay trigger={kissTick} emoji={kissEmoji} />
      <UnlockCelebration trigger={unlockTick || null} />

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
