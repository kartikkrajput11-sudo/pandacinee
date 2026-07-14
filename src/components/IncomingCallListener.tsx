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
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const me = u.user.id;
      const topic = `incoming-${me}-${Math.random().toString(36).slice(2)}`;
      channel = supabase.channel(topic);
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_signals", filter: `to_id=eq.${me}` },
          async (payload: any) => {
            const sig = payload.new;
            if (sig.kind !== "invite") return;
            const { data: p } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", sig.from_id)
              .maybeSingle();
            setIncoming({ from_id: sig.from_id, mode: sig.payload?.mode ?? "video", name: p?.display_name });
          }
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (!incoming) return null;

  async function accept() {
    if (!incoming) return;
    navigate({ to: "/app/call/$peerId", params: { peerId: incoming.from_id }, search: { role: "callee", mode: incoming.mode } });
    setIncoming(null);
  }

  async function decline() {
    if (!incoming) return;
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("call_signals").insert({
        from_id: u.user.id,
        to_id: incoming.from_id,
        kind: "decline",
        payload: {},
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
