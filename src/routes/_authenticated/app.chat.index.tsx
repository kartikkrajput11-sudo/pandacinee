import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, MessageCircle, Heart, Users, Plus, UsersRound, KeyRound, X, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useChatThreads } from "@/hooks/useChatThreads";
import { useProfile } from "@/hooks/useProfile";
import { useGroups } from "@/hooks/useGroups";
import { useJoinGroupByCode } from "@/hooks/useGroupAdmin";
import { NewGroupDialog } from "@/components/chat/NewGroupDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { EditorialPageHeader, EditorialSectionHeader } from "@/components/editorial/SectionHeader";

export const Route = createFileRoute("/_authenticated/app/chat/")({
  component: ChatList,
});

function ChatList() {
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const partnerId = me?.partner_id ?? null;
  const { data: threads, isLoading } = useChatThreads();
  const { data: groups, isLoading: groupsLoading } = useGroups();

  const [showNewGroup, setShowNewGroup] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const joinGroup = useJoinGroupByCode();

  async function doJoin() {
    if (!joinCode.trim()) return;
    try {
      const g = await joinGroup.mutateAsync(joinCode);
      toast.success(`Joined ${g.name}`);
      setJoinOpen(false);
      setJoinCode("");
      navigate({ to: "/app/chat/group/$groupId", params: { groupId: g.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Could not join");
    }
  }

  const partnerThread = threads?.find((t) => t.isPartner) ?? null;
  const friendThreads = threads?.filter((t) => !t.isPartner) ?? [];

  const q = query.trim().toLowerCase();
  const matchesQuery = (name?: string | null, content?: string | null) =>
    !q || (name ?? "").toLowerCase().includes(q) || (content ?? "").toLowerCase().includes(q);

  const filteredFriends = useMemo(
    () => friendThreads.filter((t) => matchesQuery(t.peer.display_name, t.last?.content)),
    [friendThreads, q],
  );
  const filteredGroups = useMemo(
    () => (groups ?? []).filter((g) => matchesQuery(g.group.name, g.last?.content)),
    [groups, q],
  );
  const partnerVisible =
    partnerThread && matchesQuery(me?.partner_nickname ?? partnerThread.peer.display_name, partnerThread.last?.content);

  const totalUnread =
    (partnerThread?.unread ?? 0) +
    friendThreads.reduce((a, t) => a + t.unread, 0) +
    (groups ?? []).reduce((a, g) => a + g.unread, 0);

  const totalEmpty =
    !isLoading && !groupsLoading && !partnerThread && friendThreads.length === 0 && (groups?.length ?? 0) === 0;

  const noResults = !totalEmpty && q && !partnerVisible && filteredFriends.length === 0 && filteredGroups.length === 0;

  return (
    <div className="px-5 pt-10 pb-6">
      <div data-tour="chat-hero">
      <EditorialPageHeader
        eyebrow="Whispers"
        title="Chats"
        subtitle="Where your circles meet — partner, friends, and groups, all in one velvet room."
        leading={
          <Link
            to="/app"
            aria-label="Back"
            className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted hover:text-candle hover:border-petal/40 transition-colors [-webkit-tap-highlight-color:transparent]"
          >
            <ArrowLeft className="size-4" />
          </Link>
        }
        trailing={
          <>
            <Link to="/app/friends" className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal hover:border-petal/40 transition-colors" aria-label="Friends">
              <Users className="size-4" />
            </Link>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((s) => !s)}
                className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow transition-transform active:scale-95"
                aria-label="New"
              >
                <Plus className={`size-4 transition-transform duration-200 ${menuOpen ? "rotate-45" : ""}`} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-velvet/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden z-40 animate-scale-in origin-top-right">
                    <button
                      onClick={() => { setMenuOpen(false); setShowNewGroup(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface"
                    >
                      <UsersRound className="size-4 text-petal" /> New group
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setJoinOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface border-t border-border"
                    >
                      <KeyRound className="size-4 text-petal" /> Join by code
                    </button>
                    <Link
                      to="/app/friends"
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface border-t border-border"
                    >
                      <Users className="size-4 text-petal" /> Add friend
                    </Link>
                  </div>
                </>
              )}
            </div>
          </>
        }
      />
      </div>


      {/* Search */}
      {!totalEmpty && (
        <div className="relative mb-5">
          <Search className="size-4 text-candle-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search whispers…"
            className="w-full bg-surface/60 border border-border rounded-full pl-11 pr-10 py-2.5 text-sm text-candle placeholder:text-candle-muted/60 focus:outline-none focus:border-petal/40 focus:bg-surface transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear"
              className="absolute right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted hover:text-candle"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      {(isLoading || groupsLoading) && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-surface/40 animate-pulse">
              <div className="size-12 rounded-full bg-surface" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-surface" />
                <div className="h-2.5 w-1/2 rounded bg-surface" />
              </div>
            </div>
          ))}
        </div>
      )}

      {totalEmpty && (
        <div className="text-center py-16">
          <div className="size-16 mx-auto mb-4 rounded-full bg-petal-soft flex items-center justify-center petal-glow">
            <MessageCircle className="size-7 text-petal" />
          </div>
          <h2 className="font-serif text-xl italic mb-1">No chats yet</h2>
          <p className="text-sm text-candle-muted mb-5">
            Pair with your partner, add friends, or start a group.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {!me?.partner_id && (
              <Link to="/app/invite" className="px-5 py-2.5 bg-petal text-velvet rounded-full text-sm font-semibold">
                Invite partner
              </Link>
            )}
            <Link to="/app/friends" className="px-5 py-2.5 bg-surface border border-border text-candle rounded-full text-sm font-semibold">
              Find friends
            </Link>
            <button
              onClick={() => setShowNewGroup(true)}
              className="px-5 py-2.5 bg-surface border border-border text-candle rounded-full text-sm font-semibold"
            >
              New group
            </button>
          </div>
        </div>
      )}

      {noResults && (
        <div className="text-center py-12 text-sm text-candle-muted">
          Nothing matches "<span className="text-candle">{query}</span>".
        </div>
      )}

      {partnerVisible && partnerThread && (
        <section className="mb-6 animate-fade-in">
          <EditorialSectionHeader
            eyebrow="Your panda"
            title={<><Heart className="inline size-4 text-petal fill-current mr-1 -mt-1" />Beloved</>}
          />
          <PartnerCard thread={partnerThread} nickname={me?.partner_nickname ?? null} />
        </section>
      )}

      {filteredGroups.length > 0 && (
        <section className="mb-6 animate-fade-in">
          <EditorialSectionHeader
            eyebrow={`${filteredGroups.length} ${filteredGroups.length === 1 ? "circle" : "circles"}`}
            title="Circles"
          />
          <div className="space-y-1.5">
            {filteredGroups.map((g) => (
              <GroupCard key={g.group.id} thread={g} meId={me?.id ?? ""} partnerId={partnerId} />
            ))}
          </div>
        </section>
      )}

      {filteredFriends.length > 0 && (
        <section className="mb-6 animate-fade-in">
          <EditorialSectionHeader
            eyebrow={`${filteredFriends.length} ${filteredFriends.length === 1 ? "friend" : "friends"}`}
            title="Friends"
          />
          <div className="space-y-1.5">
            {filteredFriends.map((t) => (
              <FriendCard key={t.peer.id} thread={t} meId={me?.id} />
            ))}
          </div>
        </section>
      )}

      <NewGroupDialog open={showNewGroup} onClose={() => setShowNewGroup(false)} />

      {joinOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in"
          onClick={() => setJoinOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-velvet border border-border rounded-t-3xl sm:rounded-3xl p-6 animate-scale-in"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-petal">Circles</p>
                <h2 className="font-serif italic text-2xl">Join a group</h2>
              </div>
              <button
                onClick={() => setJoinOpen(false)}
                className="size-9 rounded-full bg-surface border border-border text-candle-muted flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-candle-muted mb-3">Paste the 8-character invite code shared with you.</p>
            <input
              autoFocus
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              maxLength={8}
              placeholder="ABCD2345"
              className="w-full bg-surface border border-border rounded-2xl px-4 py-3 text-center font-mono tracking-[0.4em] text-lg text-candle placeholder:text-candle/25 uppercase"
            />
            <button
              onClick={doJoin}
              disabled={joinCode.length < 4 || joinGroup.isPending}
              className="w-full mt-4 py-3 bg-petal text-velvet rounded-full font-semibold disabled:opacity-50"
            >
              {joinGroup.isPending ? "Joining…" : "Join group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/60 border border-border text-[11px] text-candle-muted">
      {icon}
      {label}
    </span>
  );
}

function PartnerCard({ thread, nickname }: { thread: NonNullable<ReturnType<typeof useChatThreads>["data"]>[number]; nickname: string | null }) {
  const hasUnread = thread.unread > 0;
  return (
    <Link
      to="/app/chat/$peerId"
      params={{ peerId: thread.peer.id }}
      className="relative flex items-center gap-3 p-4 rounded-3xl bg-gradient-to-br from-petal-soft to-petal-soft/30 border border-petal/30 petal-glow overflow-hidden group transition-transform active:scale-[0.99]"
    >
      {/* Filigree corner */}
      <span className="pointer-events-none absolute -top-6 -right-6 size-24 rounded-full bg-petal/15 blur-2xl" />
      <div className="relative size-14 rounded-full bg-petal-soft ring-2 ring-petal petal-glow flex items-center justify-center overflow-hidden shrink-0">
        <UserAvatar src={thread.peer.avatar_url} name={thread.peer.display_name} className="size-full" />
        <span className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-petal text-velvet flex items-center justify-center ring-2 ring-velvet">
          <Heart className="size-2.5 fill-current" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-widest text-petal">Partner</p>
          {thread.last && (
            <span className="text-[10px] text-candle-muted/80 ml-auto">{formatTime(thread.last.created_at)}</span>
          )}
        </div>
        <p className="font-serif italic text-lg text-candle truncate">
          {nickname || thread.peer.display_name}
        </p>
        <p className="text-xs text-candle-muted truncate">
          {thread.peer.mood ? `${thread.peer.mood_emoji} ${thread.peer.mood}` : previewText(thread.last, undefined)}
        </p>
      </div>
      {hasUnread && (
        <span className="relative min-w-[24px] h-6 px-2 rounded-full bg-petal text-velvet text-[11px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(236,120,155,0.6)]">
          <span className="absolute inset-0 rounded-full bg-petal animate-ping opacity-40" />
          <span className="relative">{thread.unread > 9 ? "9+" : thread.unread}</span>
        </span>
      )}
    </Link>
  );
}

function FriendCard({ thread, meId }: { thread: NonNullable<ReturnType<typeof useChatThreads>["data"]>[number]; meId?: string }) {
  const hasUnread = thread.unread > 0;
  return (
    <Link
      to="/app/chat/$peerId"
      params={{ peerId: thread.peer.id }}
      className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.99] ${
        hasUnread
          ? "bg-surface border-petal/25 shadow-[inset_2px_0_0_0_var(--tw-shadow-color)] shadow-petal"
          : "bg-surface/40 border-transparent hover:bg-surface hover:border-border"
      }`}
    >
      <div className="relative shrink-0">
        <UserAvatar src={thread.peer.avatar_url} name={thread.peer.display_name} className="size-12" />
        {thread.peer.mood_emoji && (
          <span className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-velvet border border-border flex items-center justify-center text-[11px]">
            {thread.peer.mood_emoji}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-serif italic text-base truncate ${hasUnread ? "text-candle" : "text-candle"}`}>{thread.peer.display_name}</p>
          {thread.last && (
            <span className={`text-[10px] shrink-0 ml-auto ${hasUnread ? "text-petal font-semibold" : "text-candle-muted"}`}>
              {formatTime(thread.last.created_at)}
            </span>
          )}
        </div>
        <p className={`text-xs truncate ${hasUnread ? "text-candle" : "text-candle-muted"}`}>
          {previewText(thread.last, meId)}
        </p>
      </div>
      {hasUnread && (
        <span className="size-5 rounded-full bg-petal text-velvet text-[10px] font-bold flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(236,120,155,0.5)]">
          {thread.unread > 9 ? "9+" : thread.unread}
        </span>
      )}
    </Link>
  );
}

function GroupCard({ thread, meId, partnerId }: { thread: NonNullable<ReturnType<typeof useGroups>["data"]>[number]; meId: string; partnerId: string | null }) {
  const hasPartner = partnerId ? thread.memberIds.includes(partnerId) : false;
  const hasUnread = thread.unread > 0;
  const others = thread.members.filter((m) => m.id !== meId).slice(0, 3);
  const senderName = thread.last
    ? others.find((o) => o.id === thread.last!.sender_id)?.display_name?.split(" ")[0] ??
      (thread.last.sender_id === meId ? "You" : "Someone")
    : null;
  return (
    <Link
      to="/app/chat/group/$groupId"
      params={{ groupId: thread.group.id }}
      className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.99] ${
        hasPartner
          ? "bg-gradient-to-br from-petal-soft/40 to-petal-soft/10 border-petal/25"
          : hasUnread
            ? "bg-surface border-petal/20"
            : "bg-surface/40 border-transparent hover:bg-surface hover:border-border"
      }`}
    >
      <div className={`relative size-12 rounded-full flex items-center justify-center shrink-0 text-2xl ${hasPartner ? "bg-petal-soft ring-2 ring-petal/40" : "bg-surface border border-border"}`}>
        {thread.group.avatar_url || "💜"}
        {hasPartner && (
          <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-petal text-velvet flex items-center justify-center ring-2 ring-velvet">
            <Heart className="size-2 fill-current" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-serif italic text-base truncate">{thread.group.name}</p>
          {thread.last && (
            <span className={`text-[10px] shrink-0 ml-auto ${hasUnread ? "text-petal font-semibold" : "text-candle-muted"}`}>
              {formatTime(thread.last.created_at)}
            </span>
          )}
        </div>
        <p className={`text-xs truncate ${hasUnread ? "text-candle" : "text-candle-muted"}`}>
          {thread.last
            ? <><span className="text-petal/80">{senderName}:</span> {previewText(thread.last, meId)}</>
            : `${thread.memberIds.length} members`}
        </p>
      </div>
      {hasUnread ? (
        <span className="size-5 rounded-full bg-petal text-velvet text-[10px] font-bold flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(236,120,155,0.5)]">
          {thread.unread > 9 ? "9+" : thread.unread}
        </span>
      ) : (
        <div className="flex -space-x-2 shrink-0">
          {others.slice(0, 3).map((o) => (
            <UserAvatar key={o.id} src={o.avatar_url} name={o.display_name} className="size-6 ring-2 ring-velvet" />
          ))}
        </div>
      )}
    </Link>
  );
}

function previewText(last: { content: string; type: string; sender_id: string } | null, meId?: string): string {
  if (!last) return "Say hi 🐼";
  const prefix = meId && last.sender_id === meId ? "You: " : "";
  if (last.type === "voice") return prefix + "🎙 Voice message";
  if (last.type === "image") return prefix + "📷 Photo";
  if (last.type === "file") return prefix + "📎 File";
  if (last.type === "sticker") return prefix + last.content;
  if (last.type === "watch_invite") return prefix + `🎬 Watch invite: ${last.content}`;
  return prefix + last.content;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const ms = Date.now() - d.getTime();
  if (ms < 7 * 86400000) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
