import { useMemo, useState } from "react";
import { UserPlus, X, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useFriendships } from "@/hooks/useFriends";
import { AvatarImg } from "@/components/AvatarImg";
import { GAMES, type GameKind } from "@/lib/games";

/**
 * Luxury mode-picker card that lets a user invite a specific friend
 * to play a given game. Drop it into any game's mode-picker screen next
 * to the "With your panda" / "Side-by-side" buttons.
 *
 * The invite is delivered as a `game_invite` DM (same shape as the
 * Friends page uses), so the friend gets the standard notification and
 * can tap through to the same game route.
 */
export function InviteFriendCard({
  game,
  className,
}: {
  game: GameKind;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const { data } = useFriendships();

  const meta = GAMES[game];
  const href = meta.href ?? `/app/games/${game}`;

  const friends = useMemo(() => {
    const rows = data?.friendships ?? [];
    const profiles = data?.profiles ?? {};
    const me = data?.me;
    const accepted = rows.filter((f) => f.status === "accepted");
    const list = accepted
      .map((f) => {
        const otherId = f.requester_id === me ? f.addressee_id : f.requester_id;
        return profiles[otherId];
      })
      .filter(Boolean);
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter(
      (p) =>
        p.username?.toLowerCase().includes(needle) ||
        p.display_name?.toLowerCase().includes(needle),
    );
  }, [data, q]);

  async function send(peerId: string, peerName: string) {
    if (sendingId) return;
    setSendingId(peerId);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sign in first");
      setSendingId(null);
      return;
    }
    const { error } = await supabase.from("messages").insert({
      sender_id: u.user.id,
      receiver_id: peerId,
      content: meta.name,
      type: "game_invite",
      media_meta: {
        game_id: game,
        emoji: meta.emoji,
        body: meta.body,
        href,
      } as never,
    });
    setSendingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Invite sent to @${peerName}`);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "group relative rounded-2xl p-4 border border-petal/30 bg-gradient-to-br from-petal/10 to-transparent text-left hover:border-petal/60 transition-all w-full"
        }
      >
        <div className="flex items-center gap-3">
          <UserPlus className="size-5 text-petal" />
          <div>
            <p className="font-serif italic text-lg">Invite a friend</p>
            <p className="text-xs text-candle-muted">
              Send a play invite to your circle
            </p>
          </div>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-surface-elevated border border-border rounded-t-3xl sm:rounded-3xl p-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-petal">
                  Invite to {meta.name}
                </p>
                <p className="font-serif italic text-lg">
                  Who's playing? {meta.emoji}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-candle-muted hover:text-candle"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="size-4 text-candle-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search friends"
                className="w-full bg-surface border border-border rounded-2xl pl-9 pr-3 py-2.5 text-sm text-candle"
              />
            </div>

            {friends.length === 0 ? (
              <div className="p-6 text-center text-sm text-candle-muted italic">
                No friends yet — add some from the Friends page to invite them.
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface border border-border"
                  >
                    <AvatarImg
                      src={p.avatar_url}
                      alt={p.display_name}
                      className="size-10 rounded-full border border-petal/30 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-candle truncate">
                        {p.display_name}
                      </p>
                      <p className="text-[11px] text-candle-muted truncate">
                        @{p.username}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={sendingId === p.id}
                      onClick={() => send(p.id, p.username)}
                      className="px-3 py-1.5 rounded-full bg-petal/20 border border-petal/40 text-petal text-xs font-medium hover:bg-petal/30 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="size-3.5" />
                      {sendingId === p.id ? "Sending…" : "Invite"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
