import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Phone, PhoneOff, Video } from "lucide-react";
import { playRingTone } from "@/lib/ringtone";

type Incoming = { from_id: string; mode: "video" | "audio"; name?: string };

export function IncomingCallListener() {
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const navigate = useNavigate();
  const ringRef = useRef<{ stop: () => void } | null>(null);

  // Start/stop ring tone + vibrate while an incoming call is on screen
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
    const seen = new Set<string>();

    // Dismiss the ringing banner if another one of my devices (or the caller)
    // resolved this call — accepted/declined/cancelled. Keeps multi-device
    // ringing consistent like Instagram/Snapchat.
    function handleResolution(sig: any) {
      if (!sig) return;
      setIncoming((prev) => {
        if (!prev) return prev;
        const isMineResolving =
          sig.to_id === me && (sig.kind === "accepted" || sig.kind === "declined");
        const isCallerCancel =
          sig.kind === "cancel" && sig.from_id === prev.from_id;
        if (isMineResolving || isCallerCancel) return null;
        return prev;
      });
    }

    async function surfaceSignal(sig: any) {
      if (!sig || seen.has(sig.id)) return;
      seen.add(sig.id);
      if (sig.kind !== "invite") {
        handleResolution(sig);
        return;
      }
      // Ignore invites older than 45s — the caller has almost certainly given up.
      if (sig.created_at) {
        const age = Date.now() - new Date(sig.created_at).getTime();
        if (age > 45_000) return;
      }
      // Skip if this invite was already resolved on another device.
      const { data: resolutions } = await supabase
        .from("call_signals")
        .select("id, kind")
        .eq("to_id", me!)
        .in("kind", ["accepted", "declined", "cancel"])
        .gte("created_at", sig.created_at)
        .limit(1);
      if (resolutions && resolutions.length > 0) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", sig.from_id)
        .maybeSingle();
      setIncoming((prev) =>
        prev ? prev : { from_id: sig.from_id, mode: sig.payload?.mode ?? "video", name: p?.display_name },
      );
    }

    async function catchUp() {
      if (!me) return;
      const since = new Date(Date.now() - 45_000).toISOString();
      const { data } = await supabase
        .from("call_signals")
        .select("id, from_id, to_id, kind, payload, created_at")
        .eq("to_id", me)
        .eq("kind", "invite")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);
      for (const sig of data ?? []) await surfaceSignal(sig);
    }

    function onVisible() {
      if (document.visibilityState === "visible") catchUp();
    }

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      me = u.user.id;
      const topic = `incoming-${me}-${Math.random().toString(36).slice(2)}`;
      channel = supabase.channel(topic);
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_signals", filter: `to_id=eq.${me}` },
          (payload: any) => {
            void surfaceSignal(payload.new);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void catchUp();
        });
      void catchUp();
      window.addEventListener("focus", catchUp);
      document.addEventListener("visibilitychange", onVisible);
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("focus", catchUp);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (!incoming) return null;

  async function accept() {
    if (!incoming) return;
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      // Tell my other devices this call was picked up so their ringers stop.
      await supabase.from("call_signals").insert({
        from_id: u.user.id,
        to_id: u.user.id,
        kind: "accepted",
        payload: { peer_id: incoming.from_id } as never,
      });
    }
    navigate({ to: "/app/call/$peerId", params: { peerId: incoming.from_id }, search: { role: "callee", mode: incoming.mode } });
    setIncoming(null);
  }

  async function decline() {
    if (!incoming) return;
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      // Notify the caller
      await supabase.from("call_signals").insert({
        from_id: u.user.id,
        to_id: incoming.from_id,
        kind: "decline",
        payload: {},
      });
      // Notify my other devices so their ringers stop.
      await supabase.from("call_signals").insert({
        from_id: u.user.id,
        to_id: u.user.id,
        kind: "declined",
        payload: { peer_id: incoming.from_id } as never,
      });
    }
    setIncoming(null);
  }

  return (
    <div className="fixed inset-x-0 top-4 z-[100] flex justify-center px-4 animate-fade-in">
      <div className="w-full max-w-[420px] bg-surface/95 backdrop-blur-xl border border-petal/40 rounded-3xl p-4 shadow-2xl flex items-center gap-3 petal-glow">
        <div className="size-12 rounded-full bg-petal-soft flex items-center justify-center">
          {incoming.mode === "video" ? <Video className="size-5 text-petal" /> : <Phone className="size-5 text-petal" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">Incoming {incoming.mode} call</p>
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
