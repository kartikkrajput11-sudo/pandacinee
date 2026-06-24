import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search } from "lucide-react";
import { tmdbTrending, tmdbSearch, type TmdbMovie } from "@/lib/tmdb.functions";
import { MovieCard } from "./app.movies";

export const Route = createFileRoute("/_authenticated/app/movies/")({
  component: Movies,
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "" }),
});

function Movies() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const trending = useServerFn(tmdbTrending);
  const search = useServerFn(tmdbSearch);
  const [movies, setMovies] = useState<TmdbMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState(q);

  useEffect(() => { setInput(q); }, [q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (q.trim() ? search({ data: { q } }) : trending({ data: { window: "week" } }))
      .then((r) => alive && setMovies(r))
      .catch(() => alive && setMovies([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [q]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/app/movies", search: { q: input.trim() } });
  }

  return (
    <div className="pt-10 px-5 pb-24">
      <header className="flex items-center gap-3 mb-5">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Tonight</p>
          <h1 className="font-serif text-2xl italic">Movies</h1>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mb-5 flex items-center gap-2 px-4 h-11 rounded-full bg-surface border border-border">
        <Search className="size-4 text-candle-muted" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search any movie…"
          className="flex-1 bg-transparent outline-none text-sm text-candle placeholder:text-candle-muted"
        />
        {input && (
          <button type="button" onClick={() => { setInput(""); navigate({ to: "/app/movies", search: { q: "" } }); }} className="text-xs text-petal">Clear</button>
        )}
      </form>

      {!q && <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-3">Trending this week</p>}

      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-velvet animate-pulse" />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <p className="text-sm text-candle-muted text-center mt-10">No movies found.</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {movies.map((m) => (
            <MovieCard key={m.id} id={m.id} title={m.title} poster_path={m.poster_path} vote_average={m.vote_average} />
          ))}
        </div>
      )}
    </div>
  );
}
