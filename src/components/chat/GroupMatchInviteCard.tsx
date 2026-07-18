import { Link } from "@tanstack/react-router";
import { Swords, ArrowRight } from "lucide-react";
import type { MessageRow } from "@/lib/chat";

export function GroupMatchInviteCard({ m }: { m: MessageRow }) {
  const meta = (m.media_meta ?? {}) as {
    match_id?: string;
    game?: string;
    game_name?: string;
    emoji?: string;
  };
  return (
    <div className="w-[280px] rounded-2xl overflow-hidden border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Swords className="size-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-primary">Group match</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-4xl leading-none shrink-0">{meta.emoji ?? "♟️"}</span>
          <div className="min-w-0">
            <p className="font-sans text-base leading-tight text-foreground">{m.content}</p>
            <p className="text-[11px] mt-0.5 text-muted-foreground">
              Two seats · everyone else becomes an observer
            </p>
          </div>
        </div>
      </div>
      {meta.match_id ? (
        <Link
          to="/app/group-match/$matchId"
          params={{ matchId: meta.match_id }}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Enter lobby <ArrowRight className="size-3.5" />
        </Link>
      ) : (
        <div className="px-4 py-2.5 text-xs text-center text-muted-foreground">Match unavailable</div>
      )}
    </div>
  );
}
