import { createServerFn } from "@tanstack/react-start";

const BASE = "https://api.themoviedb.org/3";

function token() {
  const t = process.env.TMDB_READ_TOKEN;
  if (!t) throw new Error("TMDB_READ_TOKEN not configured");
  return t;
}

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token()}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
};

export const tmdbTrending = createServerFn({ method: "GET" })
  .inputValidator((d: { window?: "day" | "week" } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const r = await tmdb<{ results: TmdbMovie[] }>(`/trending/movie/${data.window ?? "week"}`);
    return r.results.slice(0, 20);
  });

export const tmdbSearch = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    if (!data.q.trim()) return [];
    const r = await tmdb<{ results: TmdbMovie[] }>(`/search/movie`, { query: data.q, include_adult: "false" });
    return r.results.slice(0, 30);
  });

export const tmdbMovie = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const movie = await tmdb<any>(`/movie/${data.id}`, { append_to_response: "credits,videos,similar" });
    return movie;
  });
