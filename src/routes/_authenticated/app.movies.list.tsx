import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import {
  tmdbTrending,
  tmdbCategory,
  tmdbDiscover,
  tmdbTvCategory,
  tmdbTvDiscover,
  tmdbTvByCountry,
  type TmdbMovie,
} from "@/lib/tmdb.functions";
import { MovieCard } from "./app.movies";

const GENRE = { romance: 10749, comedy: 35, thriller: 53 } as const;

type CatKey =
  | "trending-movies"
  | "date-night"
  | "now-playing"
  | "feel-good"
  | "popular-movies"
  | "thrillers"
  | "top-rated-movies"
  | "upcoming"
  | "top-shows"
  | "tv-us"
  | "tv-uk"
  | "tv-in"
  | "tv-pk"
  | "tv-tr"
  | "popular-shows"
  | "on-air"
  | "romance-series"
  | "top-rated-series";

const META: Record<CatKey, { title: string; eyebrow: string; tv: boolean }> = {
  "trending-movies": { title: "Trending Movies", eyebrow: "This Week", tv: false },
  "date-night": { title: "Date Night · Romance", eyebrow: "For Two", tv: false },
  "now-playing": { title: "In Theaters Now", eyebrow: "Playing", tv: false },
  "feel-good": { title: "Feel-Good · Comedy", eyebrow: "Light & Bright", tv: false },
  "popular-movies": { title: "Popular Movies", eyebrow: "Loved by Many", tv: false },
  "thrillers": { title: "Edge of Your Seat · Thrillers", eyebrow: "Hold Tight", tv: false },
  "top-rated-movies": { title: "Top Rated Movies", eyebrow: "All Time", tv: false },
  "upcoming": { title: "Coming Soon", eyebrow: "On the Horizon", tv: false },
  "top-shows": { title: "Top Shows", eyebrow: "Best on TV", tv: true },
  "tv-us": { title: "US Television", eyebrow: "From America", tv: true },
  "tv-uk": { title: "UK Television", eyebrow: "From Britain", tv: true },
  "tv-in": { title: "Indian TV Shows", eyebrow: "From India", tv: true },
  "tv-pk": { title: "Pakistani Dramas", eyebrow: "From Pakistan", tv: true },
  "tv-tr": { title: "Turkish Dramas", eyebrow: "From Türkiye", tv: true },
  "popular-shows": { title: "Popular Shows", eyebrow: "On Everyone's Screen", tv: true },
  "on-air": { title: "On Air Tonight", eyebrow: "Airing Now", tv: true },
  "romance-series": { title: "Romance Series", eyebrow: "For the Heart", tv: true },
  "top-rated-series": { title: "Top Rated Series", eyebrow: "All Time", tv: true },
};

const KEYS = Object.keys(META) as CatKey[];

export const Route = createFileRoute("/_authenticated/app/movies/list")({
  component: ListPage,
  validateSearch: (s: Record<string, unknown>) => ({
    category: (typeof s.category === "string" && (KEYS as string[]).includes(s.category)
      ? s.category
      : "trending-movies") as CatKey,
  }),
  head: () => ({
    meta: [
      { title: "Browse All — PANDACINE" },
      { name: "description", content: "Explore the full collection of curated films and shows." },
    ],
  }),
});

function ListPage() {
  const { category } = Route.useSearch();
  const meta = META[category as CatKey] ?? META["trending-movies"];
  const [items, setItems] = useState<TmdbMovie[]>([]);
  const [loading, setLoading] = useState(true);

  const trending = useServerFn(tmdbTrending);
  const cat = useServerFn(tmdbCategory);
  const disc = useServerFn(tmdbDiscover);
  const tvCat = useServerFn(tmdbTvCategory);
  const tvDisc = useServerFn(tmdbTvDiscover);
  const tvCountry = useServerFn(tmdbTvByCountry);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    async function run(): Promise<TmdbMovie[]> {
      switch (category) {
        case "trending-movies": return trending({ data: { window: "week" } });
        case "date-night": return disc({ data: { genre: GENRE.romance, sort: "popularity.desc" } });
        case "now-playing": return cat({ data: { kind: "now_playing" } });
        case "feel-good": return disc({ data: { genre: GENRE.comedy, sort: "popularity.desc" } });
        case "popular-movies": return cat({ data: { kind: "popular" } });
        case "thrillers": return disc({ data: { genre: GENRE.thriller, sort: "popularity.desc" } });
        case "top-rated-movies": return cat({ data: { kind: "top_rated" } });
        case "upcoming": return cat({ data: { kind: "upcoming" } });
        case "top-shows":
        case "top-rated-series": return tvCat({ data: { kind: "top_rated" } });
        case "tv-us": return tvCountry({ data: { country: "US" } });
        case "tv-uk": return tvCountry({ data: { country: "GB" } });
        case "tv-in": return tvCountry({ data: { country: "IN" } });
        case "tv-pk": return tvCountry({ data: { country: "PK" } });
        case "tv-tr": return tvCountry({ data: { country: "TR" } });
        case "popular-shows": return tvCat({ data: { kind: "popular" } });
        case "on-air": return tvCat({ data: { kind: "on_the_air" } });
        case "romance-series": return tvDisc({ data: { genre: GENRE.romance } });
        default: return trending({ data: {} });
      }
    }
    run()
      .then((r) => { if (alive) { setItems(r); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [category]);

  return (
    <div className="min-h-screen bg-background pt-10 px-5 pb-28">
      <header className="flex items-center gap-3 mb-6">
        <Link
          to="/app/movies"
          search={{ q: "", type: meta.tv ? "tv" : "all", minRating: 0 }}
          className="size-9 rounded-full flex items-center justify-center bg-surface/70 border border-border text-candle-muted hover:text-candle"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-petal">{meta.eyebrow}</p>
          <h1 className="font-serif italic text-2xl text-candle leading-tight truncate">{meta.title}</h1>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-velvet animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-candle-muted mt-10">Nothing to show here yet.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {items.map((m) => (
            <MovieCard
              key={m.id}
              id={m.id}
              title={m.title}
              poster_path={m.poster_path}
              vote_average={m.vote_average}
              mediaType={meta.tv ? "tv" : "movie"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
