import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Phone, PhoneOff, Video } from "lucide-react";
import { playRingTone } from "@/lib/ringtone";
import { answerCall, declineCall, type CallRow } from "@/lib/callActions";

type Incoming = {
  callId: string;
  fromId: string;
  kind: "voice" | "video";
  scope: "direct" | "group";
  groupId: string | null;
  name?: string;
};

export function IncomingCallListener() {
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const navigate = useNavigate();
  const ringRef = useRef<{ stop: () => void } | null>(null);

  // Ring tone + vibration while ringing
  useEffect(() => {
    if (!incoming) return;
    ringRef.current = playRingTone();
    let vibTimer: number | null = null;
    if ("vibrate" in navigator) {
      const pulse = () => navigator.vibrate?.([400, 200, 400, 1400]);
      pulse();
      vibTimer = window.setInterval(pulse, 2400);
    }
    return () => {
      ringRef.current?.stop();
      ringRef.current = null;
      if (vibTimer) window.clearInterval(vibTimer);
      if ("vibrate" in navigator) navigator.vibrate?.(0);
    };
  }, [incoming]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let me: string | null = null;

    async function surfaceCall(callId: string) {
      if (!me) return;
      const { data: c } = await supabase.from("calls").select("*").eq("id", callId).maybeSingle();
      if (!c) return;
      const call = c as unknown as CallRow;
      if (call.status !== "ringing") return;
      if (call.scope === "group") return;
      // Ignore stale (>50s old)
      if (Date.now() - new Date(call.started_at).getTime() > 50_000) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", call.initiator_id)
        .maybeSingle();
      setIncoming((prev) =>
        prev
          ? prev
          : {
              callId: call.id,
              fromId: call.initiator_id,
              kind: call.kind,
              scope: call.scope,
              groupId: call.group_id,
              name: p?.display_name ?? undefined,
            },
      );
    }

    async function catchUp() {
      if (!me) return;
      // Find any call_participants row for me still ringing
      const { data: rows } = await supabase
        .from("call_participants")
        .select("call_id")
        .eq("user_id", me)
        .eq("state", "ringing")
        .order("created_at", { ascending: false })
        .limit(5);
      for (const r of rows ?? []) await surfaceCall((r as { call_id: string }).call_id);
    }

    function onVisible() {
      if (document.visibilityState === "visible") catchUp();
    }

    let pollTimer: number | null = null;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      me = u.user.id;
      const topic = `incoming-${me}-${Math.random().toString(36).slice(2)}`;
      channel = supabase.channel(topic);
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_participants", filter: `user_id=eq.${me}` },
          (payload) => {
            const row = payload.new as { call_id: string; state: string };
            if (row.state === "ringing") void surfaceCall(row.call_id);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "call_participants", filter: `user_id=eq.${me}` },
          (payload) => {
            const row = payload.new as { call_id: string; state: string };
            if (row.state !== "ringing") {
              setIncoming((prev) => (prev?.callId === row.call_id ? null : prev));
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "calls" },
          (payload) => {
            const c = payload.new as { id: string; status: string };
            if (c.status !== "ringing") {
              setIncoming((prev) => (prev?.callId === c.id ? null : prev));
            }
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void catchUp();
        });
      void catchUp();
      // Polling fallback — realtime may be delayed or disconnected.
      pollTimer = window.setInterval(() => { void catchUp(); }, 2500);
      window.addEventListener("focus", catchUp);
      document.addEventListener("visibilitychange", onVisible);
    })();
    return () => {
      cancelled = true;
      if (pollTimer) window.clearInterval(pollTimer);
      window.removeEventListener("focus", catchUp);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (!incoming) return null;

  async function accept() {
    if (!incoming) return;
    try {
      await answerCall(incoming.callId);
    } catch (e) {
      console.warn("answer failed", e);
    }
    if (incoming.scope === "group" && incoming.groupId) {
      navigate({
        to: "/app/call/group/$groupId",
        params: { groupId: incoming.groupId },
        search: { callId: incoming.callId, role: "callee" },
      });
    } else {
      navigate({
        to: "/app/call/$peerId",
        params: { peerId: incoming.fromId },
        search: { callId: incoming.callId, role: "callee", mode: incoming.kind },
      });
    }
    setIncoming(null);
  }

  async function decline() {
    if (!incoming) return;
    try { await declineCall(incoming.callId); } catch (e) { console.warn(e); }
    setIncoming(null);
  }

  return (
    <div className="fixed inset-x-0 top-4 z-[100] flex justify-center px-4 animate-fade-in">
      <div className="w-full max-w-[420px] bg-surface/95 backdrop-blur-xl border border-petal/40 rounded-3xl p-4 shadow-2xl flex items-center gap-3 petal-glow">
        <div className="size-12 rounded-full bg-petal-soft flex items-center justify-center">
          {incoming.kind === "video" ? <Video className="size-5 text-petal" /> : <Phone className="size-5 text-petal" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">
            Incoming {incoming.kind} call{incoming.scope === "group" ? " · group" : ""}
          </p>
          <p className="font-serif italic text-lg truncate">{incoming.name ?? "Someone"}</p>
        </div>
        <button
          onClick={decline}
          className="size-11 rounded-full bg-velvet border border-border flex items-center justify-center text-candle-muted hover:text-petal"
          aria-label="Decline"
        >
          <PhoneOff className="size-5" />
        </button>
        <button
          onClick={accept}
          className="size-11 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow"
          aria-label="Accept"
        >
          <Phone className="size-5" />
        </button>
      </div>
    </div>
  );
}
