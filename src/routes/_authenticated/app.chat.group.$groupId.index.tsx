import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Settings, Phone, Video as VideoIcon, Send, Image as ImageIcon,
  Pin, Trash2, Reply, X, PinOff, BarChart3, Forward, Swords, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { useGroup } from "@/hooks/useGroups";
import { useGroupChat, type GroupMessage } from "@/hooks/useGroupChat";
import { supabase } from "@/integrations/supabase/client";
import { uploadChatMedia, signMedia } from "@/lib/chat";
import { startGroupCall } from "@/lib/callActions";
import { UserAvatar } from "@/components/UserAvatar";
import { PollComposer } from "@/components/chat/PollComposer";
import { PollMessage } from "@/components/chat/PollMessage";
import { ForwardDialog } from "@/components/chat/ForwardDialog";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { VoicePlayer } from "@/components/chat/VoicePlayer";
import { DuelGamePicker } from "@/components/chat/DuelGamePicker";
import { GroupEventComposer } from "@/components/chat/GroupEventComposer";
import { GroupEventCard } from "@/components/chat/GroupEventCard";
import { GroupMatchInviteCard } from "@/components/chat/GroupMatchInviteCard";
import { createGroupMatch } from "@/hooks/useGroupMatch";
import type { PollMeta } from "@/lib/poll";
import type { MessageRow } from "@/lib/chat";

const QUICK_REACTIONS = ["❤️", "😂", "🥺", "🔥", "🐼", "👍"];

export const Route = createFileRoute("/_authenticated/app/chat/group/$groupId/")({
  component: GroupChat,
});

function GroupChat() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const meId = profileData?.profile?.id ?? null;
  const partnerId = profileData?.partner?.id ?? null;
  const { data: groupData } = useGroup(groupId);
  const chat = useGroupChat(groupId, meId);

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [openBubbleId, setOpenBubbleId] = useState<string | null>(null);
  const [bubbleClosing, setBubbleClosing] = useState(false);
  const bubbleIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeBubble = () => {
    if (bubbleIdleRef.current) { clearTimeout(bubbleIdleRef.current); bubbleIdleRef.current = null; }
    if (bubbleCloseRef.current) return;
    setBubbleClosing(true);
    bubbleCloseRef.current = setTimeout(() => {
      setOpenBubbleId(null);
      setBubbleClosing(false);
      bubbleCloseRef.current = null;
    }, 220);
  };
  const armBubbleIdle = () => {
    if (bubbleIdleRef.current) clearTimeout(bubbleIdleRef.current);
    bubbleIdleRef.current = setTimeout(() => closeBubble(), 2000);
  };
  useEffect(() => {
    if (openBubbleId && !bubbleClosing) armBubbleIdle();
    return () => { if (bubbleIdleRef.current) { clearTimeout(bubbleIdleRef.current); bubbleIdleRef.current = null; } };
  }, [openBubbleId, bubbleClosing]);
  const [sending, setSending] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [duelOpen, setDuelOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<MessageRow | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const heartPopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [heartPopId, setHeartPopId] = useState<string | null>(null);

  // Unmount cleanup for all pending timers
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (bubbleIdleRef.current) clearTimeout(bubbleIdleRef.current);
      if (bubbleCloseRef.current) clearTimeout(bubbleCloseRef.current);
      if (heartPopTimer.current) clearTimeout(heartPopTimer.current);
    };
  }, []);

  const group = groupData?.group;
  const members = groupData?.members ?? [];
  const isAdmin = members.find((m) => m.user_id === meId)?.role === "admin";
  const theme = group?.theme ?? "aurora";
  const bgPath = (group as any)?.background_url as string | null | undefined;
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!bgPath) { setBgUrl(null); return; }
    supabase.storage.from("group-backgrounds").createSignedUrl(bgPath, 60 * 60).then(({ data }) => {
      if (alive) setBgUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [bgPath]);

  const memberById = useMemo(() => {
    const m = new Map<string, { display_name: string; avatar_url: string | null }>();
    members.forEach((mem) => {
      if (mem.profile) m.set(mem.user_id, { display_name: mem.profile.display_name, avatar_url: mem.profile.avatar_url });
    });
    return m;
  }, [members]);

  const pinned = chat.messages.filter((m) => m.pinned_at).slice(-3);

  // reactions grouped by message
  const reactionsByMsg = useMemo(() => {
    const map = new Map<string, Record<string, string[]>>();
    for (const r of chat.reactions) {
      const bag = map.get(r.message_id) ?? {};
      bag[r.emoji] = [...(bag[r.emoji] ?? []), r.user_id];
      map.set(r.message_id, bag);
    }
    return map;
  }, [chat.reactions]);

  const lastMessageId = chat.messages[chat.messages.length - 1]?.id ?? null;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [lastMessageId]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await chat.send({ content: trimmed, type: "text", reply_to_id: replyTo?.id ?? null });
      setText("");
      setReplyTo(null);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  async function handleImage(file: File) {
    if (!meId) return;
    try {
      const path = await uploadChatMedia(file, meId, "image", file.name.split(".").pop() || "jpg");
      await chat.send({ content: "📷 Photo", type: "image", media_url: path, reply_to_id: replyTo?.id ?? null });
      setReplyTo(null);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    }
  }

  async function handleVoice(path: string, durationMs: number) {
    try {
      await chat.send({
        content: "🎙 Voice message",
        type: "voice",
        media_url: path,
        media_meta: { duration_ms: durationMs },
        reply_to_id: replyTo?.id ?? null,
      });
      setReplyTo(null);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't send voice");
    }
  }

  async function handleLaunchDuel(g: { id: string; name: string; emoji: string; maxPlayers?: number }) {
    setDuelOpen(false);
    try {
      const match = await createGroupMatch(groupId, g.id, g.maxPlayers ?? 2);
      await chat.send({
        content: `${g.name} — take a seat`,
        type: "match_invite",
        media_meta: { match_id: match.id, game: g.id, game_name: g.name, emoji: g.emoji, max_players: g.maxPlayers ?? 2 },
      });
      navigate({ to: "/app/group-match/$matchId", params: { matchId: match.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't start match");
    }
  }

  async function handleEventCreated(ev: { id: string; title: string }) {
    try {
      await chat.send({
        content: ev.title,
        type: "event",
        media_meta: { event_id: ev.id },
      });
    } catch (e: any) {
      toast.error(e.message ?? "Event created but couldn't post card");
    }
  }

  async function startCall(kind: "voice" | "video") {
    try {
      const c = await startGroupCall(groupId, kind);
      navigate({
        to: "/app/call/group/$groupId",
        params: { groupId },
        search: { callId: c.id, role: "caller", mode: kind },
      });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't start call");
    }
  }

  if (!group) {
    return <div className="p-6 text-candle-muted">Loading group…</div>;
  }

  return (
    <div className="flex flex-col h-[100dvh] relative isolate" data-group-theme={theme}>
      {bgUrl && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgUrl})` }}
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-velvet/70 backdrop-blur-sm" />
        </>
      )}
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/70 backdrop-blur">
        <Link to="/app/chat" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <Link
          to="/app/chat/group/$groupId/info"
          params={{ groupId }}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <div className="size-10 rounded-full bg-muted flex items-center justify-center text-xl border border-border">
            {group.avatar_url || "💜"}
          </div>
          <div className="min-w-0">
            <p className="font-serif italic text-base truncate">{group.name}</p>
            <p className="text-[10px] text-candle-muted">{members.length} members</p>
          </div>
        </Link>
        <button onClick={() => startCall("voice")} className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-foreground/80 hover:text-foreground" aria-label="Voice call">
          <Phone className="size-4" />
        </button>
        <button onClick={() => startCall("video")} className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-foreground/80 hover:text-foreground" aria-label="Video call">
          <VideoIcon className="size-4" />
        </button>

        <Link
          to="/app/chat/group/$groupId/settings"
          params={{ groupId }}
          className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </Link>
      </header>

      {/* Pinned banner */}
      {pinned.length > 0 && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs text-candle-muted flex items-center gap-2 overflow-x-auto">
          <Pin className="size-3 text-foreground/70 shrink-0" />

          {pinned.map((m) => (
            <span key={m.id} className="truncate max-w-[220px] italic">
              {m.type === "image" ? "📷 Photo" : m.content}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="smooth-scroll flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {chat.loading && <div className="text-center text-candle-muted text-sm py-8">Loading…</div>}
        {!chat.loading && chat.messages.length === 0 && (
          <div className="text-center text-candle-muted text-sm py-16">
            Say hi to your circle 🐼
          </div>
        )}
        {chat.messages.map((m) => {
          const mine = m.sender_id === meId;
          const fromPartner = !mine && partnerId && m.sender_id === partnerId;
          const sender = memberById.get(m.sender_id);
          const replyMsg = m.reply_to_id ? chat.messages.find((x) => x.id === m.reply_to_id) : null;
          const rx = reactionsByMsg.get(m.id) ?? {};
          const canDelete = mine || isAdmin;
          const canPin = isAdmin;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && (
                <UserAvatar
                  src={sender?.avatar_url}
                  name={sender?.display_name}
                  className="size-8"
                  ringed={!!fromPartner}
                  userId={m.sender_id}
                />
              )}
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {!mine && (
                  <p className={`text-[10px] mb-0.5 px-1 flex items-center gap-1 ${fromPartner ? "text-petal font-semibold" : "text-petal/80"}`}>
                    {sender?.display_name ?? "…"}
                    {fromPartner && <span className="text-[9px]">💜</span>}
                  </p>
                )}
                <div
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    longPressTimer.current = setTimeout(() => {
                      setOpenBubbleId(m.id);
                      if (navigator.vibrate) navigator.vibrate(15);
                    }, 550);
                  }}
                  onPointerUp={(e) => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
                    const now = Date.now();
                    if (lastTapRef.current.id === m.id && now - lastTapRef.current.at < 320) {
                      lastTapRef.current = { id: "", at: 0 };
                      chat.toggleReaction(m.id, "❤️");
                      setHeartPopId(m.id);
                      if (navigator.vibrate) navigator.vibrate(15);
                      setTimeout(() => setHeartPopId((v) => (v === m.id ? null : v)), 700);
                    } else {
                      lastTapRef.current = { id: m.id, at: now };
                    }
                  }}
                  onPointerLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  onPointerCancel={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  onContextMenu={(e) => { e.preventDefault(); setOpenBubbleId(m.id); }}
                  className={`relative ${["poll","match_invite","event"].includes(m.type) ? "p-0 bg-transparent" : "px-3 py-2"} rounded-2xl text-sm select-none break-words transition ${
                    ["poll","match_invite","event"].includes(m.type)
                      ? ""
                      : mine
                        ? "bg-petal text-velvet rounded-br-sm"
                        : fromPartner
                          ? "bg-petal-soft border border-petal rounded-bl-sm shadow-[0_0_18px_2px_hsl(var(--petal)/0.55),0_0_38px_6px_hsl(var(--petal)/0.28)] animate-partner-glow"
                          : "bg-surface border border-border rounded-bl-sm"
                  } ${m.pinned_at ? "ring-1 ring-petal/40" : ""}`}
                >
                  {replyMsg && (
                    <div className={`mb-1 pl-2 border-l-2 ${mine ? "border-velvet/40" : "border-petal/40"} text-[11px] opacity-80 truncate`}>
                      {memberById.get(replyMsg.sender_id)?.display_name ?? "…"}: {replyMsg.type === "image" ? "📷 Photo" : replyMsg.content}
                    </div>
                  )}
                  {m.type === "image" && m.media_url ? (
                    <GroupImage path={m.media_url} />
                  ) : m.type === "voice" && m.media_url ? (
                    <VoicePlayer path={m.media_url} durationMs={(m.media_meta as any)?.duration_ms} />
                  ) : m.type === "poll" ? (
                    <PollMessage
                      messageId={m.id}
                      meta={m.media_meta}
                      meId={meId}
                      memberById={memberById}
                    />
                  ) : m.type === "match_invite" ? (
                    <GroupMatchInviteCard m={m as unknown as MessageRow} />
                  ) : m.type === "event" ? (
                    <GroupEventCard eventId={(m.media_meta as any)?.event_id} meId={meId} mine={mine} />
                  ) : (
                    <span>{m.content}</span>
                  )}
                  {heartPopId === m.id && (
                    <span className="pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center text-2xl animate-reaction-drop" aria-hidden>
                      ❤️
                    </span>
                  )}
                </div>

                {/* Reactions */}
                {Object.keys(rx).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 px-1">
                    {Object.entries(rx).map(([emoji, uids]) => (
                      <button
                        key={emoji}
                        onClick={() => chat.toggleReaction(m.id, emoji)}
                        className={`animate-reaction-chip transition-transform duration-150 hover:scale-110 active:scale-95 text-[11px] px-1.5 py-0.5 rounded-full border ${
                          meId && uids.includes(meId) ? "bg-petal-soft border-petal/40" : "bg-surface border-border"
                        }`}
                      >
                        {emoji} {uids.length}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Long-press action overlay */}
      {openBubbleId && (() => {
        const m = chat.messages.find((x) => x.id === openBubbleId);
        if (!m) return null;
        const mine = m.sender_id === meId;
        const sender = memberById.get(m.sender_id);
        const canDelete = mine || isAdmin;
        const canPin = isAdmin;
        const canForward = ["text","image","video","voice","file","sticker"].includes(m.type);
        return (
          <div
            className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 px-6 ${bubbleClosing ? "animate-fade-out" : "animate-fade-in"}`}
            style={{ backdropFilter: "blur(14px) saturate(140%)", WebkitBackdropFilter: "blur(14px) saturate(140%)" as any, background: "rgba(0,0,0,0.55)" }}
            onClick={() => closeBubble()}
            onMouseMove={armBubbleIdle}
            onTouchStart={armBubbleIdle}
          >
            <div
              className="flex gap-1 items-center px-3 py-2 rounded-full bg-surface/95 border border-border shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => { chat.toggleReaction(m.id, e); closeBubble(); }}
                  className="size-10 rounded-full hover:bg-muted flex items-center justify-center text-xl transition hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>

            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm animate-scale-in ${mine ? "bg-petal text-velvet" : "bg-surface border border-border"}`}
              onClick={(e) => e.stopPropagation()}
            >
              {!mine && <p className="text-[10px] mb-1 opacity-70">{sender?.display_name}</p>}
              {m.type === "image" && m.media_url ? <GroupImage path={m.media_url} /> :
               m.type === "voice" ? <span className="opacity-80">🎙️ Voice message</span> :
               m.type === "poll" ? <span className="opacity-80">📊 Poll</span> :
               m.type === "event" ? <span className="opacity-80">📅 Event</span> :
               m.type === "match_invite" ? <span className="opacity-80">⚔️ Match invite</span> :
               <span className="break-words">{m.content}</span>}
            </div>

            <div
              className="w-full max-w-xs rounded-2xl bg-surface/95 border border-border shadow-2xl overflow-hidden animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setReplyTo(m); closeBubble(); }}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted text-sm"
              >
                <span>Reply</span><Reply className="size-4 text-muted-foreground" />
              </button>
              {canForward && (
                <button
                  onClick={() => { setForwardMsg(m as unknown as MessageRow); closeBubble(); }}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted text-sm border-t border-border"
                >
                  <span>Forward</span><Forward className="size-4 text-muted-foreground" />
                </button>
              )}
              {m.type === "text" && m.content && (
                <button
                  onClick={() => { navigator.clipboard.writeText(m.content ?? ""); toast.success("Copied"); closeBubble(); }}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted text-sm border-t border-border"
                >
                  <span>Copy</span>
                </button>
              )}
              {canPin && (
                <button
                  onClick={() => { chat.pin(m.id, !m.pinned_at); closeBubble(); }}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted text-sm border-t border-border"
                >
                  <span>{m.pinned_at ? "Unpin" : "Pin"}</span>
                  {m.pinned_at ? <PinOff className="size-4 text-muted-foreground" /> : <Pin className="size-4 text-muted-foreground" />}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={async () => {
                    if (!confirm("Delete this message for everyone?")) return;
                    try { await chat.deleteForEveryone(m.id); closeBubble(); }
                    catch (e: any) { toast.error(e.message ?? "Delete failed"); }
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-500/10 text-sm text-red-400 border-t border-border"
                >
                  <span>Delete</span><Trash2 className="size-4" />
                </button>
              )}
            </div>
          </div>
        );
      })()}



      {/* Composer */}
      {replyTo && (
        <div className="px-4 py-2 bg-surface/60 border-t border-border flex items-center gap-2 text-xs">
          <Reply className="size-3 text-muted-foreground" />
          <span className="truncate flex-1 text-candle-muted">
            Replying to <span className="text-candle italic">
              {memberById.get(replyTo.sender_id)?.display_name ?? "…"}
            </span>: {replyTo.type === "image" ? "📷 Photo" : replyTo.content}
          </span>
          <button onClick={() => setReplyTo(null)} className="text-candle-muted"><X className="size-3.5" /></button>
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-3 border-t border-border bg-surface/70">
        {!recording && (
          <>
            <button
              onClick={() => imgRef.current?.click()}
              className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-foreground/80 shrink-0"
              aria-label="Attach image"
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              onClick={() => setPollOpen(true)}
              className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-foreground/80 shrink-0"
              aria-label="Create poll"
            >
              <BarChart3 className="size-4" />
            </button>
            <button
              onClick={() => setEventOpen(true)}
              className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-foreground/80 shrink-0"
              aria-label="Plan an event"
            >
              <Calendar className="size-4" />
            </button>
            <button
              onClick={() => setDuelOpen(true)}
              className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-foreground/80 shrink-0"
              aria-label="Play together"
            >
              <Swords className="size-4" />
            </button>
          </>
        )}
        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImage(f);
            e.target.value = "";
          }}
        />
        {recording ? (
          meId && (
            <VoiceRecorder
              userId={meId}
              onSend={handleVoice}
              onRecordingChange={setRecording}
            />
          )
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Message the circle…"
              rows={1}
              className="flex-1 resize-none bg-surface border border-border rounded-2xl px-4 py-2.5 text-sm text-candle max-h-32"
            />
            {text.trim() ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            ) : (
              meId && (
                <VoiceRecorder
                  userId={meId}
                  onSend={handleVoice}
                  onRecordingChange={setRecording}
                />
              )
            )}
          </>
        )}
      </div>

      <PollComposer
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        meId={meId}
        onCreate={async (meta: PollMeta) => {
          await chat.send({
            content: meta.question,
            type: "poll",
            media_meta: meta as unknown as Record<string, unknown>,
          });
        }}
      />

      <ForwardDialog
        message={forwardMsg}
        open={!!forwardMsg}
        onClose={() => setForwardMsg(null)}
      />

      <DuelGamePicker
        open={duelOpen}
        onClose={() => setDuelOpen(false)}
        onPick={(g) => void handleLaunchDuel(g)}
      />

      <GroupEventComposer
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        groupId={groupId}
        meId={meId}
        onCreated={(ev) => void handleEventCreated(ev)}
      />
    </div>
  );
}

function GroupImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (path.startsWith("http")) {
      setUrl(path);
      return;
    }
    signMedia(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => { alive = false; };
  }, [path]);
  if (!url) return <div className="w-48 h-32 bg-surface animate-pulse rounded-xl" />;
  return <img src={url} alt="" className="max-w-full max-h-80 rounded-xl object-cover" />;
}
