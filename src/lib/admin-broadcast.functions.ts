import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


/** Same audience keys the admin UI exposes. */
export type Audience =
  | "all"
  | "anniversary_today"
  | "paired_monthiversary"
  | "payment_pending"
  | "active_7d"
  | "inactive_14d"
  | "admins";

const audienceSchema = z.enum([
  "all",
  "anniversary_today",
  "paired_monthiversary",
  "payment_pending",
  "active_7d",
  "inactive_14d",
  "admins",
]);

const toneSchema = z.enum(["info", "success", "warning", "love", "sparkle"]);

/** Common admin gate: uses the caller's RLS-scoped client to read their own profile row. */
async function requireAdmin(context: any): Promise<void> {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", context.userId)
    .maybeSingle();
  if (error || !data?.is_admin) {
    throw new Error("Forbidden: admin access required");
  }
}

/** Resolve target user_ids for an audience using the service-role client. */
async function resolveUserIds(admin: any, audience: Audience): Promise<string[]> {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  if (audience === "all") {
    const { data } = await admin.from("profiles").select("id");
    return (data ?? []).map((r: any) => r.id);
  }
  if (audience === "admins") {
    const { data } = await admin.from("profiles").select("id").eq("is_admin", true);
    return (data ?? []).map((r: any) => r.id);
  }
  if (audience === "anniversary_today") {
    const { data } = await admin
      .from("profiles")
      .select("id, anniversary_date")
      .not("anniversary_date", "is", null);
    return (data ?? [])
      .filter((r: any) => {
        const d = String(r.anniversary_date ?? "");
        return d.slice(5, 10) === `${mm}-${dd}`;
      })
      .map((r: any) => r.id);
  }
  if (audience === "paired_monthiversary") {
    const { data } = await admin
      .from("profiles")
      .select("id, paired_at")
      .not("paired_at", "is", null);
    return (data ?? [])
      .filter((r: any) => {
        if (!r.paired_at) return false;
        const d = new Date(r.paired_at);
        return String(d.getUTCDate()).padStart(2, "0") === dd;
      })
      .map((r: any) => r.id);
  }
  if (audience === "payment_pending") {
    const { data } = await admin
      .from("coin_purchases")
      .select("user_id")
      .in("status", ["created", "pending"]);
    const set = new Set<string>();
    for (const r of data ?? []) if (r.user_id) set.add(r.user_id);
    return Array.from(set);
  }
  if (audience === "active_7d") {
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data } = await admin.from("profiles").select("id, last_seen_at").gte("last_seen_at", since);
    return (data ?? []).map((r: any) => r.id);
  }
  if (audience === "inactive_14d") {
    const before = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
    const { data } = await admin
      .from("profiles")
      .select("id, last_seen_at")
      .lt("last_seen_at", before);
    return (data ?? []).map((r: any) => r.id);
  }
  return [];
}

/** Enumerate auth emails for the given user_ids using the Auth admin API. */
async function emailsForUsers(admin: any, userIds: Set<string>): Promise<Array<{ id: string; email: string }>> {
  const out: Array<{ id: string; email: string }> = [];
  const perPage = 1000;
  let page = 1;
  // Cap pages to keep runtime bounded.
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) {
      if (u?.id && u?.email && userIds.has(u.id)) {
        out.push({ id: u.id, email: u.email });
      }
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return out;
}

export const previewAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ audience: audienceSchema }).parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = await resolveUserIds(supabaseAdmin, data.audience);
    return { count: ids.length };
  });

export const sendTargetedBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        audience: audienceSchema,
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(400),
        tone: toneSchema,
        sendEmail: z.boolean().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = await resolveUserIds(supabaseAdmin, data.audience);
    const idSet = new Set(ids);

    // ── 1. Realtime broadcast (in-app toast + notification center) ───────────
    const payload = {
      id: crypto.randomUUID(),
      title: data.title,
      body: data.body,
      tone: data.tone,
      sent_at: Date.now(),
      target_user_ids: data.audience === "all" ? null : ids,
    };
    const ch = supabaseAdmin.channel("admin-broadcast");
    await new Promise<void>((resolve) => {
      ch.subscribe((status: string) => { if (status === "SUBSCRIBED") resolve(); });
      setTimeout(() => resolve(), 1500);
    });
    await ch.send({ type: "broadcast", event: "push", payload });
    setTimeout(() => ch.unsubscribe(), 800);

    // ── 2. Optional email fanout ────────────────────────────────────────────
    let emailQueued = 0;
    let emailSkipped = 0;
    if (data.sendEmail && ids.length > 0) {
      const users = await emailsForUsers(supabaseAdmin, idSet);

      // Render the template once — same content for all recipients.
      const element = React.createElement(broadcastTemplate.component, {
        title: data.title,
        body: data.body,
        tone: data.tone,
        siteName: "Pandacine",
      });
      const html = await render(element);
      const plainText = await render(element, { plainText: true });
      const subject =
        typeof broadcastTemplate.subject === "function"
          ? broadcastTemplate.subject({ title: data.title })
          : broadcastTemplate.subject;

      const SITE_NAME = "pandacinee";
      const SENDER_DOMAIN = "1804.pandacine.com";
      const FROM_DOMAIN = "pandacine.com";

      for (const u of users) {
        const normalized = u.email.toLowerCase();

        // suppression
        const { data: sup } = await supabaseAdmin
          .from("suppressed_emails")
          .select("id")
          .eq("email", normalized)
          .maybeSingle();
        if (sup) { emailSkipped++; continue; }

        // unsubscribe token
        let token: string | null = null;
        const { data: existing } = await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .select("token, used_at")
          .eq("email", normalized)
          .maybeSingle();
        if (existing && !existing.used_at) token = existing.token as string;
        else if (!existing) {
          const bytes = new Uint8Array(32);
          crypto.getRandomValues(bytes);
          const newTok = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
          await supabaseAdmin
            .from("email_unsubscribe_tokens")
            .upsert({ token: newTok, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
          const { data: stored } = await supabaseAdmin
            .from("email_unsubscribe_tokens")
            .select("token")
            .eq("email", normalized)
            .maybeSingle();
          token = (stored?.token as string) ?? newTok;
        } else {
          emailSkipped++;
          continue;
        }

        const messageId = crypto.randomUUID();
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: "broadcast-announcement",
          recipient_email: u.email,
          status: "pending",
        });

        const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: u.email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text: plainText,
            purpose: "transactional",
            label: "broadcast-announcement",
            idempotency_key: `${payload.id}-${u.id}`,
            unsubscribe_token: token,
            queued_at: new Date().toISOString(),
          },
        });
        if (enqueueError) emailSkipped++; else emailQueued++;
      }
    }

    return {
      recipients: ids.length,
      emailQueued,
      emailSkipped,
    };
  });
