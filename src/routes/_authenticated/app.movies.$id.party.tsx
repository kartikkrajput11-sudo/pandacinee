import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/movies/$id/party")({
  validateSearch: (raw: Record<string, unknown>) => {
    const s = Number(raw.season);
    const e = Number(raw.episode);
    const w = typeof raw.with === "string" && raw.with.length > 0 ? raw.with : undefined;
    const t = raw.type === "tv" || raw.type === "movie" ? raw.type : undefined;
    return {
      season: Number.isFinite(s) && s > 0 ? Math.floor(s) : undefined,
      episode: Number.isFinite(e) && e > 0 ? Math.floor(e) : undefined,
      with: w,
      type: t,
    } as { season?: number; episode?: number; with?: string; type?: "movie" | "tv" };
  },
  component: PartyRedirect,
});

// The Same-Room Party experience now lives on the full /watch route, which
// already ships the VidKing player, host/follower sync, chat, reactions,
// and countdown. Redirect any legacy /party links to /watch preserving the
// with= co-viewer + season/episode/type search params.
function PartyRedirect() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  return (
    <Navigate
      to="/app/movies/$id/watch"
      params={{ id }}
      search={{
        ...(search.with ? { with: search.with } : {}),
        ...(search.season ? { season: search.season } : {}),
        ...(search.episode ? { episode: search.episode } : {}),
        ...(search.type ? { type: search.type } : {}),
      }}
      replace
    />
  );
}
