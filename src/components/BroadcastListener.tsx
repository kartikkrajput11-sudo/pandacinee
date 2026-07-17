import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type BroadcastPayload = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "love" | "sparkle";
  sent_at: number;
  preview?: boolean;
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
      .on("broadcast", { event: "push" }, ({ payload }) => {
        if (!payload || typeof payload !== "object") return;
        showBroadcast(payload as BroadcastPayload);
      })
      .subscribe();

    return () => {
      window.removeEventListener("admin-broadcast-preview", onPreview);
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
