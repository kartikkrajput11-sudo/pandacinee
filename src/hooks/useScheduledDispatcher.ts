import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side dispatcher: while any signed-in user has the app open, poll their
 * own `scheduled_messages` every 20s and, for any row whose `scheduled_for` is
 * in the past and `delivered_at` is null, insert the corresponding row into
 * `messages` and mark the scheduled row as delivered. RLS ensures we can only
 * ever touch our own rows.
 */
export function useScheduledDispatcher(userId?: string | null) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      const nowIso = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("scheduled_messages")
        .select("*")
        .eq("sender_id", userId)
        .is("delivered_at", null)
        .lte("scheduled_for", nowIso)
        .limit(20);
      if (error || !data || cancelled) return;
      for (const row of data as any[]) {
        // Compute expires_at from disappear_seconds now (delivery time).
        const expires_at = row.disappear_seconds
          ? new Date(Date.now() + row.disappear_seconds * 1000).toISOString()
          : null;
        const payload: Record<string, unknown> = {
          sender_id: row.sender_id,
          content: row.content ?? "",
          type: row.type ?? "text",
          media_url: row.media_url,
          media_meta: row.media_meta,
          reply_to_id: row.reply_to_id,
          expires_at,
        };
        if (row.receiver_id) payload.receiver_id = row.receiver_id;
        if (row.group_id) payload.group_id = row.group_id;
        const { error: insErr } = await supabase.from("messages").insert(payload as any);
        if (insErr) continue;
        await (supabase as any)
          .from("scheduled_messages")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }

    tick();
    const id = window.setInterval(tick, 20_000);
    // Also re-check when the tab regains focus.
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);
}
