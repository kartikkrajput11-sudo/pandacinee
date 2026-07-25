import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, Film, Play, ExternalLink, Tv, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { tmdbMovie, tmdbTvFull, tmdbTvSeason } from "@/lib/tmdb.functions";
import { watchmodeSources, type WatchSource } from "@/lib/watchmode.functions";
import { poster } from "./app.movies";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { WatchTogetherPanel } from "@/components/watch/WatchTogetherPanel";
import { trackRecentMovie } from "@/lib/recent-movies";


export const Route = createFileRoute("/_authenticated/app/movies/$id")({
  validateSearch: (s: Record<string, unknown>) => ({
    type: s.type === "tv" || s.type === "movie" ? (s.type as "tv" | "movie") : undefined,
  }),
  component: MovieDetail,
});

const TYPE_LABEL: Record<string, string> = {
  sub: "Stream", free: "Free", rent: "Rent", buy: "Buy", tve: "TV",
};

function MovieDetail() {
  const { id } = Route.useParams();
  const isCustom = id.startsWith("custom:");
  const location = useLocation();
  const basePath = `/app/movies/${id}`;
  const hasChildRoute = location.pathname.length > basePath.length;

  if (hasChildRoute) return <Outlet />;
  if (isCustom) return <CustomMovieDetail customId={id.slice("custom:".length)} />;
  return <MovieDetailInner id={id} />;
}

function MovieDetailInner({ id }: { id: string }) {
  const { type: typeHint } = Route.useSearch();
  const fetchMovie = useServerFn(tmdbMovie);
  const fetchTv = useServerFn(tmdbTvFull);
  const fetchSources = useServerFn(watchmodeSources);
  const fetchSeasonEps = useServerFn(tmdbTvSeason);
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const partner = prof?.partner;
  const [movie, setMovie] = useState<any>(null);
  const [isTv, setIsTv] = useState(typeHint === "tv");
  const [sources, setSources] = useState<WatchSource[]>([]);
  const [region, setRegion] = useState<string>("US");
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonEps, setSeasonEps] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      // 1) Admin override tells us the intended media type
      const { data: ov } = await supabase
        .from("custom_movies")
        .select("title, overview, poster_url, backdrop_url, runtime, media_type")
        .eq("tmdb_id", Number(id))
        .maybeSingle();

      // 2) Fetch both endpoints in parallel — TMDB uses distinct id spaces for
      //    movies vs TV, so either or both can succeed. We pick TV when the
      //    admin marked it, when only TV resolves, or when TV has real season
      //    data and the movie result is thin.
      const [movieRes, tvRes] = await Promise.all([
        fetchMovie({ data: { id: Number(id) } }).catch(() => null),
        fetchTv({ data: { id: Number(id) } }).catch(() => null),
      ]);
      if (!alive) return;

      const tvHasSeasons = !!(tvRes && Array.isArray(tvRes.seasons) && tvRes.seasons.length);
      const movieLooksReal = !!(movieRes && (movieRes.release_date || movieRes.runtime));
      const preferTv =
        ov?.media_type === "tv" ||
        (tvHasSeasons && !movieLooksReal) ||
        (tvHasSeasons && movieRes?.media_type === "tv");
      const tv = preferTv && !!tvRes;
      setIsTv(tv);

      let m: any = tv ? tvRes : (movieRes ?? tvRes);
      if (m && tv) {
        m.title = m.name ?? m.original_name ?? m.title;
        m.release_date = m.first_air_date ?? m.release_date ?? null;
        m.runtime = Array.isArray(m.episode_run_time) && m.episode_run_time[0]
          ? m.episode_run_time[0]
          : null;
      }

      // 3) Overlay admin edits
      if (ov && m) {
        if (ov.title) m.title = ov.title;
        if (ov.overview != null) m.overview = ov.overview;
        if (ov.poster_url) m.poster_path = ov.poster_url;
        if (ov.backdrop_url) m.backdrop_path = ov.backdrop_url;
        if (ov.runtime) m.runtime = ov.runtime;
      }
      if (!alive) return;
      setMovie(m);
      if (m?.id) trackRecentMovie(m.id);
    })();
    fetchSources({ data: { tmdbId: Number(id) } })
      .then((r) => alive && setSources(r.sources))
      .catch(() => alive && setSources([]));
    return () => { alive = false; };
  }, [id]);


  // Load season episodes when this is a TV series
  useEffect(() => {
    if (!isTv || !movie?.id) { setSeasonEps([]); return; }
    let alive = true;
    fetchSeasonEps({ data: { id: Number(id), season: selectedSeason } })
      .then((eps) => { if (alive) setSeasonEps(eps ?? []); })
      .catch(() => { if (alive) setSeasonEps([]); });
    return () => { alive = false; };
  }, [isTv, movie?.id, selectedSeason, id]);


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
            {isTv && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-petal/15 border border-petal/30 text-petal text-[9px] uppercase tracking-widest mb-2">
                <Tv className="size-2.5" /> Series
              </span>
            )}
            <h1 className="font-serif font-semibold tracking-tight leading-[0.95] text-4xl text-candle mb-3">
              {movie.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-petal font-semibold">
              {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
              {isTv && movie.number_of_seasons ? (
                <>
                  <span className="opacity-30">•</span>
                  <span>{movie.number_of_seasons} {movie.number_of_seasons === 1 ? "season" : "seasons"}</span>
                </>
              ) : null}
              {!isTv && movie.runtime ? (
                <>
                  {movie.release_date && <span className="opacity-30">•</span>}
                  <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
                </>
              ) : null}
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
        {isTv ? (
          <Link
            to="/app/movies/$id/watch"
            params={{ id: String(movie.id) }}
            search={{ season: 1, episode: 1 }}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-petal text-velvet font-bold text-sm tracking-[0.2em] uppercase shadow-[0_20px_60px_-20px] shadow-petal/60 active:scale-[0.98] transition-transform"
          >
            <Play className="size-4 fill-velvet" />
            Play Series · S1·E1
            <span className="opacity-60 text-[10px] tracking-widest">Pilot</span>
          </Link>
        ) : (
          <Link
            to="/app/movies/$id/watch"
            params={{ id: String(movie.id) }}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-petal text-velvet font-bold text-sm tracking-[0.2em] uppercase shadow-[0_20px_60px_-20px] shadow-petal/60 active:scale-[0.98] transition-transform"
          >
            <Play className="size-4 fill-velvet" />
            Play Movie
          </Link>
        )}


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
          <Link
            to="/app/movies/$id/party"
            params={{ id: String(movie.id) }}
            className="flex items-center justify-center gap-2 py-3 bg-surface border border-petal/30 rounded-xl text-[10px] font-semibold uppercase tracking-widest text-candle col-span-2"
          >
            <Sparkles className="size-3.5 text-petal" /> Same-room party · no sync
          </Link>
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

        {/* Episodes — editorial browser for series */}
        {isTv && movie.seasons?.length > 0 && (
          <div className="mt-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-px h-6 bg-petal/50 shrink-0" />
                <h3 className="font-serif italic text-2xl text-candle leading-none">Episodes</h3>
              </div>
              <span className="text-[10px] tracking-[0.2em] uppercase text-petal font-semibold shrink-0">
                {seasonEps.length ? `${seasonEps.length} eps` : "…"}
              </span>
            </div>

            {/* Season pill selector */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-6 px-6 pb-1">
              {movie.seasons
                .filter((s: any) => s.season_number > 0)
                .map((s: any) => {
                  const active = selectedSeason === s.season_number;
                  return (
                    <button
                      key={s.season_number}
                      onClick={() => setSelectedSeason(s.season_number)}
                      className={`shrink-0 px-4 py-2 rounded-full border text-xs font-medium transition-all ${
                        active
                          ? "border-petal bg-petal/10 text-petal shadow-[0_0_18px_-4px] shadow-petal/40"
                          : "border-white/10 bg-white/5 text-candle-muted/70 italic hover:text-candle"
                      }`}
                    >
                      {s.name || `Season ${s.season_number}`}
                      {s.episode_count ? (
                        <span className="ml-1.5 opacity-50 not-italic">· {s.episode_count}</span>
                      ) : null}
                    </button>
                  );
                })}
            </div>

            {/* Episode cards */}
            <div className="space-y-3">
              {seasonEps.length === 0 && (
                <>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl bg-velvet/60 animate-pulse" />
                  ))}
                </>
              )}
              {seasonEps.map((ep: any) => (
                <Link
                  key={ep.episode_number}
                  to="/app/movies/$id/episode/$season/$episode"
                  params={{
                    id: String(movie.id),
                    season: String(selectedSeason),
                    episode: String(ep.episode_number),
                  }}
                  className="group flex gap-3 p-2.5 rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent hover:border-petal/50 hover:from-petal/[0.06] transition-all"
                >
                  <div className="w-32 aspect-video rounded-xl overflow-hidden bg-velvet shrink-0 relative border border-white/5">
                    {ep.still_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                        alt={ep.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">📺</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-velvet/70 to-transparent" />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] font-bold tracking-widest text-petal">
                      E{String(ep.episode_number).padStart(2, "0")}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <div className="size-9 rounded-full bg-petal/90 flex items-center justify-center shadow-[0_0_20px_-2px] shadow-petal/70">
                        <Play className="size-4 fill-velvet text-velvet" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="font-serif italic text-base text-candle leading-tight truncate mb-1">
                      {ep.name || `Episode ${ep.episode_number}`}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-candle-muted/70 mb-1.5">
                      {ep.runtime ? `${ep.runtime} min` : "TBA"}
                      {ep.air_date ? ` · ${ep.air_date.slice(0, 4)}` : ""}
                    </div>
                    {ep.overview && (
                      <div className="text-[11px] text-candle/60 line-clamp-2 leading-relaxed">
                        {ep.overview}
                      </div>
                    )}
                  </div>
                </Link>
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
                      <img src={poster(s.poster_path, "w342")!} alt={s.title ?? s.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <p className="text-[10px] text-candle truncate mt-2 font-medium">{s.title ?? s.name}</p>
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

type CustomMovieRow = {
  id: string;
  title: string;
  year: number | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  runtime: number | null;
  genres: string[] | null;
};

function CustomMovieDetail({ customId }: { customId: string }) {
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const partner = prof?.partner;
  const navigate = useNavigate();
  const [movie, setMovie] = useState<CustomMovieRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from("custom_movies")
      .select("id, title, year, overview, poster_url, backdrop_url, runtime, genres")
      .eq("id", customId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setMovie(data as CustomMovieRow | null);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [customId]);

  async function sendToPartner() {
    if (!me || !partner || !movie) return;
    const link = `${window.location.origin}/app/movies/custom:${movie.id}/watch`;
    const content = `🎬 ${movie.title}${movie.year ? ` (${movie.year})` : ""}\n${movie.overview ?? ""}\n\n${link}`;
    const { error } = await supabase.from("messages").insert({
      sender_id: me.id, receiver_id: partner.id, content, type: "text",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Sent to " + partner.display_name);
      navigate({ to: "/app/chat/$peerId", params: { peerId: partner.id } });
    }
  }

  if (loading) {
    return (
      <div className="pt-10 px-5">
        <header className="flex items-center gap-3 mb-5">
          <Link to="/app/movies" search={{ q: "" }} className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        </header>
        <div className="aspect-[2/3] rounded-2xl bg-velvet animate-pulse" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="pt-10 px-5 text-center">
        <p className="text-candle-muted">Movie not found.</p>
        <Link to="/app/movies" search={{ q: "" }} className="text-petal text-sm">Back to Movies</Link>
      </div>
    );
  }

  return (
    <div className="pb-28 min-h-screen bg-background">
      <div className="relative h-[340px] w-full">
        {movie.backdrop_url && (
          <img src={movie.backdrop_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Link
          to="/app/movies"
          search={{ q: "" }}
          className="absolute top-10 left-5 size-10 rounded-full bg-velvet/40 backdrop-blur-md border border-border flex items-center justify-center z-20"
        >
          <ArrowLeft className="size-5 text-candle" />
        </Link>
        <span className="absolute top-10 right-5 z-20 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-petal text-velvet font-bold">
          Our Library
        </span>
      </div>

      <div className="relative px-6 -mt-32 z-10">
        <div className="flex items-end gap-5 mb-8">
          <div className="w-28 shrink-0 aspect-[2/3] rounded-lg overflow-hidden border border-border bg-velvet shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {movie.poster_url && <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />}
          </div>
          <div className="pb-2 min-w-0">
            <h1 className="font-serif font-semibold tracking-tight leading-[0.95] text-4xl text-candle mb-3">
              {movie.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-petal font-semibold">
              {movie.year && <span>{movie.year}</span>}
              {movie.year && movie.runtime ? <span className="opacity-30">•</span> : null}
              {movie.runtime ? <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span> : null}
              <span className="opacity-30">•</span>
              <span>Fully synced</span>
            </div>
            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {movie.genres.slice(0, 3).map((g) => (
                  <span key={g} className="text-[9px] px-2 py-0.5 rounded-full bg-surface border border-border text-candle">{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <Link
          to="/app/movies/$id/watch"
          params={{ id: `custom:${movie.id}` }}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-petal text-velvet font-bold text-sm tracking-wide shadow-[0_20px_60px_-20px] shadow-petal/60 active:scale-[0.98] transition-transform"
        >
          <Play className="size-4 fill-velvet" />
          PLAY MOVIE
        </Link>

        {movie.overview && (
          <div className="mt-8">
            <p className="text-sm text-candle/80 leading-relaxed font-light">{movie.overview}</p>
          </div>
        )}

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
          <Link
            to="/app/movies/$id/watch"
            params={{ id: `custom:${movie.id}` }}
            className="flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-semibold uppercase tracking-widest text-candle"
          >
            <Film className="size-3.5 opacity-60" /> Watch together
          </Link>
        </div>
      </div>

      {me && partner && (
        <WatchTogetherPanel
          me={me}
          partner={partner}
          movieId={0}
          movieTitle={movie.title}
          moviePoster={movie.poster_url}
          mediaType="movie"
        />
      )}
    </div>
  );
}


