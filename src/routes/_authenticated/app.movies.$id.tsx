import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, Film, Play, ExternalLink, RefreshCw, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { tmdbMovie } from "@/lib/tmdb.functions";
import { watchmodeSources, type WatchSource } from "@/lib/watchmode.functions";
import { poster } from "./app.movies";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/movies/$id")({
  component: MovieDetail,
});

const TYPE_LABEL: Record<string, string> = {
  sub: "Stream", free: "Free", rent: "Rent", buy: "Buy", tve: "TV",
};

type EmbedSource = { id: string; label: string; url: (tmdb: number) => string };

const EMBED_SOURCES: EmbedSource[] = [
  { id: "vidking.net",     label: "VidKing",     url: (id) => `https://www.vidking.net/embed/movie/${id}` },
  { id: "vidking.net.alt", label: "VidKing Alt", url: (id) => `https://vidking.net/embed/movie/${id}?autoPlay=false` },
];

function MovieDetail() {
  const { id } = Route.useParams();
  const fetchMovie = useServerFn(tmdbMovie);
  const fetchSources = useServerFn(watchmodeSources);
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const partner = prof?.partner;
  const [movie, setMovie] = useState<any>(null);
  const [sources, setSources] = useState<WatchSource[]>([]);
  const [region, setRegion] = useState<string>("US");
  const [sourceIdx, setSourceIdx] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [started, setStarted] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const navigate = useNavigate();
  const isWatchRoute = typeof window !== "undefined" && window.location.pathname.endsWith("/watch");

  useEffect(() => {
    fetchMovie({ data: { id: Number(id) } }).then(setMovie).catch(() => setMovie(null));
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
  const embedSrc = EMBED_SOURCES[sourceIdx].url(Number(id));

  function openFullscreen() {
    const el = document.getElementById("movie-frame");
    if (el && (el as any).requestFullscreen) (el as any).requestFullscreen();
  }

  function switchEmbedSource(i: number) {
    setSourceIdx(i);
    setStarted(true);
    setPlayerLoading(true);
    setIframeKey((key) => key + 1);
  }

  if (isWatchRoute) {
    return (
      <div className="pt-8 pb-24">
        <header className="px-5 pb-3 flex items-center gap-3 max-w-6xl mx-auto">
          <Link to="/app/movies/$id" params={{ id }} className="text-candle-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-petal">Now playing</p>
            <h1 className="font-serif text-lg md:text-2xl italic truncate">
              {movie?.title ?? "Loading…"}
              {movie?.release_date && (
                <span className="text-candle-muted not-italic font-sans text-sm md:text-base ml-2">
                  ({movie.release_date.slice(0, 4)})
                </span>
              )}
            </h1>
          </div>
          <button
            onClick={openFullscreen}
            className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle"
            aria-label="Fullscreen"
          >
            <Maximize2 className="size-4" />
          </button>
        </header>

        <div className="px-3 md:px-5 max-w-6xl mx-auto">
          <div className="relative rounded-2xl md:rounded-3xl overflow-hidden bg-black border border-border aspect-video">
            {started ? (
              <iframe
                id="movie-frame"
                key={`${sourceIdx}-${iframeKey}`}
                src={embedSrc}
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share"
                onLoad={() => setPlayerLoading(false)}
                allowFullScreen
              />
            ) : (
              <button
                onClick={() => {
                  setStarted(true);
                  setPlayerLoading(true);
                }}
                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 group"
                aria-label="Tap to play"
                style={
                  movie?.backdrop_path
                    ? {
                        backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45)), url(https://image.tmdb.org/t/p/w1280${movie.backdrop_path})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <span className="size-16 md:size-20 rounded-full bg-petal text-velvet flex items-center justify-center shadow-2xl shadow-petal/40 group-hover:scale-105 transition">
                  <Play className="size-7 md:size-9 fill-velvet ml-1" />
                </span>
                <span className="text-candle text-sm md:text-base font-medium">Tap to play</span>
                <span className="text-candle-muted text-[11px] md:text-xs">Source: {EMBED_SOURCES[sourceIdx].label}</span>
              </button>
            )}
            {started && playerLoading && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-velvet/80">
                <div className="flex flex-col items-center gap-3 text-candle">
                  <RefreshCw className="size-6 animate-spin text-petal" />
                  <span className="text-xs uppercase tracking-widest text-candle-muted">Loading player</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] uppercase tracking-widest text-candle-muted shrink-0 pr-1">Sources</span>
            {EMBED_SOURCES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => switchEmbedSource(i)}
                className={`shrink-0 px-3 h-8 rounded-full text-xs border transition ${
                  i === sourceIdx ? "bg-petal text-velvet border-petal" : "bg-surface text-candle border-border hover:border-petal/60"
                }`}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => {
                setStarted(true);
                setPlayerLoading(true);
                setIframeKey((key) => key + 1);
              }}
              className="shrink-0 size-8 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
              aria-label="Reload"
              title="Reload"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>

          <a
            href={embedSrc}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 h-10 rounded-full bg-surface border border-border text-candle text-xs"
          >
            <ExternalLink className="size-3.5" /> Open in new tab if player is blocked
          </a>

          <p className="mt-3 text-[11px] text-candle-muted leading-relaxed">
            Streams come from third-party providers. If one is slow or stuck, switch sources.
          </p>

          <Link
            to="/app/movies/$id"
            params={{ id }}
            className="mt-5 flex items-center justify-center gap-2 h-11 rounded-full bg-surface border border-border text-candle text-sm"
          >
            Back to details
          </Link>
        </div>
      </div>
    );
  }

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
    <div className="pb-24">
      <div className="relative h-56">
        {movie.backdrop_path && (
          <img src={poster(movie.backdrop_path, "w500")!} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-velvet/40 via-velvet/60 to-background" />
        <Link to="/app/movies" search={{ q: "" }} className="absolute top-10 left-5 size-9 rounded-full bg-velvet/70 backdrop-blur flex items-center justify-center">
          <ArrowLeft className="size-4 text-candle" />
        </Link>
      </div>

      <div className="px-5 -mt-20 relative">
        <div className="flex gap-4">
          <div className="w-28 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden border border-border bg-velvet">
            {movie.poster_path && <img src={poster(movie.poster_path, "w342")!} alt={movie.title} className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 pt-12">
            <h1 className="font-serif italic text-2xl leading-tight">{movie.title}</h1>
            <p className="text-xs text-candle-muted mt-1">
              {movie.release_date?.slice(0, 4)} · {movie.runtime ?? "?"} min · ★ {movie.vote_average?.toFixed(1)}
            </p>
            {movie.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {movie.genres.slice(0, 3).map((g: any) => (
                  <span key={g.id} className="text-[10px] px-2 py-0.5 rounded-full bg-petal-soft text-petal">{g.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Big Play CTA — navigates to dedicated watch page */}
        <Link
          to="/app/movies/$id/watch"
          params={{ id: String(movie.id) }}
          className="mt-5 flex items-center justify-center gap-2 h-14 rounded-full bg-petal text-velvet font-semibold text-base shadow-2xl shadow-petal/40 active:scale-[0.98] transition"
        >
          <Play className="size-5 fill-velvet" /> Play Movie
        </Link>

        {movie.overview && (
          <p className="mt-5 text-sm text-candle leading-relaxed">{movie.overview}</p>
        )}

        {director && <p className="mt-3 text-xs text-candle-muted">Directed by <span className="text-candle">{director}</span></p>}

        <div className="mt-3 grid grid-cols-2 gap-3">
          {partner ? (
            <button onClick={sendToPartner} className="flex items-center justify-center gap-2 h-11 rounded-full bg-surface border border-border text-candle text-sm">
              <Send className="size-4" /> Send to {partner.display_name.split(" ")[0]}
            </button>
          ) : (
            <Link to="/app/invite" className="flex items-center justify-center gap-2 h-11 rounded-full bg-surface border border-border text-candle text-sm">
              <Send className="size-4" /> Invite to share
            </Link>
          )}
          <button onClick={watchTogether} className="flex items-center justify-center gap-2 h-11 rounded-full bg-surface border border-border text-candle text-sm">
            <Film className="size-4" /> Watch together
          </button>
        </div>



        {trailer && (
          <a
            href={`https://www.youtube.com/watch?v=${trailer.key}`}
            target="_blank" rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 h-11 rounded-full bg-surface border border-border text-candle text-sm"
          >
            <Play className="size-4 text-petal" /> Watch trailer
          </a>
        )}

        {sources.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-candle-muted">Where to watch</p>
              {regions.length > 1 && (
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="text-[11px] bg-surface border border-border rounded-full px-2 py-1 text-candle"
                >
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
            </div>
            <div className="space-y-3">
              {(["sub", "free", "rent", "buy", "tve"] as const).map((t) =>
                grouped[t]?.length ? (
                  <div key={t}>
                    <p className="text-[10px] text-petal mb-1.5">{TYPE_LABEL[t]}</p>
                    <div className="flex flex-wrap gap-2">
                      {grouped[t].map((s) => (
                        <a
                          key={`${s.source_id}-${s.region}-${s.type}`}
                          href={s.web_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 h-8 rounded-full bg-surface border border-border text-candle hover:border-petal/60 transition"
                        >
                          {s.name}
                          {s.price ? <span className="text-candle-muted">· ${s.price}</span> : null}
                          <ExternalLink className="size-3 text-candle-muted" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
            <p className="mt-2 text-[10px] text-candle-muted">Availability via Watchmode.</p>
          </div>
        )}

        {cast.length > 0 && (
          <div className="mt-6">

            <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Cast</p>
            <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2">
              {cast.map((c: any) => (
                <div key={c.id} className="w-16 shrink-0 text-center">
                  <div className="size-16 rounded-full overflow-hidden bg-velvet mx-auto">
                    {c.profile_path && <img src={poster(c.profile_path, "w185")!} alt={c.name} className="w-full h-full object-cover" />}
                  </div>
                  <p className="text-[10px] text-candle mt-1 truncate">{c.name}</p>
                  <p className="text-[9px] text-candle-muted truncate">{c.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {movie.similar?.results?.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">More like this</p>
            <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2">
              {movie.similar.results.slice(0, 10).map((s: any) => (
                <Link
                  key={s.id} to="/app/movies/$id" params={{ id: String(s.id) }}
                  className="w-24 shrink-0"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-velvet">
                    {s.poster_path && <img src={poster(s.poster_path, "w185")!} alt={s.title} className="w-full h-full object-cover" />}
                  </div>
                  <p className="text-[10px] text-candle truncate mt-1">{s.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
