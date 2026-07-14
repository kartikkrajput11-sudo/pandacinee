import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Play, Clock, CalendarDays, Tv } from "lucide-react";
import { tmdbTvFull, tmdbTvSeason } from "@/lib/tmdb.functions";
import { poster } from "./app.movies";

export const Route = createFileRoute("/_authenticated/app/movies/$id/episode/$season/$episode")({
  component: EpisodeDetail,
});

function EpisodeDetail() {
  const { id, season, episode } = Route.useParams();
  const tmdbId = Number(id);
  const s = Number(season);
  const e = Number(episode);
  const navigate = useNavigate();
  const fetchTv = useServerFn(tmdbTvFull);
  const fetchSeason = useServerFn(tmdbTvSeason);
  const [tv, setTv] = useState<any>(null);
  const [ep, setEp] = useState<any>(null);
  const [eps, setEps] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [tvRes, seasonEps] = await Promise.all([
        fetchTv({ data: { id: tmdbId } }).catch(() => null),
        fetchSeason({ data: { id: tmdbId, season: s } }).catch(() => []),
      ]);
      if (!alive) return;
      setTv(tvRes);
      setEps(seasonEps ?? []);
      setEp((seasonEps ?? []).find((x: any) => x.episode_number === e) ?? null);
    })();
    return () => { alive = false; };
  }, [tmdbId, s, e]);

  const cast = (tv?.credits?.cast ?? []).slice(0, 10);
  const stillUrl = ep?.still_path
    ? `https://image.tmdb.org/t/p/w780${ep.still_path}`
    : tv?.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${tv.backdrop_path}`
      : null;
  const nextEp = eps.find((x: any) => x.episode_number === e + 1);
  const prevEp = eps.find((x: any) => x.episode_number === e - 1);

  return (
    <div className="min-h-screen bg-velvet text-candle">
      {/* Hero still */}
      <div className="relative aspect-video w-full overflow-hidden">
        {stillUrl && (
          <img src={stillUrl} alt={ep?.name ?? "Episode"} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-velvet via-velvet/60 to-transparent" />
        <Link
          to="/app/movies/$id"
          params={{ id: String(tmdbId) }}
          className="absolute top-4 left-4 size-10 rounded-full bg-velvet/70 backdrop-blur border border-border flex items-center justify-center"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-petal mb-2">
            <Tv className="size-3.5" />
            {tv?.name ?? "Series"} · S{s}·E{e}
          </div>
          <h1 className="text-2xl font-bold leading-tight">
            {ep?.name || `Episode ${e}`}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-candle-muted">
            {ep?.runtime ? (
              <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {ep.runtime}m</span>
            ) : null}
            {ep?.air_date ? (
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> {ep.air_date}</span>
            ) : null}
            {typeof ep?.vote_average === "number" && ep.vote_average > 0 ? (
              <span>★ {ep.vote_average.toFixed(1)}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-6 pb-24">
        {/* Play CTA */}
        <button
          onClick={() =>
            navigate({
              to: "/app/movies/$id/watch",
              params: { id: String(tmdbId) },
              search: { season: s, episode: e },
            })
          }
          className="w-full flex items-center justify-center gap-3 py-4 mt-6 rounded-2xl bg-petal text-velvet font-bold text-sm tracking-wide shadow-[0_20px_60px_-20px] shadow-petal/60 active:scale-[0.98] transition-transform"
        >
          <Play className="size-4 fill-velvet" />
          PLAY EPISODE
        </button>

        {/* Overview */}
        {ep?.overview && (
          <div className="mt-8">
            <p className="text-sm text-candle/80 leading-relaxed font-light">{ep.overview}</p>
          </div>
        )}

        {/* Prev / Next */}
        <div className="grid grid-cols-2 gap-3 mt-8">
          <Link
            to="/app/movies/$id/episode/$season/$episode"
            params={{ id: String(tmdbId), season: String(s), episode: String(prevEp?.episode_number ?? e) }}
            disabled={!prevEp}
            className={`flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-semibold uppercase tracking-widest ${prevEp ? "text-candle" : "text-candle-muted opacity-50 pointer-events-none"}`}
          >
            ← Prev E{prevEp?.episode_number ?? ""}
          </Link>
          <Link
            to="/app/movies/$id/episode/$season/$episode"
            params={{ id: String(tmdbId), season: String(s), episode: String(nextEp?.episode_number ?? e) }}
            disabled={!nextEp}
            className={`flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-semibold uppercase tracking-widest ${nextEp ? "text-candle" : "text-candle-muted opacity-50 pointer-events-none"}`}
          >
            Next E{nextEp?.episode_number ?? ""} →
          </Link>
        </div>

        {/* Cast (series-level) */}
        {cast.length > 0 && (
          <div className="mt-10">
            <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-candle-muted mb-5 flex items-center gap-3">
              Cast
              <div className="h-px flex-1 bg-border" />
            </h3>
            <div className="flex gap-6 overflow-x-auto -mx-6 px-6 pb-2 no-scrollbar">
              {cast.map((c: any) => (
                <div key={c.id} className="shrink-0 flex flex-col items-center w-16">
                  <div className="size-14 rounded-full border border-border p-0.5 mb-2 overflow-hidden bg-velvet">
                    {c.profile_path && (
                      <img
                        src={poster(c.profile_path, "w185")!}
                        alt={c.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-candle text-center leading-tight truncate w-full">
                    {c.name}
                  </span>
                  <span className="text-[9px] text-candle-muted uppercase tracking-tight text-center truncate w-full">
                    {c.character}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* More episodes this season */}
        {eps.length > 0 && (
          <div className="mt-10">
            <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-candle-muted mb-5 flex items-center gap-3">
              More in Season {s}
              <div className="h-px flex-1 bg-border" />
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {eps.map((x: any) => {
                const active = x.episode_number === e;
                return (
                  <Link
                    key={x.episode_number}
                    to="/app/movies/$id/episode/$season/$episode"
                    params={{ id: String(tmdbId), season: String(s), episode: String(x.episode_number) }}
                    className={`flex gap-3 p-2 rounded-xl border ${active ? "border-petal bg-petal/10" : "border-border bg-surface"}`}
                  >
                    <div className="w-28 aspect-video rounded-lg overflow-hidden bg-velvet shrink-0">
                      {x.still_path && (
                        <img
                          src={`https://image.tmdb.org/t/p/w300${x.still_path}`}
                          alt={x.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-candle-muted">
                        E{x.episode_number}{x.runtime ? ` · ${x.runtime}m` : ""}
                      </div>
                      <div className="text-sm font-semibold text-candle truncate">
                        {x.name || `Episode ${x.episode_number}`}
                      </div>
                      {x.overview && (
                        <div className="text-[11px] text-candle-muted line-clamp-2 mt-0.5">
                          {x.overview}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
