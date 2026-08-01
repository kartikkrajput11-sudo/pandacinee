import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Phone, Video, Pin, ChevronDown, Lock, Flame, ArrowDown, MoreVertical, Trash2, Images } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useChat } from "@/hooks/useChat";
import { usePunishmentLock } from "@/hooks/usePunishmentLock";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { formatLastSeen } from "@/hooks/usePresenceHeartbeat";
import { ChatSearch } from "@/components/chat/ChatSearch";

import { KissOverlay } from "@/components/chat/KissOverlay";
import { HeartbeatOverlay } from "@/components/chat/HeartbeatOverlay";
import { DuetCanvas } from "@/components/chat/DuetCanvas";
import { moodById } from "@/lib/rituals";

import { HugOverlay } from "@/components/chat/HugOverlay";
import { HeadpatOverlay } from "@/components/chat/HeadpatOverlay";
import { HandholdOverlay } from "@/components/chat/HandholdOverlay";
import { BoopOverlay } from "@/components/chat/BoopOverlay";
import { SlapOverlay } from "@/components/chat/SlapOverlay";
import { AngerOverlay } from "@/components/chat/AngerOverlay";
import { TickleOverlay } from "@/components/chat/TickleOverlay";
import { WinkOverlay } from "@/components/chat/WinkOverlay";
import { PunishmentLockDialog } from "@/components/chat/PunishmentLockDialog";
import { PunishmentLockOverlay } from "@/components/chat/PunishmentLockOverlay";
import { PunishmentLockBanner } from "@/components/chat/PunishmentLockBanner";
import { PunishmentVerificationChat } from "@/components/chat/PunishmentVerificationChat";
import { usePunishmentVerification } from "@/hooks/usePunishmentVerification";
import { UnlockCelebration } from "@/components/chat/UnlockCelebration";
import { loadSeenFx, saveSeenFx } from "@/lib/seen-affections";
import { typeMeta } from "@/lib/punishment";
import { UserAvatar } from "@/components/UserAvatar";
import { ForwardDialog, canForward } from "@/components/chat/ForwardDialog";
import { SharedMediaDrawer } from "@/components/chat/SharedMediaDrawer";
import { ScheduleDialog } from "@/components/chat/ScheduleDialog";
import { Chat3DPhoneDemo } from "@/components/chat/Chat3DPhoneDemo";
import { markDmReadNow } from "@/lib/dmRead";



import type { MessageRow } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/app/chat/$peerId")({
  head: () => ({
    meta: [
      { title: "Private Chat — PANDACINE" },
      { name: "description", content: "Chat privately on PANDACINE with voice notes, stickers, reactions, and 3D chat previews." },
      { property: "og:title", content: "Private Chat — PANDACINE" },
      { property: "og:description", content: "Chat privately on PANDACINE with voice notes, stickers, reactions, and 3D chat previews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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

  const { messages, loading, loadingOlder, hasMore, loadOlder, partnerTyping, partnerOnline, send, react, togglePin, remove, setVanish, sendTyping, clearChat } =
    useChat(me?.id ?? null, peer?.id ?? null);
  const { activeLock, iAmLocked, iAmLocker, createLock, incrementProgress, completeLock, cancelLock } =
    usePunishmentLock(me?.id ?? null, peer?.id ?? null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState("");
  const [showPinned, setShowPinned] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<MessageRow | null>(null);
  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false);
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
    const anniv = me?.anniversary_date ?? me?.paired_at ?? null;
    const first = messages[0]?.created_at;
    const baseISO = anniv ?? first;
    const days = baseISO ? Math.max(1, Math.floor((Date.now() - new Date(baseISO).getTime()) / 86400000)) : 0;
    return { streakDays: streak, sharedMedia: media, daysTogether: days };
  }, [messages, me?.anniversary_date, me?.paired_at]);


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
  const [hugTick, setHugTick] = useState(0);
  const [headpatTick, setHeadpatTick] = useState(0);
  const [handholdTick, setHandholdTick] = useState(0);
  const [boopTick, setBoopTick] = useState(0);
  const [slapTick, setSlapTick] = useState(0);
  const [angerTick, setAngerTick] = useState(0);
  const [tickleTick, setTickleTick] = useState(0);
  const [winkTick, setWinkTick] = useState(0);
  const [heartbeatTick, setHeartbeatTick] = useState(0);
  const [moodTint, setMoodTint] = useState<string | null>(null);
  const [duetOpen, setDuetOpen] = useState(false);
  useEffect(() => {
    const open = () => setDuetOpen(true);
    window.addEventListener("pandacine:open-duet", open);
    return () => window.removeEventListener("pandacine:open-duet", open);
  }, []);


  const [shake, setShake] = useState(false);
  const lastFxIdRef = useRef<string | null>(null);
  const playedFxRef = useRef<Set<string>>(new Set());
  const seenFxLoadedFor = useRef<string | null>(null);

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
  const stickToBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    const firstId = messages[0].id;
    const lastId = messages[messages.length - 1].id;
    const prevFirst = prevFirstIdRef.current;
    const prevLast = prevLastIdRef.current;
    if (prevFirst && firstId !== prevFirst && lastId === prevLast) {
      // older prepended — keep viewport anchored on what user was reading
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop = el.scrollTop + delta;
    } else if (!prevLast || lastId !== prevLast) {
      // new message at bottom (or first load) — scroll to bottom
      const lastMsg = messages[messages.length - 1];
      const iSent = lastMsg?.sender_id === me?.id;
      if (!prevLast || iSent || stickToBottomRef.current) {
        const doScroll = () => el.scrollTo({ top: el.scrollHeight, behavior: prevLast ? "smooth" : "auto" });
        doScroll();
        requestAnimationFrame(doScroll);
        setTimeout(doScroll, 120);
        setTimeout(doScroll, 400);
      }
    }
    prevFirstIdRef.current = firstId;
    prevLastIdRef.current = lastId;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages, partnerTyping, me?.id]);

  // Follow late-growing content (images/videos finishing layout) while pinned to bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c as Element));
    return () => ro.disconnect();
  }, [messages.length]);

  // Auto-load older when user scrolls near the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop < 80 && hasMore && !loadingOlder && !loading) {
        prevScrollHeightRef.current = el.scrollHeight;
        loadOlder();
      }
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingOlder, loading, loadOlder]);


  // Locally mark this thread as read whenever the last message id changes,
  // so the unread badge on /app/chat clears even when the user has
  // read receipts disabled (in which case messages.read_at is never written).
  const lastMsgId = messages[messages.length - 1]?.id ?? null;
  useEffect(() => {
    if (!me?.id || !peer?.id) return;
    markDmReadNow(me.id, peer.id);
  }, [me?.id, peer?.id, lastMsgId]);


  // Trigger kiss / nudge FX for partner messages. Plays only for affections the
  // user has never seen before: freshly arrived (< 15s old) or still unread and
  // not already played on a previous visit. The played set is persisted per
  // thread so reopening the chat never replays an old animation.
  useEffect(() => {
    if (messages.length === 0 || !me || !peer?.id) return;
    const threadKey = `${me.id}:${peer.id}`;
    if (seenFxLoadedFor.current !== threadKey) {
      playedFxRef.current = loadSeenFx(me.id, peer.id);
      seenFxLoadedFor.current = threadKey;
    }
    const now = Date.now();
    const candidates = messages.filter((m) => {
      if (m.sender_id === me.id) return false;
      const fxTypes = ["kiss", "nudge", "hug", "headpat", "handhold", "boop", "slap", "anger", "tickle", "wink"];
      if (!fxTypes.includes(m.type)) return false;
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
      } else if (m.type === "hug") {
        window.setTimeout(() => {
          setHugTick((t) => t + 1);
          if ("vibrate" in navigator) navigator.vibrate?.([40, 30, 40, 30, 40]);
        }, delay);
        delay += 500;
      } else if (m.type === "headpat") {
        window.setTimeout(() => {
          setHeadpatTick((t) => t + 1);
          if ("vibrate" in navigator) navigator.vibrate?.([25, 40, 25, 40, 25]);
        }, delay);
        delay += 480;
      } else if (m.type === "handhold") {
        window.setTimeout(() => {
          setHandholdTick((t) => t + 1);
          if ("vibrate" in navigator) navigator.vibrate?.([30, 60, 30]);
        }, delay);
        delay += 480;
      } else if (m.type === "boop") {
        window.setTimeout(() => {
          setBoopTick((t) => t + 1);
          if ("vibrate" in navigator) navigator.vibrate?.([15, 30, 15]);
        }, delay);
        delay += 400;
      } else if (m.type === "slap") {
        window.setTimeout(() => setSlapTick((t) => t + 1), delay);
        delay += 600;
      } else if (m.type === "anger") {
        window.setTimeout(() => setAngerTick((t) => t + 1), delay);
        delay += 550;
      } else if (m.type === "tickle") {
        window.setTimeout(() => setTickleTick((t) => t + 1), delay);
        delay += 520;
      } else if (m.type === "wink") {
        window.setTimeout(() => setWinkTick((t) => t + 1), delay);
        delay += 420;
      } else if (m.type === "heartbeat") {
        window.setTimeout(() => setHeartbeatTick((t) => t + 1), delay);
        delay += 520;
      } else if (m.type === "mood") {
        const id = (m.media_meta as any)?.mood;
        if (typeof id === "string") setMoodTint(id);

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
    saveSeenFx(me.id, peer.id, playedFxRef.current);
  }, [messages, me, peer?.id]);


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
      <header className="relative px-5 pt-7 pb-4 flex items-center gap-4 border-b border-border bg-velvet/90 backdrop-blur-md sticky top-0 z-10">
        <Link to="/app/chat" className="text-candle/60 hover:text-candle transition-colors shrink-0">
          <ArrowLeft className="size-5" strokeWidth={1.5} />
        </Link>
        <Link
          to="/app/user/$userId"
          params={{ userId: peer.id }}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition-opacity"
        >
          <div className="size-10 rounded-full bg-gradient-to-tr from-petal to-candle/90 p-[1.5px] shrink-0">
            <UserAvatar src={peer.avatar_url} name={peerDisplay} className="size-full" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif italic text-[19px] leading-none text-candle truncate">{peerDisplay}</h1>
            <div className="mt-1 flex items-center gap-1.5 min-w-0">
              {(() => {
                const peerHidden = (peer as any).activity_visible === false;
                const showOnline = !peerHidden && partnerOnline;
                const statusText = partnerTyping
                  ? "typing…"
                  : peerHidden
                    ? "activity hidden"
                    : formatLastSeen(peer.last_seen_at, partnerOnline);
                return (
                  <>
                    <span className={`size-1.5 rounded-full shrink-0 ${showOnline ? "bg-petal" : "bg-candle/25"}`} />
                    <span className="text-[9px] uppercase tracking-[0.15em] text-candle/40 font-medium truncate">
                      {statusText}
                    </span>
                  </>
                );
              })()}
              {isPartner && (
                <>
                  <span className="text-[9px] text-candle/20">·</span>
                  <span className="text-[9px] uppercase tracking-[0.15em] text-petal font-semibold shrink-0">Partner</span>
                </>
              )}
              {isPartner && streakDays > 0 && (
                <>
                  <span className="text-[9px] text-candle/20">·</span>
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] uppercase tracking-[0.15em] text-petal font-semibold">
                    <Flame className="size-2.5" strokeWidth={2} />
                    {streakDays}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-4 text-candle/55 shrink-0">
          <ChatSearch messages={messages} onJump={jumpTo} />
          <Chat3DPhoneDemo meName={me.display_name} peerName={peerDisplay} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hover:text-petal transition-colors" aria-label="Call">
                <Phone className="size-[18px]" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-velvet border-candle/20">
              <DropdownMenuItem asChild className="gap-2 focus:bg-petal/10 focus:text-petal">
                <Link to="/app/call/$peerId" params={{ peerId: peer.id }} search={{ role: "caller", mode: "audio" }}>
                  <Phone className="size-4" /> Voice call
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 focus:bg-petal/10 focus:text-petal">
                <Link to="/app/call/$peerId" params={{ peerId: peer.id }} search={{ role: "caller", mode: "video" }}>
                  <Video className="size-4" /> Video call
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isPartner && !activeLock && (me as any).punishment_lock_enabled !== false && (peer as any).punishment_lock_enabled !== false && (
            <button
              onClick={() => setLockDialogOpen(true)}
              className="hover:text-petal transition-colors"
              title="Lock chat as punishment"
              aria-label="Lock chat as punishment"
            >
              <Lock className="size-[18px]" strokeWidth={1.5} />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hover:text-petal transition-colors" aria-label="Chat options">
                <MoreVertical className="size-[18px]" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-velvet border-candle/20">
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setMediaDrawerOpen(true); }}
                className="text-candle focus:text-petal focus:bg-petal/10 gap-2"
              >
                <Images className="size-4" /> Shared media
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setClearConfirmOpen(true); }}
                className="text-petal focus:text-petal focus:bg-petal/10 gap-2"
              >
                <Trash2 className="size-4" /> Clear chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent className="bg-velvet border-candle/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif italic text-candle">Clear this chat?</AlertDialogTitle>
            <AlertDialogDescription className="text-candle/60">
              All messages between you and {peerDisplay} will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { await clearChat(); setClearConfirmOpen(false); }}
              className="bg-petal text-velvet hover:bg-petal/90"
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {isPartner && daysTogether > 0 && (
        <div className="px-6 py-2.5 border-b border-border bg-petal/[0.04] flex items-center justify-center gap-5">
          <span className="text-[9px] uppercase tracking-[0.3em] text-petal/80 font-semibold">
            Together · {daysTogether}d
          </span>
          <span className="h-3 w-px bg-petal/20" />
          <button
            type="button"
            onClick={() => setMediaDrawerOpen(true)}
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.3em] text-candle/60 hover:text-petal transition-colors font-semibold"
          >
            <Images className="size-3" />
            Shared Media
            {sharedMedia.length > 0 && (
              <span className="text-petal/80">· {sharedMedia.length}</span>
            )}
          </button>
        </div>
      )}

      <SharedMediaDrawer
        open={mediaDrawerOpen}
        onOpenChange={setMediaDrawerOpen}
        messages={messages}
        onJumpTo={jumpTo}
      />



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

      <div ref={scrollRef} className="smooth-scroll flex-1 overflow-y-auto px-2 py-4">
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
                  onForward={canForward(m) ? setForwardMsg : undefined}
                  partnerName={peerDisplay}

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





      <ChatComposer
        meId={me.id}
        partnerName={peerDisplay}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onTyping={sendTyping}
        onSend={send}
        locked={null}
        lockedHint={null}
        onSchedule={(draft) => { setScheduleDraft(draft); setScheduleOpen(true); }}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        meId={me.id}
        target={{ receiver_id: peer.id }}
        initialText={scheduleDraft}
      />
      <KissOverlay trigger={kissTick} />
      <HugOverlay trigger={hugTick} />
      <HeadpatOverlay trigger={headpatTick} />
      <HandholdOverlay trigger={handholdTick} />
      <BoopOverlay trigger={boopTick} />
      <SlapOverlay trigger={slapTick} />
      <AngerOverlay trigger={angerTick} />
      <TickleOverlay trigger={tickleTick} />
      <WinkOverlay trigger={winkTick} />
      <HeartbeatOverlay trigger={heartbeatTick} />
      {moodTint && (
        <div
          className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000"
          style={{ background: `radial-gradient(circle at 50% 0%, hsl(${moodById(moodTint)?.hue ?? "342 68% 62%"} / 0.14), transparent 65%)` }}
        />
      )}
      {me && peer && (
        <DuetCanvas
          open={duetOpen}
          onClose={() => setDuetOpen(false)}
          meId={me.id}
          roomKey={[me.id, peer.id].sort().join(":")}
          partnerName={peerDisplay}
        />
      )}

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

      <ForwardDialog
        message={forwardMsg}
        open={!!forwardMsg}
        onClose={() => setForwardMsg(null)}
      />
    </div>
  );
}
