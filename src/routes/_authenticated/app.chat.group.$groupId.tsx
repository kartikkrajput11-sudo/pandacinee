import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, Heart, Users, LogOut, Phone, Video } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { useGroup, useLeaveGroup } from "@/hooks/useGroups";
import { useGroupChat } from "@/hooks/useGroupChat";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { MessageRow } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/app/chat/group/$groupId")({
  component: GroupChat,
});

function GroupChat() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const partnerId = me?.partner_id ?? null;

  const { data: groupData, isLoading: groupLoading } = useGroup(groupId);
  const { messages, loading, loadingOlder, hasMore, loadOlder, send, sendTyping, react, togglePin, remove, setVanish, typingUsers, onlineIds } =
    useGroupChat(me?.id ?? null, groupId);
  const leave = useLeaveGroup();

  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const memberById = useMemo(() => {
    const map: Record<string, { display_name: string; avatar_url: string | null; username: string }> = {};
    (groupData?.members ?? []).forEach((m) => {
      if (m.profile) map[m.user_id] = m.profile;
    });
    return map;
  }, [groupData]);

  const messagesById = useMemo(() => {
    const map: Record<string, MessageRow> = {};
    messages.forEach((m) => (map[m.id] = m));
    return map;
  }, [messages]);

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].sender_id === me?.id) return messages[i].id;
    return null;
  }, [messages, me?.id]);

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
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop = el.scrollTop + delta;
    } else if (!prevLast || lastId !== prevLast) {
      el.scrollTo({ top: el.scrollHeight, behavior: prevLast ? "smooth" : "auto" });
    }
    prevFirstIdRef.current = firstId;
    prevLastIdRef.current = lastId;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop < 80 && hasMore && !loadingOlder && !loading) {
        prevScrollHeightRef.current = el.scrollHeight;
        loadOlder();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingOlder, loading, loadOlder]);

  if (groupLoading || !me) {
    return <div className="flex h-screen items-center justify-center text-candle-muted">Loading…</div>;
  }
  if (!groupData) {
    return (
      <div className="px-5 pt-10">
        <Link to="/app/chat" className="text-petal text-sm">← Back to chats</Link>
        <p className="mt-6 text-candle-muted">Couldn't find that group.</p>
      </div>
    );
  }

  const { group, members } = groupData;
  // sort: partner first, me second, rest by name
  const sortedMembers = [...members].sort((a, b) => {
    if (a.user_id === partnerId) return -1;
    if (b.user_id === partnerId) return 1;
    if (a.user_id === me.id) return -1;
    if (b.user_id === me.id) return 1;
    return (a.profile?.display_name ?? "").localeCompare(b.profile?.display_name ?? "");
  });

  const typingNames = Object.keys(typingUsers)
    .filter((uid) => uid !== me.id)
    .map((uid) => memberById[uid]?.display_name?.split(" ")[0])
    .filter(Boolean);

  async function handleLeave() {
    if (!confirm("Leave this group?")) return;
    try {
      await leave.mutateAsync(group.id);
      toast.success("Left group");
      navigate({ to: "/app/chat" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not leave");
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 pt-6 pb-3 border-b border-border bg-velvet sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Link to="/app/chat" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
          <div className="size-10 rounded-full bg-petal-soft border border-petal/30 flex items-center justify-center text-xl">
            {group.avatar_url || "💜"}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif italic text-lg leading-tight truncate">{group.name}</h1>
            <p className="text-[10px] text-candle-muted flex items-center gap-1">
              <Users className="size-3" />
              {members.length} members
              {onlineIds.length > 1 && (
                <span className="text-petal">· {onlineIds.length} online</span>
              )}
            </p>
          </div>
          <Link
            to="/app/call/group/$groupId"
            params={{ groupId: group.id }}
            search={{ role: "caller", mode: "voice" }}
            className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal"
            aria-label="Group voice call"
          >
            <Phone className="size-4" />
          </Link>
          <Link
            to="/app/call/group/$groupId"
            params={{ groupId: group.id }}
            search={{ role: "caller", mode: "video" }}
            className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal"
            aria-label="Group video call"
          >
            <Video className="size-4" />
          </Link>
          <button
            onClick={handleLeave}
            className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
            aria-label="Leave group"
          >
            <LogOut className="size-4" />
          </button>
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
          {sortedMembers.map((m) => {
            const isPartner = m.user_id === partnerId;
            const isMe = m.user_id === me.id;
            const online = onlineIds.includes(m.user_id);
            return (
              <div
                key={m.user_id}
                className={`shrink-0 flex flex-col items-center gap-0.5 w-14`}
              >
                <div className={`relative size-10 rounded-full bg-petal-soft overflow-hidden flex items-center justify-center ${isPartner ? "ring-2 ring-petal petal-glow" : ""}`}>
                  {m.profile?.avatar_url ? (
                    <img src={m.profile.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="font-serif italic text-petal text-sm">
                      {m.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}
                  {isPartner && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-petal text-velvet flex items-center justify-center">
                      <Heart className="size-2 fill-current" />
                    </span>
                  )}
                  {online && !isPartner && (
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-400 ring-2 ring-velvet" />
                  )}
                </div>
                <span className={`text-[9px] truncate max-w-full ${isPartner ? "text-petal" : "text-candle-muted"}`}>
                  {isMe ? "You" : m.profile?.display_name?.split(" ")[0] ?? "?"}
                </span>
              </div>
            );
          })}
        </div>
      </header>

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
            <p className="font-serif italic text-lg text-candle mb-1">Start whispering 💫</p>
            <p>Say hi to the circle.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showAvatar = !prev || prev.sender_id !== m.sender_id;
          const isLastMine = m.id === lastMineId;
          const isPartner = m.sender_id === partnerId;
          const senderName = memberById[m.sender_id]?.display_name?.split(" ")[0] ?? "Someone";
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id}>
              {!mine && showAvatar && (
                <p className={`px-4 pt-2 pb-0.5 text-[10px] font-semibold ${isPartner ? "text-petal" : "text-candle-muted"}`}>
                  {senderName} {isPartner && "· 💜"}
                </p>
              )}
              <ChatBubble
                m={m}
                mine={mine}
                replyTo={m.reply_to_id ? messagesById[m.reply_to_id] ?? null : null}
                showAvatar={showAvatar}
                isLast={isLastMine}
                isPartner={isPartner && !mine}
                onReact={react}
                onReply={setReplyTo}
                onPin={togglePin}
                onDelete={remove}
                onVanish={setVanish}
              />
            </div>
          );
        })}
        {typingNames.length > 0 && (
          <p className="px-4 pt-2 text-[11px] text-petal italic">
            {typingNames.slice(0, 2).join(", ")} {typingNames.length > 2 ? "and others " : ""}typing…
          </p>
        )}
      </div>

      <ChatComposer
        meId={me.id}
        partnerName={group.name}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onTyping={sendTyping}
        onSend={send}
      />
    </div>
  );
}
