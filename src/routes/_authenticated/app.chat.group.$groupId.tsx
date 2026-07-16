import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Settings, Phone, Video as VideoIcon, Send, Image as ImageIcon,
  Smile, Pin, Trash2, Reply, X, MoreVertical, PinOff, BarChart3,
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
import type { PollMeta } from "@/lib/poll";

const QUICK_REACTIONS = ["❤️", "😂", "🥺", "🔥", "🐼", "👍"];

export const Route = createFileRoute("/_authenticated/app/chat/group/$groupId")({
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
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const group = groupData?.group;
  const members = groupData?.members ?? [];
  const isAdmin = members.find((m) => m.user_id === meId)?.role === "admin";
  const theme = group?.theme ?? "aurora";

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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length]);

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
    <div className="flex flex-col h-[100dvh]" data-group-theme={theme}>
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
          <div className="size-10 rounded-full bg-petal-soft flex items-center justify-center text-xl border border-petal/30">
            {group.avatar_url || "💜"}
          </div>
          <div className="min-w-0">
            <p className="font-serif italic text-base truncate">{group.name}</p>
            <p className="text-[10px] text-candle-muted">{members.length} members</p>
          </div>
        </Link>
        <button onClick={() => startCall("voice")} className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-petal" aria-label="Voice call">
          <Phone className="size-4" />
        </button>
        <button onClick={() => startCall("video")} className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-petal" aria-label="Video call">
          <VideoIcon className="size-4" />
        </button>
        <Link
          to="/app/chat/group/$groupId/info"
          params={{ groupId }}
          className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </Link>
      </header>

      {/* Pinned banner */}
      {pinned.length > 0 && (
        <div className="px-4 py-2 bg-petal-soft/30 border-b border-petal/20 text-xs text-candle-muted flex items-center gap-2 overflow-x-auto">
          <Pin className="size-3 text-petal shrink-0" />
          {pinned.map((m) => (
            <span key={m.id} className="truncate max-w-[220px] italic">
              {m.type === "image" ? "📷 Photo" : m.content}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
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
                  onClick={() => setOpenBubbleId(openBubbleId === m.id ? null : m.id)}
                  className={`px-3 py-2 rounded-2xl text-sm cursor-pointer break-words ${
                    mine
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
                  ) : (
                    <span>{m.content}</span>
                  )}
                </div>

                {/* Reactions */}
                {Object.keys(rx).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 px-1">
                    {Object.entries(rx).map(([emoji, uids]) => (
                      <button
                        key={emoji}
                        onClick={() => chat.toggleReaction(m.id, emoji)}
                        className={`text-[11px] px-1.5 py-0.5 rounded-full border ${
                          meId && uids.includes(meId) ? "bg-petal-soft border-petal/40" : "bg-surface border-border"
                        }`}
                      >
                        {emoji} {uids.length}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action row */}
                {openBubbleId === m.id && (
                  <div className={`mt-1 flex gap-1 items-center flex-wrap ${mine ? "justify-end" : ""}`}>
                    {QUICK_REACTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          chat.toggleReaction(m.id, e);
                          setOpenBubbleId(null);
                        }}
                        className="size-7 rounded-full bg-surface border border-border flex items-center justify-center text-sm"
                      >
                        {e}
                      </button>
                    ))}
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setReplyTo(m); setOpenBubbleId(null); }}
                      className="size-7 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
                      aria-label="Reply"
                    >
                      <Reply className="size-3.5" />
                    </button>
                    {canPin && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); chat.pin(m.id, !m.pinned_at); setOpenBubbleId(null); }}
                        className="size-7 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
                        aria-label={m.pinned_at ? "Unpin" : "Pin"}
                      >
                        {m.pinned_at ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={async (ev) => {
                          ev.stopPropagation();
                          if (!confirm("Delete this message for everyone?")) return;
                          try {
                            await chat.deleteForEveryone(m.id);
                            setOpenBubbleId(null);
                          } catch (e: any) {
                            toast.error(e.message ?? "Delete failed");
                          }
                        }}
                        className="size-7 rounded-full bg-surface border border-border flex items-center justify-center text-red-400"
                        aria-label="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      {replyTo && (
        <div className="px-4 py-2 bg-surface/60 border-t border-border flex items-center gap-2 text-xs">
          <Reply className="size-3 text-petal" />
          <span className="truncate flex-1 text-candle-muted">
            Replying to <span className="text-candle italic">
              {memberById.get(replyTo.sender_id)?.display_name ?? "…"}
            </span>: {replyTo.type === "image" ? "📷 Photo" : replyTo.content}
          </span>
          <button onClick={() => setReplyTo(null)} className="text-candle-muted"><X className="size-3.5" /></button>
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-3 border-t border-border bg-surface/70">
        <button
          onClick={() => imgRef.current?.click()}
          className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal shrink-0"
          aria-label="Attach image"
        >
          <ImageIcon className="size-4" />
        </button>
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
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center shrink-0 disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="size-4" />
        </button>
      </div>
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
