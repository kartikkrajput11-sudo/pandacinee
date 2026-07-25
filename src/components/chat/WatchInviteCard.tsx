import { Link } from "@tanstack/react-router";
import { Film, Play } from "lucide-react";
import type { MessageRow } from "@/lib/chat";
import { poster } from "@/routes/_authenticated/app.movies";

type InviteMeta = {
  tmdb_id?: number;
  media_type?: "movie" | "tv";
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number;
  overview?: string;
  with?: string;
};

export function WatchInviteCard({ m, mine }: { m: MessageRow; mine: boolean }) {
  const meta = (m.media_meta ?? {}) as InviteMeta;
  const year = meta.release_date ? meta.release_date.slice(0, 4) : "";
  const p = poster(meta.poster_path ?? null, "w185");

  return (
    <div
      className={`w-[260px] rounded-2xl overflow-hidden border ${
        mine ? "bg-petal/15 border-petal/40" : "bg-surface-elevated border-border"
      }`}
    >
      <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2 border-b border-border/50">
        <Film className="size-3.5 text-petal" />
        <p className="text-[10px] uppercase tracking-widest text-petal">Watch together invite</p>
      </div>
      <div className="flex gap-3 p-3">
        <div className="w-16 h-24 rounded-lg overflow-hidden bg-surface border border-border shrink-0 flex items-center justify-center">
          {p ? (
            <img src={p} alt="" className="w-full h-full object-cover" />
          ) : (
            <Film className="size-5 text-candle-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif italic text-sm text-candle leading-tight line-clamp-2">
            {m.content || "Movie"}
          </p>
          <p className="text-[11px] text-candle-muted mt-0.5">
            {year}
            {typeof meta.vote_average === "number" && meta.vote_average > 0 && (
              <span className="ml-2 text-petal">★ {meta.vote_average.toFixed(1)}</span>
            )}
          </p>
          {meta.overview && <p className="text-[11px] text-candle-muted line-clamp-2 mt-1">{meta.overview}</p>}
        </div>
      </div>
      {meta.tmdb_id && (
        <Link
          to="/app/movies/$id/watch"
          params={{ id: String(meta.tmdb_id) }}
          search={{
            ...(meta.media_type === "tv" ? { type: "tv" as const } : { type: "movie" as const }),
            ...(meta.with ? { with: meta.with } : {}),
          }}
          className="flex items-center justify-center gap-2 mx-3 mb-3 py-2 rounded-full bg-petal text-velvet text-xs font-semibold petal-glow"
        >
          <Play className="size-3.5 fill-current" />
          {mine ? "Open watch room" : "Join watch party"}
        </Link>
      )}
    </div>
  );
}
