import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search, Play, Flame, Sparkles, Heart, Star, Clock, Calendar, Ghost, Rocket, Tv, Film } from "lucide-react";
import {
  tmdbTrending,
  tmdbSearch,
  tmdbCategory,
  tmdbDiscover,
  tmdbMoviesBatch,
  tmdbTvTrending,
  tmdbTvCategory,
  tmdbTvDiscover,
  tmdbMulti,
  type TmdbMovie,
} from "@/lib/tmdb.functions";
import { MovieCard, poster } from "./app.movies";
import { readRecentMovies } from "@/lib/recent-movies";
import { supabase } from "@/integrations/supabase/client";

type CustomMovieRow = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  runtime: number | null;
  tmdb_id: number | null;
};

// Overlay admin-edited fields from custom_movies onto a raw TMDB result.
function applyOverride(m: TmdbMovie, ov: CustomMovieRow | undefined): TmdbMovie {
  if (!ov) return m;
  return {
    ...m,
    title: ov.title || m.title,
    overview: ov.overview ?? m.overview,
    poster_path: ov.poster_url ?? m.poster_path,
    backdrop_path: ov.backdrop_url ?? m.backdrop_path,
  };
}

export const Route = createFileRoute("/_authenticated/app/movies/")({
  component: Movies,
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
    type: (s.type === "movie" || s.type === "tv" ? s.type : "all") as "all" | "movie" | "tv",
    minRating: typeof s.minRating === "number" ? s.minRating : 0,
  }),
});

// TMDB genre IDs
const GENRE = {
  romance: 10749,
  comedy: 35,
  thriller: 53,
  horror: 27,
  scifi: 878,
  animation: 16,
} as const;

function Movies() {
  const { q, type, minRating } = Route.useSearch();
  const navigate = useNavigate();
  const trending = useServerFn(tmdbTrending);
  const multi = useServerFn(tmdbMulti);
  const category = useServerFn(tmdbCategory);
  const discover = useServerFn(tmdbDiscover);
  const batch = useServerFn(tmdbMoviesBatch);
  const tvTrending = useServerFn(tmdbTvTrending);
  const tvCategory = useServerFn(tmdbTvCategory);
  const tvDiscover = useServerFn(tmdbTvDiscover);

  const [input, setInput] = useState(q);
  type MultiItem = TmdbMovie & { media_type?: "movie" | "tv" };
  const [searchResults, setSearchResults] = useState<MultiItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [trendingList, setTrendingList] = useState<TmdbMovie[]>([]);
  const [popular, setPopular] = useState<TmdbMovie[]>([]);
  const [topRated, setTopRated] = useState<TmdbMovie[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TmdbMovie[]>([]);
  const [upcoming, setUpcoming] = useState<TmdbMovie[]>([]);
  const [dateNight, setDateNight] = useState<TmdbMovie[]>([]);
  const [thrillers, setThrillers] = useState<TmdbMovie[]>([]);
  const [feelGood, setFeelGood] = useState<TmdbMovie[]>([]);
  const [tvTrend, setTvTrend] = useState<TmdbMovie[]>([]);
  const [tvPopular, setTvPopular] = useState<TmdbMovie[]>([]);
  const [tvTop, setTvTop] = useState<TmdbMovie[]>([]);
  const [tvOnAir, setTvOnAir] = useState<TmdbMovie[]>([]);
  const [tvRomance, setTvRomance] = useState<TmdbMovie[]>([]);
  const [recent, setRecent] = useState<TmdbMovie[]>([]);
  const [custom, setCustom] = useState<CustomMovieRow[]>([]);
  const [overrides, setOverrides] = useState<Map<number, CustomMovieRow>>(new Map());
  const [loading, setLoading] = useState(true);

  const overlay = useMemo(
    () => (list: TmdbMovie[]) =>
      list
        .map((m) => applyOverride(m, overrides.get(m.id)))
        .filter((m) => (m.vote_average ?? 0) >= minRating),
    [overrides, minRating],
  );

  useEffect(() => { setInput(q); }, [q]);

  function updateSearch(patch: Partial<{ q: string; type: "all" | "movie" | "tv"; minRating: number }>) {
    navigate({
      to: "/app/movies",
      search: (prev: { q: string; type: "all" | "movie" | "tv"; minRating: number }) => ({ ...prev, ...patch }),
    });
  }

  // Search mode — multi so it can return both movies and TV
  useEffect(() => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    let alive = true;
    setSearchLoading(true);
    multi({ data: { q } })
      .then((r) => alive && setSearchResults(r as MultiItem[]))
      .catch(() => alive && setSearchResults([]))
      .finally(() => alive && setSearchLoading(false));
    return () => { alive = false; };
  }, [q]);

  // Browse mode — load all rails (movies + tv) in parallel
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      trending({ data: { window: "week" } }).catch(() => [] as TmdbMovie[]),
      category({ data: { kind: "popular" } }).catch(() => [] as TmdbMovie[]),
      category({ data: { kind: "top_rated" } }).catch(() => [] as TmdbMovie[]),
      category({ data: { kind: "now_playing" } }).catch(() => [] as TmdbMovie[]),
      category({ data: { kind: "upcoming" } }).catch(() => [] as TmdbMovie[]),
      discover({ data: { genre: GENRE.romance, sort: "popularity.desc" } }).catch(() => [] as TmdbMovie[]),
      discover({ data: { genre: GENRE.thriller, sort: "popularity.desc" } }).catch(() => [] as TmdbMovie[]),
      discover({ data: { genre: GENRE.comedy, sort: "popularity.desc" } }).catch(() => [] as TmdbMovie[]),
      tvTrending({ data: { window: "week" } }).catch(() => [] as TmdbMovie[]),
      tvCategory({ data: { kind: "popular" } }).catch(() => [] as TmdbMovie[]),
      tvCategory({ data: { kind: "top_rated" } }).catch(() => [] as TmdbMovie[]),
      tvCategory({ data: { kind: "on_the_air" } }).catch(() => [] as TmdbMovie[]),
      tvDiscover({ data: { genre: GENRE.romance, sort: "popularity.desc" } }).catch(() => [] as TmdbMovie[]),
    ]).then(([tr, pop, top, now, up, rom, thr, com, ttr, tpop, ttop, tonair, trom]) => {
      if (!alive) return;
      setTrendingList(tr);
      setPopular(pop);
      setTopRated(top);
      setNowPlaying(now);
      setUpcoming(up);
      setDateNight(rom);
      setThrillers(thr);
      setFeelGood(com);
      setTvTrend(ttr);
      setTvPopular(tpop);
      setTvTop(ttop);
      setTvOnAir(tonair);
      setTvRomance(trom);
      setLoading(false);
    });

    const ids = readRecentMovies();
    if (ids.length) {
      batch({ data: { ids } }).then((r) => alive && setRecent(r)).catch(() => {});
    }

    supabase
      .from("custom_movies")
      .select("id, title, year, poster_url, backdrop_url, overview, runtime, tmdb_id")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!alive || !data) return;
        const rows = data as CustomMovieRow[];
        setCustom(rows.filter((r) => !r.tmdb_id));
        const map = new Map<number, CustomMovieRow>();
        for (const r of rows) if (r.tmdb_id) map.set(r.tmdb_id, r);
        setOverrides(map);
      });

    return () => { alive = false; };
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateSearch({ q: input.trim() });
  }

  const featured = useMemo(() => {
    const source = type === "tv" ? tvTrend : trendingList;
    const m = source[0];
    return m ? applyOverride(m, overrides.get(m.id)) : undefined;
  }, [type, trendingList, tvTrend, overrides]);

  const showMovies = type !== "tv";
  const showShows = type !== "movie";

  // Filter bar reused in browse and search
  const filterBar = (
    <FilterBar
      type={type}
      minRating={minRating}
      onType={(t) => updateSearch({ type: t })}
      onMinRating={(r) => updateSearch({ minRating: r })}
    />
  );

  // Search results view
  if (q.trim()) {
    const filtered = (searchResults ?? [])
      .filter((m) => (type === "all" ? true : (m.media_type ?? "movie") === type))
      .filter((m) => (m.vote_average ?? 0) >= minRating);
    return (
      <div className="pt-10 px-5 pb-24">
        <SearchHeader
          input={input}
          setInput={setInput}
          onSubmit={onSubmit}
          onClear={() => { setInput(""); updateSearch({ q: "" }); }}
        />
        {filterBar}
        <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-3 mt-4">
          Results for “{q}” · {filtered.length}
        </p>
        {searchLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl bg-velvet animate-pulse" />
            ))}
          </div>
        ) : !filtered.length ? (
          <p className="text-sm text-candle-muted text-center mt-10">Nothing matches those filters.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {overlay(filtered).map((m) => (
              <div key={m.id} className="relative">
                <MovieCard id={m.id} title={m.title} poster_path={m.poster_path} vote_average={m.vote_average} />
                {(m as MultiItem).media_type === "tv" && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 h-5 px-1.5 rounded-full bg-velvet/85 backdrop-blur border border-petal/30 text-petal text-[9px] uppercase tracking-widest">
                    <Tv className="size-2.5" /> TV
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Browse view with rails
  return (
    <div className="pb-28 min-h-screen bg-background">
      {/* Featured hero */}
      {featured && (
        <FeaturedHero movie={featured} isTv={type === "tv"} />
      )}

      <div className="px-5">
        <SearchHeader
          input={input}
          setInput={setInput}
          onSubmit={onSubmit}
          onClear={() => setInput("")}
          inline
        />

        {filterBar}

        {custom.length > 0 && showMovies && (
          <CustomRail title="Fresh Arrivals" movies={custom} />
        )}

        {recent.length > 0 && (
          <Rail
            title="Continue Watching"
            icon={<Clock className="size-3.5 text-petal" />}
            movies={overlay(recent)}
            variant="wide"
          />
        )}

        {showMovies && (
          <>
            <Rail
              title="Trending Movies"
              icon={<Flame className="size-3.5 text-petal" />}
              movies={overlay(trendingList.slice(type === "movie" ? 0 : 1))}
              loading={loading}
            />
            <Rail
              title="Date Night · Romance"
              icon={<Heart className="size-3.5 text-petal" />}
              movies={overlay(dateNight)}
              loading={loading}
            />
            <Rail
              title="In Theaters Now"
              icon={<Play className="size-3.5 text-petal" />}
              movies={overlay(nowPlaying)}
              loading={loading}
            />
            <Rail
              title="Feel-Good · Comedy"
              icon={<Sparkles className="size-3.5 text-petal" />}
              movies={overlay(feelGood)}
              loading={loading}
            />
            <Rail
              title="Popular Movies"
              icon={<Star className="size-3.5 text-petal" />}
              movies={overlay(popular)}
              loading={loading}
            />
            <Rail
              title="Edge of Your Seat · Thrillers"
              icon={<Ghost className="size-3.5 text-petal" />}
              movies={overlay(thrillers)}
              loading={loading}
            />
            <Rail
              title="Top Rated Movies"
              icon={<Star className="size-3.5 text-petal" />}
              movies={overlay(topRated)}
              loading={loading}
            />
            <Rail
              title="Coming Soon"
              icon={<Calendar className="size-3.5 text-petal" />}
              movies={overlay(upcoming)}
              loading={loading}
            />
          </>
        )}

        {showShows && (
          <>
            <Rail
              title="Trending Shows"
              icon={<Tv className="size-3.5 text-petal" />}
              movies={overlay(tvTrend)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="Popular Shows"
              icon={<Star className="size-3.5 text-petal" />}
              movies={overlay(tvPopular)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="On Air Tonight"
              icon={<Play className="size-3.5 text-petal" />}
              movies={overlay(tvOnAir)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="Romance Series"
              icon={<Heart className="size-3.5 text-petal" />}
              movies={overlay(tvRomance)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="Top Rated Series"
              icon={<Star className="size-3.5 text-petal" />}
              movies={overlay(tvTop)}
              loading={loading}
              tvBadge
            />
          </>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <GenreChip label="Sci-Fi" icon={<Rocket className="size-4" />} genre={GENRE.scifi} />
          <GenreChip label="Animation" icon={<Sparkles className="size-4" />} genre={GENRE.animation} />
          <GenreChip label="Horror" icon={<Ghost className="size-4" />} genre={GENRE.horror} />
          <GenreChip label="Romance" icon={<Heart className="size-4" />} genre={GENRE.romance} />
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  type, minRating, onType, onMinRating,
}: {
  type: "all" | "movie" | "tv";
  minRating: number;
  onType: (t: "all" | "movie" | "tv") => void;
  onMinRating: (r: number) => void;
}) {
  const typeOptions: { id: "all" | "movie" | "tv"; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "All", icon: <Sparkles className="size-3" /> },
    { id: "movie", label: "Movies", icon: <Film className="size-3" /> },
    { id: "tv", label: "Shows", icon: <Tv className="size-3" /> },
  ];
  const ratingOptions = [0, 6, 7, 8, 9];
  return (
    <div className="mb-2 space-y-2">
      <div className="flex items-center gap-1.5">
        {typeOptions.map((opt) => {
          const active = type === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onType(opt.id)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold uppercase tracking-widest border transition-all ${
                active
                  ? "bg-petal text-velvet border-petal shadow-[0_6px_18px_-6px_rgba(238,130,175,0.55)]"
                  : "bg-surface border-border text-candle-muted hover:text-candle hover:border-petal/40"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] uppercase tracking-widest text-candle-muted shrink-0">Rating</span>
        {ratingOptions.map((r) => {
          const active = minRating === r;
          return (
            <button
              key={r}
              onClick={() => onMinRating(r)}
              className={`shrink-0 inline-flex items-center gap-0.5 h-7 px-2.5 rounded-full text-[11px] border transition-all ${
                active
                  ? "bg-petal/15 border-petal text-petal"
                  : "bg-surface border-border text-candle-muted hover:text-candle hover:border-petal/40"
              }`}
            >
              {r === 0 ? "Any" : (<><Star className="size-2.5 fill-petal text-petal" />{r}+</>)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchHeader({
  input, setInput, onSubmit, onClear, inline = false,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  inline?: boolean;
}) {
  return (
    <>
      {!inline && (
        <header className="flex items-center gap-3 mb-5">
          <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-petal">Tonight</p>
            <h1 className="font-serif text-2xl italic">Movies</h1>
          </div>
        </header>
      )}
      <form onSubmit={onSubmit} className="mb-6 flex items-center gap-2 px-4 h-11 rounded-full bg-surface border border-border">
        <Search className="size-4 text-candle-muted" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search any movie…"
          className="flex-1 bg-transparent outline-none text-sm text-candle placeholder:text-candle-muted"
        />
        {input && (
          <button type="button" onClick={onClear} className="text-xs text-petal">Clear</button>
        )}
      </form>
    </>
  );
}

function FeaturedHero({ movie }: { movie: TmdbMovie }) {
  return (
    <div className="relative h-[380px] w-full overflow-hidden">
      {movie.backdrop_path && (
        <img
          src={poster(movie.backdrop_path, "w500")!}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <Link
        to="/app"
        className="absolute top-10 left-5 size-10 rounded-full bg-velvet/40 backdrop-blur-md border border-border flex items-center justify-center z-20"
      >
        <ArrowLeft className="size-5 text-candle" />
      </Link>
      <div className="absolute top-10 right-5 z-20">
        <p className="text-[10px] uppercase tracking-widest text-petal text-right">Tonight</p>
        <h1 className="font-serif text-2xl italic text-candle">Movies</h1>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-petal font-bold mb-2 flex items-center gap-2">
          <Flame className="size-3" /> #1 Trending
        </p>
        <h2 className="font-serif font-semibold text-3xl leading-[0.95] text-candle mb-2 line-clamp-2">
          {movie.title}
        </h2>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-candle-muted mb-4">
          {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
          {movie.vote_average ? (
            <>
              <span className="opacity-40">•</span>
              <span>★ {movie.vote_average.toFixed(1)}</span>
            </>
          ) : null}
        </div>
        <Link
          to="/app/movies/$id"
          params={{ id: String(movie.id) }}
          className="inline-flex items-center gap-2 py-3 px-6 rounded-full bg-petal text-velvet font-bold text-xs uppercase tracking-wider shadow-[0_20px_60px_-20px] shadow-petal/60"
        >
          <Play className="size-3.5 fill-velvet" />
          Watch Now
        </Link>
      </div>
    </div>
  );
}

function Rail({
  title, icon, movies, loading = false, variant = "poster",
}: {
  title: string;
  icon: React.ReactNode;
  movies: TmdbMovie[];
  loading?: boolean;
  variant?: "poster" | "wide";
}) {
  if (!loading && movies.length === 0) return null;
  return (
    <section className="mt-8">
      <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-candle-muted mb-4 flex items-center gap-2.5">
        {icon}
        <span>{title}</span>
        <div className="h-px flex-1 bg-border" />
      </h3>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`shrink-0 rounded-xl bg-velvet animate-pulse ${
                  variant === "wide" ? "w-40 h-24" : "w-28 aspect-[2/3]"
                }`}
              />
            ))
          : movies.map((m) =>
              variant === "wide" ? (
                <Link
                  key={m.id}
                  to="/app/movies/$id"
                  params={{ id: String(m.id) }}
                  className="w-44 shrink-0 group"
                >
                  <div className="aspect-video rounded-xl overflow-hidden bg-velvet border border-border relative">
                    {m.backdrop_path || m.poster_path ? (
                      <img
                        src={poster(m.backdrop_path ?? m.poster_path, "w342")!}
                        alt={m.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-velvet/80 via-transparent to-transparent" />
                    <div className="absolute bottom-1.5 left-2 right-2">
                      <p className="text-[11px] font-semibold text-candle truncate">{m.title}</p>
                    </div>
                    <div className="absolute top-1.5 right-1.5 size-7 rounded-full bg-petal/90 flex items-center justify-center">
                      <Play className="size-3 fill-velvet text-velvet" />
                    </div>
                  </div>
                </Link>
              ) : (
                <div key={m.id} className="w-28 shrink-0">
                  <MovieCard
                    id={m.id}
                    title={m.title}
                    poster_path={m.poster_path}
                    vote_average={m.vote_average}
                  />
                </div>
              ),
            )}
      </div>
    </section>
  );
}

function GenreChip({ label, icon, genre }: { label: string; icon: React.ReactNode; genre: number }) {
  return (
    <Link
      to="/app/movies"
      search={{ q: label }}
      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-surface border border-border text-candle text-xs font-semibold uppercase tracking-widest hover:border-petal/50 transition-colors"
    >
      <span className="text-petal">{icon}</span>
      {label}
    </Link>
  );
}

function CustomRail({ title, movies }: { title: string; movies: CustomMovieRow[] }) {
  return (
    <section className="mt-8">
      <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-candle-muted mb-4 flex items-center gap-2.5">
        <Sparkles className="size-3.5 text-petal" />
        <span>{title}</span>
        <div className="h-px flex-1 bg-border" />
      </h3>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2">
        {movies.map((m) => (
          <Link
            key={m.id}
            to="/app/movies/$id"
            params={{ id: `custom:${m.id}` }}
            className="w-28 shrink-0 group"
          >
            <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-velvet border border-border relative">
              {m.poster_url ? (
                <img src={m.poster_url} alt={m.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-candle truncate">{m.title}</p>
            {m.year && <p className="text-[10px] text-candle-muted">{m.year}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}
