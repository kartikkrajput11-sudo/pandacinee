import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/movies")({
  component: () => <Outlet />,
});

export function poster(path: string | null, size: "w185" | "w342" | "w500" | "original" = "w342") {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function MovieCard({ id, title, poster_path, vote_average, mediaType }: { id: number; title: string; poster_path: string | null; vote_average: number; mediaType?: "movie" | "tv" }) {
  return (
    <Link
      to="/app/movies/$id"
      params={{ id: String(id) }}
      search={mediaType ? { type: mediaType } : {}}
      className="block group"
    >
      <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-velvet border border-border relative">
        {poster_path ? (
          <img src={poster(poster_path, "w342")!} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
        )}
        {vote_average > 0 && (
          <span className="absolute top-2 right-2 text-[10px] bg-velvet/80 backdrop-blur px-1.5 py-0.5 rounded-full text-candle">
            ★ {vote_average.toFixed(1)}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-candle truncate">{title}</p>
    </Link>
  );
}
