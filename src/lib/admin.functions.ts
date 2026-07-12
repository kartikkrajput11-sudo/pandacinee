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
