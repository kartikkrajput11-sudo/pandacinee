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

  return (
    <div className="px-5 pt-10 pb-6">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Whispers</p>
          <h1 className="font-serif text-3xl italic">Chats</h1>
        </div>
        <Link to="/app/friends" className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal">
          <Users className="size-4" />
        </Link>
      </header>

      {isLoading && <div className="text-center py-12 text-candle-muted text-sm">Loading…</div>}

      {!isLoading && (!threads || threads.length === 0) && (
        <div className="text-center py-16">
          <div className="size-16 mx-auto mb-4 rounded-full bg-petal-soft flex items-center justify-center">
            <MessageCircle className="size-7 text-petal" />
          </div>
          <h2 className="font-serif text-xl italic mb-1">No chats yet</h2>
          <p className="text-sm text-candle-muted mb-5">
            Pair with your partner or add friends to start whispering.
          </p>
          <div className="flex justify-center gap-3">
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

      <div className="space-y-1.5">
        {threads?.map((t) => (
          <Link
            key={t.peer.id}
            to="/app/chat/$peerId"
            params={{ peerId: t.peer.id }}
            className={`flex items-center gap-3 p-3 rounded-2xl transition-colors hover:bg-surface ${
              t.isPartner ? "bg-petal-soft/50 border border-petal/20" : "bg-surface/40 border border-transparent"
            }`}
          >
            <div className="relative size-12 rounded-full bg-petal-soft flex items-center justify-center overflow-hidden shrink-0">
              {t.peer.avatar_url ? (
                <img src={t.peer.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-xl">🐼</span>
              )}
              {t.isPartner && (
                <span className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-petal text-velvet flex items-center justify-center">
                  <Heart className="size-2.5 fill-current" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-serif italic text-base truncate">
                  {t.isPartner && me?.partner_nickname ? me.partner_nickname : t.peer.display_name}
                </p>
                {t.last && (
                  <span className="text-[10px] text-candle-muted shrink-0 ml-auto">
                    {formatTime(t.last.created_at)}
                  </span>
                )}
              </div>
              <p className="text-xs text-candle-muted truncate">
                {t.peer.mood && (
                  <span className="text-petal mr-1">{t.peer.mood_emoji} {t.peer.mood} ·</span>
                )}
                {previewText(t.last, me?.id)}
              </p>
            </div>
            {t.unread > 0 && (
              <span className="size-5 rounded-full bg-petal text-velvet text-[10px] font-bold flex items-center justify-center shrink-0">
                {t.unread > 9 ? "9+" : t.unread}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function previewText(last: { content: string; type: string; sender_id: string } | null, meId?: string): string {
  if (!last) return "Say hi 🐼";
  const prefix = meId && last.sender_id === meId ? "You: " : "";
  if (last.type === "voice") return prefix + "🎙 Voice message";
  if (last.type === "image") return prefix + "📷 Photo";
  if (last.type === "file") return prefix + "📎 File";
  if (last.type === "sticker") return prefix + last.content;
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
