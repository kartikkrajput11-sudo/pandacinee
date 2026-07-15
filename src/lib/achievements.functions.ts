import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RITUAL_REWARD, TAG_BY_KEY } from "./achievements";

/**
 * Awards ritual completion coins to both partners. Idempotent: sets
 * ritual.state.coins_awarded=true and refuses to credit twice.
 */
export const awardRitualCoins = createServerFn({ method: "POST" })
  .inputValidator((input: { ritualId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ritual, error: rErr } = await supabaseAdmin
      .from("rituals" as any)
      .select("id,host_id,partner_id,kind,state,started_at")
      .eq("id", data.ritualId)
      .maybeSingle();
    if (rErr || !ritual) throw new Error("Ritual not found");
    const r = ritual as any;

    if (r.host_id !== userId && r.partner_id !== userId) {
      throw new Error("Not a participant");
    }
    if (r.state?.coins_awarded) {
      return { alreadyAwarded: true, reward: 0 };
    }

    // Verify the ritual actually ran to completion.
    const endsAt = new Date(r.state?.endsAt ?? 0).getTime();
    if (!endsAt || Date.now() < endsAt - 2000) {
      throw new Error("Ritual not finished yet");
    }

    const reward = RITUAL_REWARD[r.kind as string] ?? 15;

    // Bump coins for both partners atomically-ish (two updates, tolerated).
    for (const uid of [r.host_id, r.partner_id]) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("coins")
        .eq("id", uid)
        .maybeSingle();
      const current = (prof as any)?.coins ?? 0;
      await supabaseAdmin
        .from("profiles")
        .update({ coins: current + reward })
        .eq("id", uid);
    }

    await supabaseAdmin
      .from("rituals" as any)
      .update({
        state: { ...(r.state ?? {}), coins_awarded: true, reward },
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", r.id);

    return { alreadyAwarded: false, reward };
  });

/**
 * Buys an achievement tag for the calling user. Deducts coins and inserts the
 * tag. Fails if the tag is already owned or the user can't afford it.
 */
export const purchaseTag = createServerFn({ method: "POST" })
  .inputValidator((input: { tagKey: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tag = TAG_BY_KEY[data.tagKey];
    if (!tag) throw new Error("Unknown tag");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profile_achievements" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("tag_key", tag.key)
      .maybeSingle();
    if (existing) throw new Error("You already own this tag");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .maybeSingle();
    const coins = (prof as any)?.coins ?? 0;
    if (coins < tag.cost) throw new Error("Not enough coins");

    const { error: dErr } = await supabaseAdmin
      .from("profiles")
      .update({ coins: coins - tag.cost })
      .eq("id", userId);
    if (dErr) throw dErr;

    const { error: iErr } = await supabaseAdmin
      .from("profile_achievements" as any)
      .insert({ user_id: userId, tag_key: tag.key });
    if (iErr) {
      // roll back coins on failure
      await supabaseAdmin.from("profiles").update({ coins }).eq("id", userId);
      throw iErr;
    }

    return { ok: true, remaining: coins - tag.cost, tag };
  });
