import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PET_COST = 250;

export type Pet = {
  user_id: string;
  name: string;
  unlocked: boolean;
  affection: number;
  interactions: number;
  streak: number;
  last_visit: string | null;
  costume: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Reads (and lazily creates) the caller's pet row, updating the daily streak. */
export const getPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!pet) {
      const { data: created } = await supabaseAdmin
        .from("pet_pandas" as any)
        .insert({ user_id: userId, last_visit: today() })
        .select("*")
        .maybeSingle();
      pet = created;
    } else {
      const p = pet as any;
      const last = p.last_visit as string | null;
      if (last !== today()) {
        const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        const streak = last === yesterday ? (p.streak ?? 0) + 1 : 1;
        const { data: updated } = await supabaseAdmin
          .from("pet_pandas" as any)
          .update({
            last_visit: today(),
            streak,
            costume: streak >= 7 ? "golden" : p.costume,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();
        pet = updated ?? pet;
      }
    }

    const { data: prof } = await supabaseAdmin.from("profiles").select("coins").eq("id", userId).maybeSingle();
    return { pet: pet as unknown as Pet, coins: (prof as any)?.coins ?? 0, cost: PET_COST };
  });

/** Spends coins to adopt the mascot. */
export const unlockPet = createServerFn({ method: "POST" })
  .inputValidator((input: { name?: string }) => input ?? {})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("unlocked")
      .eq("user_id", userId)
      .maybeSingle();
    if ((pet as any)?.unlocked) throw new Error("You already adopted your panda");

    const { data: prof } = await supabaseAdmin.from("profiles").select("coins").eq("id", userId).maybeSingle();
    const coins = (prof as any)?.coins ?? 0;
    if (coins < PET_COST) throw new Error(`You need ${PET_COST} coins — you have ${coins}`);

    const { error: dErr } = await supabaseAdmin
      .from("profiles")
      .update({ coins: coins - PET_COST })
      .eq("id", userId);
    if (dErr) throw dErr;

    const name = (data.name ?? "").trim().slice(0, 20) || "Pan";
    const { error: uErr } = await supabaseAdmin
      .from("pet_pandas" as any)
      .upsert(
        { user_id: userId, unlocked: true, name, last_visit: today(), streak: 1, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (uErr) {
      await supabaseAdmin.from("profiles").update({ coins }).eq("id", userId);
      throw uErr;
    }
    return { ok: true, remaining: coins - PET_COST, name };
  });

/** Renames the pet. */
export const renamePet = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const name = data.name.trim().slice(0, 20);
    if (name.length < 2) throw new Error("Name needs at least 2 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pet_pandas" as any)
      .update({ name, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true, name };
  });

/** Persists play progress (affection + interaction count). */
export const savePetProgress = createServerFn({ method: "POST" })
  .inputValidator((input: { interactions: number; affection: number }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("interactions,affection")
      .eq("user_id", context.userId)
      .maybeSingle();
    const p = (pet ?? {}) as any;
    const interactions = Math.max(p.interactions ?? 0, data.interactions);
    const affection = Math.min(100, Math.max(p.affection ?? 0, data.affection));
    await supabaseAdmin
      .from("pet_pandas" as any)
      .update({ interactions, affection, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { interactions, affection };
  });
