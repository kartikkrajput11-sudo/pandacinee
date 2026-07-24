import { Gamepad2, ArrowRight, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { MessageRow } from "@/lib/chat";

export function GameInviteCard({ m, mine }: { m: MessageRow; mine: boolean }) {
  const meta = (m.media_meta ?? {}) as { emoji?: string; body?: string; href?: string; game_id?: string; friend?: string };
  const href = meta.href ?? "/app/play";
  const search = !mine && meta.friend ? ({ friend: meta.friend } as never) : (undefined as never);

  return (
    <div className="w-[268px] rounded-2xl overflow-hidden border border-petal/40 bg-surface-elevated shadow-lg shadow-black/20">
      {/* Header */}
      <div className="relative p-4 bg-gradient-to-br from-petal/30 via-petal-soft/20 to-transparent">
        <div className="flex items-center gap-1.5 mb-2">
          <Gamepad2 className="size-3.5 text-petal" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-petal font-semibold">
            Game invite
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-4xl leading-none shrink-0 drop-shadow">{meta.emoji ?? "🎮"}</span>
          <div className="min-w-0">
            <p className="font-serif italic text-base leading-tight text-candle">
              {m.content}
            </p>
            {meta.body && (
              <p className="text-[11px] mt-0.5 line-clamp-2 text-candle-muted">
                {meta.body}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action */}
      {mine ? (
        <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-petal/15 text-petal border-t border-petal/20">
          <Clock className="size-3.5 animate-pulse" />
          <span>Waiting for them…</span>
        </div>
      ) : (
        <Link
          to={href}
          search={search}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-petal text-white hover:bg-petal/90 transition-colors border-t border-petal/30"
        >
          Accept & play
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
