import { Gamepad2, ArrowRight, Heart, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { MessageRow } from "@/lib/chat";
import { useProfile } from "@/hooks/useProfile";

/**
 * A game invite is a doorway into ONE unique room. Both the sender and the
 * recipient tap the same card and land on the same channel (`room` id carried
 * in media_meta, falling back to the message id for older invites).
 */
export function GameInviteCard({ m, mine }: { m: MessageRow; mine: boolean }) {
  const meta = (m.media_meta ?? {}) as {
    emoji?: string;
    body?: string;
    href?: string;
    game_id?: string;
    friend?: string;
    room?: string;
  };
  const { data } = useProfile();
  const partnerId = data?.profile?.partner_id ?? null;

  const href = meta.href ?? "/app/play";
  const room = meta.room ?? m.id;
  // Whoever is looking, the opponent is "the other side of this message".
  const peer = mine ? m.receiver_id ?? meta.friend ?? null : m.sender_id;
  const withPartner = !!peer && !!partnerId && peer === partnerId;

  const search = (peer ? { friend: peer, room } : { room }) as never;

  return (
    <div
      className={`w-[268px] rounded-2xl overflow-hidden border shadow-lg shadow-black/20 ${
        withPartner
          ? "border-petal/60 bg-surface-elevated ring-1 ring-petal/25"
          : "border-border bg-surface-elevated"
      }`}
    >
      <div
        className={`relative p-4 ${
          withPartner
            ? "bg-gradient-to-br from-petal/30 via-petal-soft/20 to-transparent"
            : "bg-gradient-to-br from-lavender/20 via-surface to-transparent"
        }`}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Gamepad2 className={`size-3.5 ${withPartner ? "text-petal" : "text-candle-muted"}`} />
          <span
            className={`text-[10px] uppercase tracking-[0.25em] font-semibold ${
              withPartner ? "text-petal" : "text-candle-muted"
            }`}
          >
            {withPartner ? "Private room" : "Game room"}
          </span>
          <span className="ml-auto flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-candle-muted">
            {withPartner ? <Heart className="size-3 text-petal" /> : <Users className="size-3" />}
            {withPartner ? "Partner" : "Friend"}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-4xl leading-none shrink-0 drop-shadow">{meta.emoji ?? "🎮"}</span>
          <div className="min-w-0">
            <p className="font-serif italic text-base leading-tight text-candle">{m.content}</p>
            {meta.body && (
              <p className="text-[11px] mt-0.5 line-clamp-2 text-candle-muted">{meta.body}</p>
            )}
          </div>
        </div>
      </div>

      <Link
        to={href}
        search={search}
        onClick={(e) => e.stopPropagation()}
        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-t ${
          withPartner
            ? "bg-petal text-white hover:bg-petal/90 border-petal/30"
            : "bg-surface text-candle hover:bg-surface-elevated border-border"
        }`}
      >
        {mine ? "Enter the room" : "Accept & play"}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
