import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MessageCircle, Heart, Users, Plus, UsersRound, KeyRound, X } from "lucide-react";
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

  const totalEmpty =
    !isLoading && !groupsLoading && !partnerThread && friendThreads.length === 0 && (groups?.length ?? 0) === 0;

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
                className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow"
                aria-label="New"
              >
                <Plus className="size-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-velvet border border-border rounded-2xl shadow-xl overflow-hidden z-40">
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



      {(isLoading || groupsLoading) && (
        <div className="text-center py-12 text-candle-muted text-sm">Loading…</div>
      )}

      {totalEmpty && (
        <div className="text-center py-16">
          <div className="size-16 mx-auto mb-4 rounded-full bg-petal-soft flex items-center justify-center">
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

      {partnerThread && (
        <section className="mb-6">
          <EditorialSectionHeader
            eyebrow="Your panda"
            title={<><Heart className="inline size-4 text-petal fill-current mr-1 -mt-1" />Beloved</>}
          />
          <PartnerCard thread={partnerThread} nickname={me?.partner_nickname ?? null} />
        </section>
      )}

      {(groups?.length ?? 0) > 0 && (
        <section className="mb-6">
          <EditorialSectionHeader
            eyebrow={`${groups?.length} circles`}
            title="Circles"
          />
          <div className="space-y-1.5">
            {groups!.map((g) => (
              <GroupCard key={g.group.id} thread={g} meId={me?.id ?? ""} partnerId={partnerId} />
            ))}
          </div>
        </section>
      )}

      {friendThreads.length > 0 && (
        <section className="mb-6">
          <EditorialSectionHeader
            eyebrow={`${friendThreads.length} friends`}
            title="Friends"
          />
          <div className="space-y-1.5">
            {friendThreads.map((t) => (
              <FriendCard key={t.peer.id} thread={t} meId={me?.id} />
            ))}
          </div>
        </section>
      )}

      <NewGroupDialog open={showNewGroup} onClose={() => setShowNewGroup(false)} />

      {joinOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setJoinOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-velvet border border-border rounded-t-3xl sm:rounded-3xl p-6"
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

function PartnerCard({ thread, nickname }: { thread: NonNullable<ReturnType<typeof useChatThreads>["data"]>[number]; nickname: string | null }) {
  return (
    <Link
      to="/app/chat/$peerId"
      params={{ peerId: thread.peer.id }}
      className="flex items-center gap-3 p-4 rounded-3xl bg-gradient-to-br from-petal-soft to-petal-soft/40 border border-petal/30 petal-glow"
    >
      <div className="relative size-14 rounded-full bg-petal-soft ring-2 ring-petal petal-glow flex items-center justify-center overflow-hidden shrink-0">
        <UserAvatar src={thread.peer.avatar_url} name={thread.peer.display_name} className="size-full" />
        <span className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-petal text-velvet flex items-center justify-center">
          <Heart className="size-2.5 fill-current" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-petal">Partner</p>
        <p className="font-serif italic text-lg text-candle truncate">
          {nickname || thread.peer.display_name}
        </p>
        <p className="text-xs text-candle-muted truncate">
          {thread.peer.mood ? `${thread.peer.mood_emoji} ${thread.peer.mood}` : previewText(thread.last, undefined)}
        </p>
      </div>
      {thread.unread > 0 && (
        <span className="min-w-[24px] h-6 px-2 rounded-full bg-petal text-velvet text-[11px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(236,120,155,0.6)]">
          {thread.unread > 9 ? "9+" : thread.unread}
        </span>
      )}
    </Link>
  );
}

function FriendCard({ thread, meId }: { thread: NonNullable<ReturnType<typeof useChatThreads>["data"]>[number]; meId?: string }) {
  return (
    <Link
      to="/app/chat/$peerId"
      params={{ peerId: thread.peer.id }}
      className="flex items-center gap-3 p-3 rounded-2xl bg-surface/40 border border-transparent hover:bg-surface transition-colors"
    >
      <UserAvatar src={thread.peer.avatar_url} name={thread.peer.display_name} className="size-12" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-serif italic text-base truncate">{thread.peer.display_name}</p>
          {thread.last && (
            <span className="text-[10px] text-candle-muted shrink-0 ml-auto">
              {formatTime(thread.last.created_at)}
            </span>
          )}
        </div>
        <p className="text-xs text-candle-muted truncate">{previewText(thread.last, meId)}</p>
      </div>
      {thread.unread > 0 && (
        <span className="size-5 rounded-full bg-petal text-velvet text-[10px] font-bold flex items-center justify-center shrink-0">
          {thread.unread > 9 ? "9+" : thread.unread}
        </span>
      )}
    </Link>
  );
}

function GroupCard({ thread, meId, partnerId }: { thread: NonNullable<ReturnType<typeof useGroups>["data"]>[number]; meId: string; partnerId: string | null }) {
  const hasPartner = partnerId ? thread.memberIds.includes(partnerId) : false;
  const others = thread.members.filter((m) => m.id !== meId).slice(0, 3);
  return (
    <Link
      to="/app/chat/group/$groupId"
      params={{ groupId: thread.group.id }}
      className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
        hasPartner
          ? "bg-petal-soft/30 border-petal/25"
          : "bg-surface/40 border-transparent hover:bg-surface"
      }`}
    >
      <div className={`relative size-12 rounded-full flex items-center justify-center shrink-0 text-2xl ${hasPartner ? "bg-petal-soft ring-2 ring-petal/40" : "bg-surface border border-border"}`}>
        {thread.group.avatar_url || "💜"}
        {hasPartner && (
          <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-petal text-velvet flex items-center justify-center">
            <Heart className="size-2 fill-current" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-serif italic text-base truncate">{thread.group.name}</p>
          {thread.last && (
            <span className="text-[10px] text-candle-muted shrink-0 ml-auto">
              {formatTime(thread.last.created_at)}
            </span>
          )}
        </div>
        <p className="text-xs text-candle-muted truncate">
          {thread.last
            ? `${others.find((o) => o.id === thread.last!.sender_id)?.display_name?.split(" ")[0] ?? (thread.last.sender_id === meId ? "You" : "Someone")}: ${previewText(thread.last, meId)}`
            : `${thread.memberIds.length} members`}
        </p>
      </div>
      {thread.unread > 0 && (
        <span className="size-5 rounded-full bg-petal text-velvet text-[10px] font-bold flex items-center justify-center shrink-0">
          {thread.unread > 9 ? "9+" : thread.unread}
        </span>
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
