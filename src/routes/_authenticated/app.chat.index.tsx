import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Heart, Users } from "lucide-react";
import { useChatThreads } from "@/hooks/useChatThreads";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/chat/")({
  component: ChatList,
});

function ChatList() {
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const { data: threads, isLoading } = useChatThreads();

  const partnerThread = threads?.find((t) => t.isPartner) ?? null;
  const friendThreads = threads?.filter((t) => !t.isPartner) ?? [];

  const totalEmpty = !isLoading && !partnerThread && friendThreads.length === 0;

  return (
    <div className="px-5 pt-10 pb-6">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Whispers</p>
          <h1 className="font-serif text-3xl italic">Chats</h1>
        </div>
        <Link to="/app/friends" className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal" aria-label="Friends">
          <Users className="size-4" />
        </Link>
      </header>

      {isLoading && (
        <div className="text-center py-12 text-candle-muted text-sm">Loading…</div>
      )}

      {totalEmpty && (
        <div className="text-center py-16">
          <div className="size-16 mx-auto mb-4 rounded-full bg-petal-soft flex items-center justify-center">
            <MessageCircle className="size-7 text-petal" />
          </div>
          <h2 className="font-serif text-xl italic mb-1">No chats yet</h2>
          <p className="text-sm text-candle-muted mb-5">
            Pair with your partner or add friends.
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
          </div>
        </div>
      )}

      {partnerThread && (
        <section className="mb-6">
          <h3 className="text-[10px] uppercase tracking-widest text-petal mb-2 flex items-center gap-1">
            <Heart className="size-2.5 fill-current" /> Your panda
          </h3>
          <PartnerCard thread={partnerThread} nickname={me?.partner_nickname ?? null} />
        </section>
      )}

      {friendThreads.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">
            Friends · {friendThreads.length}
          </h3>
          <div className="space-y-1.5">
            {friendThreads.map((t) => (
              <FriendCard key={t.peer.id} thread={t} meId={me?.id} />
            ))}
          </div>
        </section>
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
        {thread.peer.avatar_url ? (
          <img src={thread.peer.avatar_url} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-2xl">🐼</span>
        )}
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
      <div className="size-12 rounded-full bg-petal-soft flex items-center justify-center overflow-hidden shrink-0">
        {thread.peer.avatar_url ? (
          <img src={thread.peer.avatar_url} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-xl">🐼</span>
        )}
      </div>
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
