import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps the current user's profiles.last_seen_at fresh so we can show a
 * reliable "Active X ago" status. Pings on mount, every 45s while visible,
 * on focus/visibilitychange, and on tab close (best-effort).
 *
 * Efficiency notes:
 *  - The `activity_visible` preference is fetched once on mount and refreshed
 *    via a realtime subscription. The previous version re-read the profile
 *    on every heartbeat (multiple times/minute), which was wasteful.
 *  - A 20s minimum gap between writes coalesces bursts of focus/visibility
 *    events into a single update.
 */
export function usePresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;
    let uid: string | null = null;
    let activityVisible = true;
    let lastWriteAt = 0;

    const ping = async (opts?: { force?: boolean }) => {
      if (cancelled || !uid) return;
      if (!activityVisible) return;
      const now = Date.now();
      if (!opts?.force && now - lastWriteAt < 20_000) return;
      lastWriteAt = now;
      try {
        await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", uid);
      } catch {
        /* offline / transient — ignore */
      }
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id ?? null;
      if (!uid || cancelled) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("activity_visible")
        .eq("id", uid)
        .maybeSingle();
      activityVisible = (prof as any)?.activity_visible !== false;
      if (activityVisible) ping({ force: true });

      // Watch the preference so toggling it in Settings takes effect
      // without a page reload.
      channel = supabase
        .channel(`presence-pref-${uid}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
          (payload) => {
            const next = (payload.new as any)?.activity_visible;
            if (typeof next === "boolean") activityVisible = next;
          },
        )
        .subscribe();
    })();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, 45_000);

    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    const onFocus = () => ping();
    const onHide = () => ping();

    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
}

/** Format an ISO timestamp as "Active now / 5m / 2h / 3d ago" style. */
export function formatLastSeen(iso: string | null | undefined, online: boolean): string {
  if (online) return "online";
  if (!iso) return "offline";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "offline";
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return "active just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `active ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `active ${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `active ${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `active ${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `active ${mo}mo ago`;
  return `active ${Math.floor(day / 365)}y ago`;
}
