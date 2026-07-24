import { Gamepad2, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { MessageRow } from "@/lib/chat";

export function GameInviteCard({ m, mine }: { m: MessageRow; mine: boolean }) {
  const meta = (m.media_meta ?? {}) as { emoji?: string; body?: string; href?: string; game_id?: string; friend?: string };
  const href = meta.href ?? "/app/play";
  // If the invite carries a friend id, the recipient joins the sender's room.
  // The sender still sees "Waiting…" — no need to pass search on their side.
  const search = !mine && meta.friend ? ({ friend: meta.friend } as never) : (undefined as never);
  return (
    <div className={`w-[260px] rounded-2xl overflow-hidden border ${mine ? "border-velvet/30 bg-velvet/10" : "border-petal/40 bg-surface-elevated"}`}>
      <div className="relative p-4 bg-gradient-to-br from-petal/25 via-petal-soft/20 to-transparent">
        <div className="flex items-center gap-1.5 mb-2">
          <Gamepad2 className={`size-3.5 ${mine ? "text-velvet/70" : "text-petal"}`} />
          <span className={`text-[10px] uppercase tracking-[0.25em] ${mine ? "text-velvet/70" : "text-petal"}`}>
            Game invite
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-4xl leading-none shrink-0">{meta.emoji ?? "🎮"}</span>
          <div className="min-w-0">
            <p className={`font-serif italic text-base leading-tight ${mine ? "text-velvet" : "text-candle"}`}>
              {m.content}
            </p>
            {meta.body && (
              <p className={`text-[11px] mt-0.5 line-clamp-2 ${mine ? "text-velvet/70" : "text-candle-muted"}`}>
                {meta.body}
              </p>
            )}
          </div>
        </div>
      </div>
      <Link
        to={href}
        search={search}
        onClick={(e) => e.stopPropagation()}
        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
          mine
            ? "bg-velvet/15 text-velvet hover:bg-velvet/25"
            : "bg-petal text-velvet hover:bg-petal/90"
        }`}
      >
        {mine ? "Waiting for them…" : "Accept & play"}
        {!mine && <ArrowRight className="size-3.5" />}
      </Link>
    </div>
  );
}
