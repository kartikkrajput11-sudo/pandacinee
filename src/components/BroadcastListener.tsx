import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pushNotification } from "@/lib/notifications";

type BroadcastPayload = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "love" | "sparkle";
  sent_at: number;
  preview?: boolean;
  /** When null/absent the broadcast is for everyone; otherwise only these users. */
  target_user_ids?: string[] | null;
};

const TONE_EMOJI: Record<BroadcastPayload["tone"], string> = {
  info: "✨",
  success: "🌟",
  warning: "⚠️",
  love: "💗",
  sparkle: "✨",
};

function showBroadcast(payload: BroadcastPayload) {
  // Skip ancient messages (>2min) to avoid replaying on reconnect
  if (Date.now() - payload.sent_at > 2 * 60_000) return;

  const emoji = TONE_EMOJI[payload.tone] ?? "✨";
  const toastFn =
    payload.tone === "success" ? toast.success :
    payload.tone === "warning" ? toast.warning :
    payload.tone === "info"    ? toast.info :
    toast;

  toastFn(`${emoji}  ${payload.title}`, {
    description: payload.body,
    duration: 7000,
  });

  // Persist to notification center inbox
  pushNotification({
    id: `bc-${payload.id}`,
    kind: "broadcast",
    title: payload.title,
    body: payload.body,
    icon: emoji,
  });

  // Native browser notification
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
    try {
      const n = new Notification(payload.title, {
        body: payload.body,
        icon: "/favicon.ico",
        tag: `pandacine-${payload.id}`,
        silent: false,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {
      // ignore
    }
  }
}

export function BroadcastListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Local preview channel (admin "Preview locally")
    const onPreview = (e: Event) => {
      const detail = (e as CustomEvent<BroadcastPayload>).detail;
      if (detail) showBroadcast(detail);
    };
    window.addEventListener("admin-broadcast-preview", onPreview);

    // Supabase realtime channel for live broadcasts
    const channel = supabase
      .channel("admin-broadcast", { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "push" }, async ({ payload }) => {
        if (!payload || typeof payload !== "object") return;
        const p = payload as BroadcastPayload;
        if (Array.isArray(p.target_user_ids) && p.target_user_ids.length > 0) {
          try {
            const { data } = await supabase.auth.getUser();
            const uid = data?.user?.id;
            if (!uid || !p.target_user_ids.includes(uid)) return;
          } catch { return; }
        }
        showBroadcast(p);
      })
      .subscribe();

    return () => {
      window.removeEventListener("admin-broadcast-preview", onPreview);
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
