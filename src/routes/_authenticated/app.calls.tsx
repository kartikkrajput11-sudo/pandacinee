import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone, PhoneMissed, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/calls")({
  component: CallsHistory,
});

type CallLog = {
  id: string;
  kind: "voice" | "video";
  scope: "direct" | "group";
  initiator_id: string;
  peer_id: string | null;
  group_id: string | null;
  status: "ringing" | "active" | "ended" | "missed";
  started_at: string;
  duration_seconds: number | null;
  ended_reason: string | null;
};

function fmtWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtDur(sec: number | null) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CallsHistory() {
  const { data: profileData } = useProfile();
  const me = profileData?.profile;

  const { data: calls } = useQuery({
    enabled: !!me?.id,
    queryKey: ["call-history", me?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("calls")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as CallLog[];
    },
  });

  const { data: peerNames } = useQuery({
    enabled: !!calls && calls.length > 0,
    queryKey: ["call-peers", calls?.map((c) => c.peer_id ?? c.initiator_id).join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(
        (calls ?? []).flatMap((c) => [c.initiator_id, c.peer_id]).filter(Boolean) as string[],
      ));
      if (ids.length === 0) return {} as Record<string, { display_name: string; avatar_url: string | null }>;
      const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      const map: Record<string, { display_name: string; avatar_url: string | null }> = {};
      for (const p of data ?? []) {
        const row = p as { id: string; display_name: string; avatar_url: string | null };
        map[row.id] = { display_name: row.display_name, avatar_url: row.avatar_url };
      }
      return map;
    },
  });

  return (
    <div className="pt-10 px-5 pb-20">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Recents</p>
          <h1 className="font-serif text-2xl italic">Calls</h1>
        </div>
      </header>

      <div className="space-y-2">
        {(calls ?? []).length === 0 && (
          <p className="text-candle-muted text-sm text-center py-12 font-serif italic">No calls yet.</p>
        )}
        {(calls ?? []).map((c) => {
          const otherId = c.initiator_id === me?.id ? c.peer_id : c.initiator_id;
          const other = otherId ? peerNames?.[otherId] : null;
          const missed = c.status === "missed" || (c.status === "ended" && !c.duration_seconds);
          const outgoing = c.initiator_id === me?.id;
          return (
            <div key={c.id} className="flex items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3">
              <div className={`size-10 rounded-full flex items-center justify-center ${missed ? "bg-rose-500/10 text-rose-400" : "bg-petal-soft text-petal"}`}>
                {c.kind === "video" ? <Video className="size-4" /> : missed ? <PhoneMissed className="size-4" /> : <Phone className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif italic truncate">
                  {c.scope === "group" ? "Group call" : (other?.display_name ?? "Unknown")}
                </p>
                <p className="text-xs text-candle-muted">
                  {missed ? "Missed" : outgoing ? "Outgoing" : "Incoming"}
                  {c.duration_seconds ? ` · ${fmtDur(c.duration_seconds)}` : ""}
                </p>
              </div>
              <span className="text-xs text-candle-muted tabular-nums">{fmtWhen(c.started_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
