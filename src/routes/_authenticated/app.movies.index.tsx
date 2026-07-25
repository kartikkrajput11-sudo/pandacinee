import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search, Play, Flame, Sparkles, Heart, Star, Clock, Calendar, Ghost, Rocket, Tv, Film } from "lucide-react";
import {
  tmdbTrending,
  
  tmdbCategory,
  tmdbDiscover,
  tmdbMoviesBatch,
  tmdbTvTrending,
  tmdbTvCategory,
  tmdbTvDiscover,
  tmdbTvByCountry,
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
    type: (s.type === "movie" || s.type === "tv" || s.type === "series" ? s.type : "all") as "all" | "movie" | "tv" | "series",
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
  const [suggestions, setSuggestions] = useState<MultiItem[]>([]);

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
  const [tvUS, setTvUS] = useState<TmdbMovie[]>([]);
  const [tvUK, setTvUK] = useState<TmdbMovie[]>([]);
  const [tvIN, setTvIN] = useState<TmdbMovie[]>([]);
  const [tvPK, setTvPK] = useState<TmdbMovie[]>([]);
  const [tvTR, setTvTR] = useState<TmdbMovie[]>([]);
  const byCountry = useServerFn(tmdbTvByCountry);
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

  function updateSearch(patch: Partial<{ q: string; type: "all" | "movie" | "tv" | "series"; minRating: number }>) {
    navigate({
      to: "/app/movies",
      search: (prev: { q: string; type: "all" | "movie" | "tv" | "series"; minRating: number }) => ({ ...prev, ...patch }),
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

  // Live suggestions (YouTube-style) as the user types — tolerant to typos via TMDB fuzzy match
  useEffect(() => {
    const term = input.trim();
    if (term.length < 2 || term === q.trim()) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      multi({ data: { q: term } })
        .then((r) => {
          if (!alive) return;
          const items = (r as MultiItem[])
            .filter((m) => m.title && (m.poster_path || m.backdrop_path))
            .slice(0, 8);
          setSuggestions(items);
        })
        .catch(() => alive && setSuggestions([]));
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [input, q]);


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

    // Regional broadcast-TV rails — scripted / reality / talk shows only, excluding web miniseries.
    Promise.all([
      byCountry({ data: { country: "US" } }).catch(() => [] as TmdbMovie[]),
      byCountry({ data: { country: "GB" } }).catch(() => [] as TmdbMovie[]),
      byCountry({ data: { country: "IN" } }).catch(() => [] as TmdbMovie[]),
      byCountry({ data: { country: "PK" } }).catch(() => [] as TmdbMovie[]),
      byCountry({ data: { country: "TR" } }).catch(() => [] as TmdbMovie[]),
    ]).then(([us, gb, ind, pk, tr]) => {
      if (!alive) return;
      setTvUS(us); setTvUK(gb); setTvIN(ind); setTvPK(pk); setTvTR(tr);
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
    const source = type === "tv" || type === "series" ? tvTrend : trendingList;
    if (source.length === 0) return undefined;
    const recentIds = new Set(recent.map((r) => r.id));
    const pick = source.find((m) => !recentIds.has(m.id)) ?? source[0];
    return applyOverride(pick, overrides.get(pick.id));
  }, [type, trendingList, tvTrend, overrides, recent]);


  const showMovies = type === "all" || type === "movie";
  const showShows = type === "all" || type === "tv";
  const showSeries = type === "all" || type === "series";

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
      .filter((m) => (type === "all" ? true : type === "series" ? (m.media_type ?? "movie") === "tv" : (m.media_type ?? "movie") === type))
      .filter((m) => (m.vote_average ?? 0) >= minRating);
    return (
      <div className="pt-10 px-5 pb-24">
        <SearchHeader
          input={input}
          setInput={setInput}
          onSubmit={onSubmit}
          onClear={() => { setInput(""); updateSearch({ q: "" }); }}
          suggestions={suggestions}
          onPick={(title) => { setInput(title); setSuggestions([]); updateSearch({ q: title }); }}
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
                <MovieCard id={m.id} title={m.title} poster_path={m.poster_path} vote_average={m.vote_average} mediaType={(m as MultiItem).media_type === "tv" ? "tv" : "movie"} />
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
        <div data-tour="movies-hero"><FeaturedHero movie={featured} isTv={type === "tv" || type === "series"} /></div>
      )}


      <div className="px-5">
        <SearchHeader
          input={input}
          setInput={setInput}
          onSubmit={onSubmit}
          onClear={() => setInput("")}
          suggestions={suggestions}
          onPick={(title) => { setInput(title); setSuggestions([]); updateSearch({ q: title }); }}
          inline

        />

        {filterBar}

        {custom.length > 0 && showMovies && (
          <CustomRail title="Fresh Arrivals" movies={custom} />
        )}

        {recent.length > 0 && type === "all" && (
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
              title="Top Shows"
              icon={<Star className="size-3.5 text-petal" />}
              movies={overlay(tvTop)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="US Television"
              icon={<Tv className="size-3.5 text-petal" />}
              movies={overlay(tvUS)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="UK Television"
              icon={<Tv className="size-3.5 text-petal" />}
              movies={overlay(tvUK)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="Indian TV Shows"
              icon={<Tv className="size-3.5 text-petal" />}
              movies={overlay(tvIN)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="Pakistani Dramas"
              icon={<Tv className="size-3.5 text-petal" />}
              movies={overlay(tvPK)}
              loading={loading}
              tvBadge
            />
            <Rail
              title="Turkish Dramas"
              icon={<Tv className="size-3.5 text-petal" />}
              movies={overlay(tvTR)}
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
          </>
        )}


        {showSeries && (
          <>
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
  type: "all" | "movie" | "tv" | "series";
  minRating: number;
  onType: (t: "all" | "movie" | "tv" | "series") => void;
  onMinRating: (r: number) => void;
}) {
  const typeOptions: { id: "all" | "movie" | "tv" | "series"; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "All", icon: <Sparkles className="size-3" /> },
    { id: "movie", label: "Movies", icon: <Film className="size-3" /> },
    { id: "tv", label: "Shows", icon: <Tv className="size-3" /> },
    { id: "series", label: "Series", icon: <Play className="size-3" /> },
  ];
  const ratingOptions = [0, 6, 7, 8, 9];
  return (
    <div className="mb-4 space-y-4">
      <div className="flex items-center gap-8 border-b border-white/5">
        {typeOptions.map((opt) => {
          const active = type === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onType(opt.id)}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                active ? "text-candle" : "text-candle-muted/60 hover:text-candle"
              }`}
            >
              {opt.label}
              {active && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-petal rounded-full shadow-[0_0_10px] shadow-petal/60" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {ratingOptions.map((r) => {
          const active = minRating === r;
          const label = r === 0 ? "All Ratings" : r >= 8 ? `${r}.0+ Score` : `${r}.0+ Score`;
          return (
            <button
              key={r}
              onClick={() => onMinRating(r)}
              className={`shrink-0 px-4 py-2 rounded-full border text-xs font-medium transition-all ${
                active
                  ? "border-petal bg-petal/5 text-petal"
                  : "border-white/10 bg-white/5 text-candle-muted/70 italic tracking-wide hover:text-candle"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function SearchHeader({
  input, setInput, onSubmit, onClear, inline = false, suggestions = [], onPick,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  inline?: boolean;
  suggestions?: (TmdbMovie & { media_type?: "movie" | "tv" })[];
  onPick?: (title: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const open = focused && suggestions.length > 0;
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
      <form onSubmit={onSubmit} className={`mb-5 relative ${inline ? "sticky top-0 z-40 -mx-5 px-5 py-4 bg-background/80 backdrop-blur-2xl" : ""}`}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-candle-muted/50" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search titles, genres…"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-16 text-sm text-candle placeholder:text-candle-muted/40 focus:outline-none focus:border-petal/40 transition-all shadow-inner"
          />
          {input && (
            <button type="button" onClick={onClear} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-petal">Clear</button>
          )}
          {open && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-velvet/95 backdrop-blur-2xl border border-white/10 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] overflow-hidden z-50">
              {suggestions.map((s) => {
                const year = s.release_date ? s.release_date.slice(0, 4) : "";
                return (
                  <button
                    key={`${s.media_type ?? "movie"}-${s.id}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick?.(s.title)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left transition-colors"
                  >
                    {s.poster_path ? (
                      <img src={poster(s.poster_path, "w185") ?? ""} alt="" className="w-8 h-11 object-cover rounded-md flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-11 rounded-md bg-white/5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Search className="size-3 text-candle-muted/50 flex-shrink-0" />
                        <p className="text-sm text-candle truncate">{s.title}</p>
                      </div>
                      <p className="text-[10px] uppercase tracking-widest text-candle-muted/60 mt-0.5">
                        {(s.media_type ?? "movie") === "tv" ? "Series" : "Movie"}{year ? ` · ${year}` : ""}
                        {s.vote_average ? ` · ★ ${s.vote_average.toFixed(1)}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </form>

    </>
  );
}


function FeaturedHero({ movie, isTv = false }: { movie: TmdbMovie; isTv?: boolean }) {
  return (
    <div className="relative h-[420px] w-full overflow-hidden">
      {movie.backdrop_path && (
        <img
          src={poster(movie.backdrop_path, "w500")!}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-transparent" />
      <Link
        to="/app"
        className="absolute top-10 left-5 size-10 rounded-full bg-velvet/40 backdrop-blur-md border border-white/10 flex items-center justify-center z-20"
      >
        <ArrowLeft className="size-5 text-candle" />
      </Link>
      <div className="absolute top-10 right-5 z-20 text-right">
        <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Tonight</p>
        <h1 className="font-serif text-2xl italic text-candle leading-none mt-1">Movies</h1>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-7">
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-petal text-velvet text-[10px] font-bold tracking-[0.2em] uppercase rounded-sm italic shadow-[0_0_18px_-2px] shadow-petal/60">
            <Flame className="size-2.5" /> #1 Trending
          </span>
        </div>
        <h2 className="font-serif italic text-5xl leading-[0.95] text-candle mb-4 tracking-tight line-clamp-2">
          {movie.title}
        </h2>
        <div className="flex items-center gap-3">
          <Link
            to="/app/movies/$id"
            params={{ id: String(movie.id) }}
            search={{ type: isTv ? "tv" : "movie" }}
            className="inline-flex items-center gap-2 py-3 px-7 rounded-full bg-candle text-velvet font-semibold text-sm shadow-[0_20px_60px_-20px] shadow-black/60 hover:brightness-110 transition-all"
          >
            <Play className="size-4 fill-velvet" />
            Watch Now
          </Link>
          <div className="text-[10px] uppercase tracking-[0.2em] text-candle-muted italic">
            {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
            {movie.vote_average ? <span className="ml-2 text-petal">★ {movie.vote_average.toFixed(1)}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}


function Rail({
  title, icon, movies, loading = false, variant = "poster", tvBadge = false, category,
}: {
  title: string;
  icon: React.ReactNode;
  movies: TmdbMovie[];
  loading?: boolean;
  variant?: "poster" | "wide";
  tvBadge?: boolean;
  category?: string;
}) {
  if (!loading && movies.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-px h-6 bg-petal/50 shrink-0" />
          <h3 className="font-serif italic text-2xl text-candle leading-none truncate">{title}</h3>
        </div>
        {category ? (
          <Link
            to="/app/movies/list"
            search={{ category }}
            className="text-[10px] tracking-[0.2em] uppercase text-petal font-semibold shrink-0 hover:text-candle transition-colors"
          >
            View All
          </Link>
        ) : (
          <span className="text-[10px] tracking-[0.2em] uppercase text-petal font-semibold shrink-0">View All</span>
        )}
      </div>

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
                  search={{ type: tvBadge ? "tv" : "movie" }}
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
                <div key={m.id} className="w-28 shrink-0 relative">
                  <MovieCard
                    id={m.id}
                    title={m.title}
                    poster_path={m.poster_path}
                    vote_average={m.vote_average}
                    mediaType={tvBadge ? "tv" : (m as any).media_type === "tv" ? "tv" : "movie"}
                  />
                  {tvBadge && (
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-velvet/85 backdrop-blur border border-petal/30 text-petal text-[8px] uppercase tracking-widest">
                      TV
                    </span>
                  )}
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
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-px h-6 bg-petal/50 shrink-0" />
          <h3 className="font-serif italic text-2xl text-candle leading-none truncate">{title}</h3>
        </div>
        <span className="text-[10px] tracking-[0.2em] uppercase text-petal font-semibold shrink-0">Fresh</span>
      </div>

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
