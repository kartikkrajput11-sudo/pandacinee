import { createServerFn } from "@tanstack/react-start";

const BASE = "https://api.themoviedb.org/3";

function token() {
  const t = process.env.TMDB_READ_TOKEN;
  if (!t) throw new Error("TMDB_READ_TOKEN not configured");
  return t;
}

class TmdbError extends Error {
  status: number;
  constructor(status: number, path: string, statusText?: string) {
    super(`TMDB ${status}${statusText ? ` ${statusText}` : ""} for ${path}`);
    this.status = status;
    this.name = "TmdbError";
  }
}

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token()}`, accept: "application/json" },
    });
  } catch (e) {
    throw new Error(`TMDB network error for ${path}: ${(e as Error)?.message ?? "unknown"}`);
  }
  if (!res.ok) throw new TmdbError(res.status, path, res.statusText);
  try {
    return (await res.json()) as T;
  } catch (e) {
    throw new Error(`TMDB invalid JSON for ${path}: ${(e as Error)?.message ?? "unknown"}`);
  }
}

/** Returns null on 404, rethrows other errors. */
async function tmdbOrNull<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T | null> {
  try {
    return await tmdb<T>(path, params);
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) return null;
    throw e;
  }
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

export const tmdbCategory = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: "popular" | "top_rated" | "upcoming" | "now_playing" }) => d)
  .handler(async ({ data }) => {
    const r = await tmdb<{ results: TmdbMovie[] }>(`/movie/${data.kind}`);
    return r.results.slice(0, 20);
  });

export const tmdbDiscover = createServerFn({ method: "GET" })
  .inputValidator((d: { genre?: number; sort?: string; year?: number }) => d)
  .handler(async ({ data }) => {
    const r = await tmdb<{ results: TmdbMovie[] }>(`/discover/movie`, {
      with_genres: data.genre,
      sort_by: data.sort ?? "popularity.desc",
      primary_release_year: data.year,
      include_adult: "false",
      "vote_count.gte": 50,
    });
    return r.results.slice(0, 20);
  });

export const tmdbMoviesBatch = createServerFn({ method: "GET" })
  .inputValidator((d: { ids: number[] }) => d)
  .handler(async ({ data }) => {
    const ids = data.ids.slice(0, 12);
    const results = await Promise.all(
      ids.map((id) =>
        tmdb<TmdbMovie>(`/movie/${id}`).catch(() => null),
      ),
    );
    return results.filter((m): m is TmdbMovie => !!m);
  });

export type TmdbEpisode = {
  id: number;
  name: string;
  overview: string | null;
  season_number: number;
  episode_number: number;
  still_path: string | null;
  runtime: number | null;
  air_date: string | null;
};

export const tmdbTvDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const r = await tmdb<{
      id: number; name: string;
      number_of_seasons: number;
      seasons: { season_number: number; episode_count: number; name: string }[];
    }>(`/tv/${data.id}`);
    return r;
  });

export const tmdbTvSeason = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number; season: number }) => d)
  .handler(async ({ data }) => {
    const r = await tmdb<{ episodes: TmdbEpisode[] }>(`/tv/${data.id}/season/${data.season}`);
    return r.episodes ?? [];
  });


