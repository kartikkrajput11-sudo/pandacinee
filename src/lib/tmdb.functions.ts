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
    const movie = await tmdbOrNull<any>(`/movie/${data.id}`, { append_to_response: "credits,videos,similar" });
    if (movie) return movie;
    // Fallback: id may actually be a TV series
    const tv = await tmdbOrNull<any>(`/tv/${data.id}`, { append_to_response: "credits,videos,similar" });
    if (!tv) return null;
    tv.title = tv.name ?? tv.original_name ?? null;
    tv.release_date = tv.first_air_date ?? null;
    tv.runtime = Array.isArray(tv.episode_run_time) && tv.episode_run_time[0] ? tv.episode_run_time[0] : null;
    tv.media_type = "tv";
    return tv;
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

// ---------------- TV ----------------

// Normalised TV row to reuse existing MovieCard shape (title / release_date).
export type TmdbTv = TmdbMovie & { media_type: "tv" };

function tvToMovieShape(t: any): TmdbTv {
  return {
    id: t.id,
    title: t.name ?? t.original_name ?? "Untitled",
    overview: t.overview ?? "",
    poster_path: t.poster_path ?? null,
    backdrop_path: t.backdrop_path ?? null,
    release_date: t.first_air_date ?? null,
    vote_average: t.vote_average ?? 0,
    vote_count: t.vote_count ?? 0,
    genre_ids: t.genre_ids,
    media_type: "tv",
  };
}

export const tmdbTvTrending = createServerFn({ method: "GET" })
  .inputValidator((d: { window?: "day" | "week" } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const r = await tmdb<{ results: any[] }>(`/trending/tv/${data.window ?? "week"}`);
    return r.results.slice(0, 20).map(tvToMovieShape);
  });

export const tmdbTvCategory = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: "popular" | "top_rated" | "on_the_air" | "airing_today" }) => d)
  .handler(async ({ data }) => {
    const r = await tmdb<{ results: any[] }>(`/tv/${data.kind}`);
    return r.results.slice(0, 20).map(tvToMovieShape);
  });

export const tmdbTvDiscover = createServerFn({ method: "GET" })
  .inputValidator((d: { genre?: number; sort?: string }) => d)
  .handler(async ({ data }) => {
    const r = await tmdb<{ results: any[] }>(`/discover/tv`, {
      with_genres: data.genre,
      sort_by: data.sort ?? "popularity.desc",
      include_adult: "false",
      "vote_count.gte": 50,
    });
    return r.results.slice(0, 20).map(tvToMovieShape);
  });

/** Broadcast TV shows filtered by origin country (excludes web-only miniseries).
 *  with_type: 0 Documentary, 2 Miniseries, 3 Reality, 4 Scripted, 5 Talk.
 *  We keep Scripted/Reality/Talk which matches traditional television. */
export const tmdbTvByCountry = createServerFn({ method: "GET" })
  .inputValidator((d: { country: string }) => d)
  .handler(async ({ data }) => {
    const r = await tmdb<{ results: any[] }>(`/discover/tv`, {
      with_origin_country: data.country,
      with_type: "3|4|5",
      sort_by: "popularity.desc",
      include_adult: "false",
      "vote_count.gte": 20,
    });
    return r.results.slice(0, 20).map(tvToMovieShape);
  });


/** Multi search — returns movies + tv shows in a movie-shaped list with `media_type`. */
export const tmdbMulti = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    if (!data.q.trim()) return [] as (TmdbMovie & { media_type: "movie" | "tv" })[];
    const r = await tmdb<{ results: any[] }>(`/search/multi`, { query: data.q, include_adult: "false" });
    return r.results
      .filter((x) => x.media_type === "movie" || x.media_type === "tv")
      .slice(0, 40)
      .map((x) => x.media_type === "tv"
        ? tvToMovieShape(x)
        : ({ ...x, media_type: "movie" as const })
      );
  });

/** Full TV detail with credits / videos / similar for the detail page. */
export const tmdbTvFull = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const r = await tmdbOrNull<any>(`/tv/${data.id}`, {
      append_to_response: "credits,videos,similar",
    });
    return r;
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
    const r = await tmdbOrNull<{
      id: number; name: string;
      number_of_seasons: number;
      seasons: { season_number: number; episode_count: number; name: string }[];
    }>(`/tv/${data.id}`);
    return r; // null when the TMDB id isn't a TV show (e.g. movie id used by mistake)
  });

export const tmdbTvSeason = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number; season: number }) => d)
  .handler(async ({ data }) => {
    const r = await tmdbOrNull<{ episodes: TmdbEpisode[] }>(`/tv/${data.id}/season/${data.season}`);
    return r?.episodes ?? [];
  });


