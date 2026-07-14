import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const TMDB = "https://api.themoviedb.org/3";

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("TMDB_READ_TOKEN not configured");
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

type TmdbLite = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number;
  overview: string;
};

async function searchOne(title: string): Promise<TmdbLite | null> {
  try {
    const r = await tmdbGet<{ results: TmdbLite[] }>("/search/movie", {
      query: title,
      include_adult: "false",
    });
    return r.results[0] ?? null;
  } catch {
    return null;
  }
}

export const wheelAiSuggest = createServerFn({ method: "POST" })
  .inputValidator((d: { vibe?: string; count?: number }) => ({
    vibe: (d.vibe ?? "").slice(0, 120),
    count: Math.max(4, Math.min(8, d.count ?? 6)),
  }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const vibePrompt = data.vibe.trim()
      ? `Vibe: ${data.vibe.trim()}.`
      : "Vibe: cozy couple movie night, mix of romance / feel-good / classic favorites.";

    const { output } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      output: Output.object({
        schema: z.object({
          titles: z.array(z.string().min(1).max(80)).min(4).max(8),
        }),
      }),
      prompt:
        `Pick ${data.count} real, well-known movies for two partners to spin a wheel and watch tonight. ` +
        vibePrompt +
        ` Return only real movie titles (no years, no punctuation, English titles preferred). Avoid duplicates.`,
    });

    const titles = (output?.titles ?? []).slice(0, data.count);
    const results = await Promise.all(titles.map((t) => searchOne(t)));
    const seen = new Set<number>();
    const movies: TmdbLite[] = [];
    for (const m of results) {
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        movies.push(m);
      }
    }
    // Fallback pad with trending if AI results were sparse
    if (movies.length < 4) {
      const trending = await tmdbGet<{ results: TmdbLite[] }>("/trending/movie/week");
      for (const m of trending.results) {
        if (movies.length >= data.count) break;
        if (!seen.has(m.id)) {
          seen.add(m.id);
          movies.push(m);
        }
      }
    }
    return movies.slice(0, data.count);
  });

export const wheelTrending = createServerFn({ method: "GET" })
  .inputValidator((d: { count?: number } | undefined) => ({
    count: Math.max(4, Math.min(8, d?.count ?? 6)),
  }))
  .handler(async ({ data }) => {
    const r = await tmdbGet<{ results: TmdbLite[] }>("/trending/movie/week");
    return r.results.slice(0, data.count);
  });
