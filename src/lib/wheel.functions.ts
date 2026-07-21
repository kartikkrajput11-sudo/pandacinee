import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createGameAiProvider } from "@/lib/ai-gateway.server";

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

    let titles: string[] = [];
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        output: Output.object({
          schema: z.object({
            titles: z.array(z.string()),
          }),
        }),
        prompt:
          `Pick exactly ${data.count} real, well-known movies for two partners to spin a wheel and watch tonight. ` +
          vibePrompt +
          ` Return an object with a "titles" array of ${data.count} strings. Use only real movie titles (no years, no punctuation, English titles preferred). No duplicates.`,
      });
      titles = (output?.titles ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, data.count);
    } catch (err) {
      // Recover raw model text from a schema-mismatch error and parse it best-effort.
      if (NoObjectGeneratedError.isInstance(err)) {
        const raw = err.text ?? "";
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.titles)) {
            titles = parsed.titles.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, data.count);
          }
        } catch {
          titles = Array.from(raw.matchAll(/"([^"\n]{2,80})"/g)).map((m) => m[1].trim());
          if (titles.length === 0) {
            titles = raw
              .split(/\r?\n/)
              .map((l) => l.replace(/^\s*[-*\d.]+\s*/, "").trim())
              .filter((l) => l.length > 1 && l.length < 80);
          }
          titles = titles.slice(0, data.count);
        }
      } else {
        // Any other AI error (rate limit, credits, network) — swallow and fall
        // back to trending so the user always gets a wheel.
        console.warn("wheelAiSuggest: AI curate failed, falling back to trending", err);
        titles = [];
      }
    }

    let results: (TmdbLite | null)[] = [];
    if (titles.length > 0) {
      try {
        results = await Promise.all(titles.map((t) => searchOne(t)));
      } catch {
        results = [];
      }
    }

    const seen = new Set<number>();
    const movies: TmdbLite[] = [];
    for (const m of results) {
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        movies.push(m);
      }
    }

    // Always pad up to `count` with trending so we never return empty / error.
    if (movies.length < data.count) {
      try {
        const trending = await tmdbGet<{ results: TmdbLite[] }>("/trending/movie/week");
        for (const m of trending.results) {
          if (movies.length >= data.count) break;
          if (!seen.has(m.id)) {
            seen.add(m.id);
            movies.push(m);
          }
        }
      } catch {
        // ignore — return whatever we have
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
