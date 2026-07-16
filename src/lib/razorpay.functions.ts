import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Create a Razorpay order for a coin bundle. Records a `coin_purchases` row
 * in status='created' and returns the order id + amount so the client can
 * open Razorpay Checkout.
 */
export const createCoinOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ bundleId: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bundle, error: bErr } = await supabaseAdmin
      .from("coin_bundles" as any)
      .select("*")
      .eq("id", data.bundleId)
      .eq("active", true)
      .maybeSingle();
    if (bErr || !bundle) throw new Error("Bundle not found");
    const b = bundle as any;

    const receipt = `pc_${userId.slice(0, 8)}_${Date.now().toString(36)}`;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const resp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: b.price_paise,
        currency: b.currency ?? "INR",
        receipt,
        notes: { user_id: userId, bundle_key: b.bundle_key, coins: String(b.coins) },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("[razorpay] order failed", resp.status, t);
      throw new Error("Couldn't start payment");
    }
    const order = (await resp.json()) as { id: string; amount: number; currency: string };

    const { error: insErr } = await supabaseAdmin.from("coin_purchases" as any).insert({
      user_id: userId,
      bundle_id: b.id,
      coins: b.coins,
      amount_paise: b.price_paise,
      currency: b.currency ?? "INR",
      razorpay_order_id: order.id,
      status: "created",
    });
    if (insErr) throw new Error(insErr.message);

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      coins: b.coins,
      name: b.name,
    };
  });

/**
 * Verify Razorpay checkout success signature and credit the coins.
 * Signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 */
export const verifyCoinPayment = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Razorpay not configured");

    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(data.razorpay_signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Invalid payment signature");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: purchase, error: pErr } = await supabaseAdmin
      .from("coin_purchases" as any)
      .select("*")
      .eq("razorpay_order_id", data.razorpay_order_id)
      .maybeSingle();
    if (pErr || !purchase) throw new Error("Purchase not found");
    const p = purchase as any;
    if (p.user_id !== userId) throw new Error("Not your purchase");

    if (p.status === "created") {
      await supabaseAdmin
        .from("coin_purchases" as any)
        .update({
          status: "paid",
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          paid_at: new Date().toISOString(),
        })
        .eq("id", p.id);
    }

    const { data: credit, error: cErr } = await supabaseAdmin.rpc(
      "credit_coin_purchase" as any,
      { _payment_id: data.razorpay_payment_id },
    );
    if (cErr) throw new Error(cErr.message);
    return credit as { balance: number; coins?: number; already: boolean };
  });
