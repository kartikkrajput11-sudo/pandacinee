import { createServerFn } from "@tanstack/react-start";

const BASE = "https://api.watchmode.com/v1";

function key() {
  const k = process.env.WATCHMODE_API_KEY;
  if (!k) throw new Error("WATCHMODE_API_KEY not configured");
  return k;
}

export type WatchSource = {
  source_id: number;
  name: string;
  type: "sub" | "free" | "rent" | "buy" | "tve" | string;
  region: string;
  web_url: string;
  ios_url?: string;
  android_url?: string;
  format?: string;
  price?: number | null;
  seasons?: number | null;
  episodes?: number | null;
};

/**
 * Look up Watchmode's title id from a TMDB movie id, then fetch streaming sources.
 * Returns an empty list (not an error) when nothing is found — UI just hides the section.
 */
export const watchmodeSources = createServerFn({ method: "GET" })
  .inputValidator((d: { tmdbId: number; regions?: string[] }) => d)
  .handler(async ({ data }) => {
    const apiKey = key();
    const regions = data.regions ?? ["US", "IN", "GB", "CA"];

    // 1) Resolve TMDB → Watchmode title id
    const searchUrl = `${BASE}/search/?apiKey=${apiKey}&search_field=tmdb_movie_id&search_value=${data.tmdbId}`;
    const sr = await fetch(searchUrl);
    if (!sr.ok) return { sources: [] as WatchSource[] };
    const sj = (await sr.json()) as { title_results?: { id: number }[] };
    const titleId = sj.title_results?.[0]?.id;
    if (!titleId) return { sources: [] as WatchSource[] };

    // 2) Fetch sources for those regions
    const srcUrl = `${BASE}/title/${titleId}/sources/?apiKey=${apiKey}&regions=${regions.join(",")}`;
    const r = await fetch(srcUrl);
    if (!r.ok) return { sources: [] as WatchSource[] };
    const all = (await r.json()) as WatchSource[];

    // Dedupe per (source_id + region + type) — Watchmode returns dupes per format
    const seen = new Set<string>();
    const dedup: WatchSource[] = [];
    for (const s of all) {
      const k = `${s.source_id}|${s.region}|${s.type}`;
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(s);
    }
    return { sources: dedup };
  });
