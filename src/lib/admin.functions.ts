import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ClaimInput = z.object({ pin: z.string().min(1).max(16) });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ClaimInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("claim_admin", { _pin: data.pin });
    if (error) throw new Error(error.message);
    return { ok: Boolean(ok) };
  });

const QualityVariant = z.object({
  label: z.string().min(1).max(20),
  url: z.string().min(1).max(2000),
  height: z.number().int().min(120).max(4320).optional().nullable(),
});

const MovieInput = z.object({
  title: z.string().min(1).max(200),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  overview: z.string().max(4000).optional().nullable(),
  poster_url: z.string().url().max(1000).optional().nullable(),
  backdrop_url: z.string().url().max(1000).optional().nullable(),
  runtime: z.number().int().min(1).max(1000).optional().nullable(),
  genres: z.array(z.string().min(1).max(40)).max(20).optional(),
  video_url: z.string().max(2000).optional().nullable(),
  video_storage_path: z.string().max(500).optional().nullable(),
  video_qualities: z.array(QualityVariant).max(10).optional(),
  tmdb_id: z.number().int().positive().optional().nullable(),
  media_type: z.enum(["movie", "tv"]).optional(),
  use_vidking: z.boolean().optional(),
});

export const createCustomMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => MovieInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("custom_movies")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateInput = MovieInput.partial().extend({ id: z.string().uuid() });

export const updateCustomMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("custom_movies")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCustomMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("custom_movies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Episodes (per-episode overrides for TV series) ──────────────────────

const EpisodeInput = z.object({
  movie_id: z.string().uuid(),
  season: z.number().int().min(0).max(200),
  episode: z.number().int().min(0).max(2000),
  title: z.string().max(300).optional().nullable(),
  overview: z.string().max(4000).optional().nullable(),
  still_url: z.string().url().max(1000).optional().nullable(),
  runtime: z.number().int().min(1).max(1000).optional().nullable(),
  video_url: z.string().max(2000).optional().nullable(),
  video_storage_path: z.string().max(500).optional().nullable(),
  use_vidking: z.boolean().optional(),
});

export const listCustomEpisodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ movie_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("custom_episodes")
      .select("*")
      .eq("movie_id", data.movie_id)
      .order("season", { ascending: true })
      .order("episode", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCustomEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EpisodeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("custom_episodes")
      .upsert({ ...data, created_by: context.userId }, { onConflict: "movie_id,season,episode" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateEpisodeInput = EpisodeInput.partial().extend({ id: z.string().uuid() });

export const updateCustomEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateEpisodeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("custom_episodes")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCustomEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("custom_episodes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

