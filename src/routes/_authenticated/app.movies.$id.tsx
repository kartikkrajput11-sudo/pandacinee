import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, Film, Play, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { tmdbMovie } from "@/lib/tmdb.functions";
import { watchmodeSources, type WatchSource } from "@/lib/watchmode.functions";
import { poster } from "./app.movies";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { WatchTogetherPanel } from "@/components/watch/WatchTogetherPanel";
import { trackRecentMovie } from "@/lib/recent-movies";


export const Route = createFileRoute("/_authenticated/app/movies/$id")({
  component: MovieDetail,
});

const TYPE_LABEL: Record<string, string> = {
  sub: "Stream", free: "Free", rent: "Rent", buy: "Buy", tve: "TV",
};

function MovieDetail() {
  const { id } = Route.useParams();
  const isCustom = id.startsWith("custom:");
  const location = useLocation();
  const isWatchRoute = location.pathname.endsWith("/watch");

  if (isWatchRoute) return <Outlet />;
  if (isCustom) return <CustomMovieDetail customId={id.slice("custom:".length)} />;

  const fetchMovie = useServerFn(tmdbMovie);
  const fetchSources = useServerFn(watchmodeSources);
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const partner = prof?.partner;
  const [movie, setMovie] = useState<any>(null);
  const [sources, setSources] = useState<WatchSource[]>([]);
  const [region, setRegion] = useState<string>("US");
  const navigate = useNavigate();

  useEffect(() => {
    fetchMovie({ data: { id: Number(id) } })
      .then((m) => {
        setMovie(m);
        if (m?.id) trackRecentMovie(m.id);
      })
      .catch(() => setMovie(null));
    fetchSources({ data: { tmdbId: Number(id) } })
      .then((r) => setSources(r.sources))
      .catch(() => setSources([]));
  }, [id]);


  const regions = useMemo(() => Array.from(new Set(sources.map((s) => s.region))).sort(), [sources]);
  useEffect(() => { if (regions.length && !regions.includes(region)) setRegion(regions[0]); }, [regions]);
  const regionSources = useMemo(() => sources.filter((s) => s.region === region), [sources, region]);
  const grouped = useMemo(() => {
    const g: Record<string, WatchSource[]> = {};
    for (const s of regionSources) (g[s.type] ||= []).push(s);
    return g;
  }, [regionSources]);

  const trailer = movie?.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer") ?? movie?.videos?.results?.[0];
  const director = movie?.credits?.crew?.find((c: any) => c.job === "Director")?.name;
  const cast = (movie?.credits?.cast ?? []).slice(0, 8);


  async function sendToPartner() {
    if (!me || !partner || !movie) return;
    const content = `🎬 ${movie.title}${movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ""}\n★ ${movie.vote_average?.toFixed(1)} · ${movie.runtime ?? "?"} min\n${movie.overview ?? ""}\n\nhttps://www.themoviedb.org/movie/${movie.id}`;
    const { error } = await supabase.from("messages").insert({
      sender_id: me.id, receiver_id: partner.id, content, type: "text",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Sent to " + partner.display_name);
      navigate({ to: "/app/chat/$peerId", params: { peerId: partner.id } });
    }
  }

  function watchTogether() {
    if (!movie) return;
    navigate({ to: "/app/movies/$id/watch", params: { id: String(movie.id) } });
  }

  if (!movie) {
    return (
      <div className="pt-10 px-5">
        <header className="flex items-center gap-3 mb-5">
          <Link to="/app/movies" search={{ q: "" }} className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        </header>
        <div className="aspect-[2/3] rounded-2xl bg-velvet animate-pulse" />
      </div>
    );
  }

  return (
    <div className="pb-28 min-h-screen bg-background">
      {/* Editorial hero */}
      <div className="relative h-[340px] w-full">
        {movie.backdrop_path && (
          <img
            src={poster(movie.backdrop_path, "w500")!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Link
          to="/app/movies"
          search={{ q: "" }}
          className="absolute top-10 left-5 size-10 rounded-full bg-velvet/40 backdrop-blur-md border border-border flex items-center justify-center z-20"
        >
          <ArrowLeft className="size-5 text-candle" />
        </Link>
      </div>

      {/* Poster + title lockup, overlapping hero */}
      <div className="relative px-6 -mt-32 z-10">
        <div className="flex items-end gap-5 mb-8">
          <div className="w-28 shrink-0 aspect-[2/3] rounded-lg overflow-hidden border border-border bg-velvet shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {movie.poster_path && (
              <img src={poster(movie.poster_path, "w342")!} alt={movie.title} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="pb-2 min-w-0">
            <h1 className="font-serif font-semibold tracking-tight leading-[0.95] text-4xl text-candle mb-3">
              {movie.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-petal font-semibold">
              {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
              {movie.release_date && movie.runtime ? <span className="opacity-30">•</span> : null}
              {movie.runtime ? <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span> : null}
              {movie.vote_average ? (
                <>
                  <span className="opacity-30">•</span>
                  <span>★ {movie.vote_average.toFixed(1)}</span>
                </>
              ) : null}
            </div>
            {movie.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {movie.genres.slice(0, 3).map((g: any) => (
                  <span
                    key={g.id}
                    className="text-[9px] px-2 py-0.5 rounded-full bg-surface border border-border text-candle"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Primary CTA */}
        <Link
          to="/app/movies/$id/watch"
          params={{ id: String(movie.id) }}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-petal text-velvet font-bold text-sm tracking-wide shadow-[0_20px_60px_-20px] shadow-petal/60 active:scale-[0.98] transition-transform"
        >
          <Play className="size-4 fill-velvet" />
          PLAY MOVIE
        </Link>

        {/* Synopsis */}
        {movie.overview && (
          <div className="mt-8">
            <p className="text-sm text-candle/80 leading-relaxed font-light">{movie.overview}</p>
            {director && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[10px] text-candle-muted uppercase tracking-widest">Directed by</span>
                <span className="text-xs text-petal font-medium uppercase tracking-wide">{director}</span>
              </div>
            )}
          </div>
        )}

        {/* Secondary actions 2x2 */}
        <div className="grid grid-cols-2 gap-3 mt-8">
          {partner ? (
            <button
              onClick={sendToPartner}
              className="flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-semibold uppercase tracking-widest text-candle"
            >
              <Send className="size-3.5 opacity-60" /> Send to {partner.display_name.split(" ")[0]}
            </button>
          ) : (
            <Link
              to="/app/invite"
              className="flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-semibold uppercase tracking-widest text-candle"
            >
              <Send className="size-3.5 opacity-60" /> Invite to share
            </Link>
          )}
          <button
            onClick={watchTogether}
            className="flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-semibold uppercase tracking-widest text-candle"
          >
            <Film className="size-3.5 opacity-60" /> Watch together
          </button>
          {trailer ? (
            <a
              href={`https://www.youtube.com/watch?v=${trailer.key}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-semibold uppercase tracking-widest text-candle"
            >
              <Play className="size-3.5 text-petal" /> Trailer
            </a>
          ) : (
            <div />
          )}
          {movie.imdb_id && (
            <a
              href={`https://www.imdb.com/title/${movie.imdb_id}/`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-semibold uppercase tracking-widest text-candle"
            >
              IMDb {movie.vote_average ? movie.vote_average.toFixed(1) : ""}
            </a>
          )}
        </div>

        {/* Cast */}
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

        {/* Where to watch — editorial hairline section */}
        {sources.length > 0 && (
          <div className="mt-10">
            <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-candle-muted mb-5 flex items-center gap-3">
              Where to Watch
              <div className="h-px flex-1 bg-border" />
              {regions.length > 1 && (
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="text-[10px] bg-surface border border-border rounded-full px-2 py-1 text-candle normal-case tracking-normal"
                >
                  {regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
            </h3>
            <div className="space-y-4">
              {(["sub", "free", "rent", "buy", "tve"] as const).map((t) =>
                grouped[t]?.length ? (
                  <div key={t}>
                    <p className="text-[9px] text-petal uppercase tracking-widest mb-2">{TYPE_LABEL[t]}</p>
                    <div className="flex flex-wrap gap-2">
                      {grouped[t].map((s) => (
                        <a
                          key={`${s.source_id}-${s.region}-${s.type}`}
                          href={s.web_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 h-8 rounded-full bg-surface border border-border text-candle hover:border-petal/60 transition"
                        >
                          {s.name}
                          {s.price ? <span className="text-candle-muted">· ${s.price}</span> : null}
                          <ExternalLink className="size-3 text-candle-muted" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}

        {/* More Like This */}
        {movie.similar?.results?.length > 0 && (
          <div className="mt-10">
            <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-candle-muted mb-5 flex items-center gap-3">
              More Like This
              <div className="h-px flex-1 bg-border" />
            </h3>
            <div className="flex gap-4 overflow-x-auto -mx-6 px-6 pb-4 no-scrollbar">
              {movie.similar.results.slice(0, 10).map((s: any) => (
                <Link
                  key={s.id}
                  to="/app/movies/$id"
                  params={{ id: String(s.id) }}
                  className="w-32 shrink-0"
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-velvet border border-border shadow-xl">
                    {s.poster_path && (
                      <img src={poster(s.poster_path, "w342")!} alt={s.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <p className="text-[10px] text-candle truncate mt-2 font-medium">{s.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {me && partner && movie && (
        <WatchTogetherPanel
          me={me}
          partner={partner}
          movieId={Number(id)}
          movieTitle={movie.title}
          moviePoster={movie.poster_path ? poster(movie.poster_path, "w185") : null}
          mediaType="movie"
        />
      )}
    </div>
  );
}

