import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Phone, PhoneMissed, PhoneIncoming, PhoneOutgoing, Video, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AvatarImg } from "@/components/AvatarImg";

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

type Filter = "all" | "missed" | "video" | "voice";

function fmtWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
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
  const [filter, setFilter] = useState<Filter>("all");

  const { data: calls, isLoading } = useQuery({
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

  const filtered = useMemo(() => {
    const list = calls ?? [];
    if (filter === "all") return list;
    if (filter === "missed")
      return list.filter((c) => c.status === "missed" || (c.status === "ended" && !c.duration_seconds));
    return list.filter((c) => c.kind === filter);
  }, [calls, filter]);

  const stats = useMemo(() => {
    const list = calls ?? [];
    const missed = list.filter((c) => c.status === "missed" || (c.status === "ended" && !c.duration_seconds)).length;
    const totalSec = list.reduce((n, c) => n + (c.duration_seconds ?? 0), 0);
    const totalMin = Math.round(totalSec / 60);
    return { total: list.length, missed, totalMin };
  }, [calls]);

  return (
    <div className="pt-10 px-5 pb-24 relative">
      {/* Ambient bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px]"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 0%, hsl(var(--petal) / 0.15), transparent 70%)",
        }}
      />

      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 mb-6">
        <Link
          to="/app"
          className="size-9 rounded-full grid place-items-center bg-surface/60 border border-border text-candle-muted hover:text-candle transition"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.35em] text-petal">Recents</p>
          <h1 className="font-serif text-2xl italic truncate">Calls</h1>
        </div>
      </header>

      {/* Stat trio */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatTile label="Total" value={stats.total} />
          <StatTile label="Missed" value={stats.missed} tone={stats.missed > 0 ? "rose" : undefined} />
          <StatTile label="Minutes" value={stats.totalMin} />
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1">
        {(["all", "missed", "video", "voice"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-[0.2em] transition ${
              filter === f
                ? "bg-petal text-velvet petal-glow"
                : "bg-surface border border-border text-candle-muted hover:text-candle"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-surface/60 border border-border animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto size-14 rounded-full grid place-items-center bg-petal-soft border border-petal/30 mb-3">
              <Phone className="size-5 text-petal" />
            </div>
            <p className="text-candle-muted text-sm font-serif italic">
              {filter === "all" ? "No calls yet." : `No ${filter} calls.`}
            </p>
          </div>
        )}
        {filtered.map((c) => {
          const otherId = c.initiator_id === me?.id ? c.peer_id : c.initiator_id;
          const other = otherId ? peerNames?.[otherId] : null;
          const missed = c.status === "missed" || (c.status === "ended" && !c.duration_seconds);
          const outgoing = c.initiator_id === me?.id;
          const name = c.scope === "group" ? "Group call" : (other?.display_name ?? "Unknown");

          return (
            <div
              key={c.id}
              className="group flex items-center gap-3 bg-surface/70 backdrop-blur border border-border rounded-2xl px-3.5 py-3 hover:border-petal/40 transition"
            >
              {/* Avatar */}
              <div className="relative size-11 rounded-full overflow-hidden bg-petal-soft border border-petal/20 shrink-0 grid place-items-center">
                {c.scope === "group" ? (
                  <Users className="size-4 text-petal" />
                ) : other?.avatar_url ? (
                  <AvatarImg src={other.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-serif italic text-petal">
                    {name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 size-4 rounded-full grid place-items-center border-2 border-velvet ${
                    missed ? "bg-rose-500" : c.kind === "video" ? "bg-petal" : "bg-emerald-500"
                  }`}
                >
                  {c.kind === "video" ? (
                    <Video className="size-2 text-white" />
                  ) : missed ? (
                    <PhoneMissed className="size-2 text-white" />
                  ) : outgoing ? (
                    <PhoneOutgoing className="size-2 text-white" />
                  ) : (
                    <PhoneIncoming className="size-2 text-white" />
                  )}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-serif italic truncate ${missed ? "text-rose-300" : "text-candle"}`}>
                  {name}
                </p>
                <p className="text-[11px] text-candle-muted flex items-center gap-1.5">
                  <span className="uppercase tracking-[0.15em]">
                    {missed ? "Missed" : outgoing ? "Outgoing" : "Incoming"}
                  </span>
                  {c.duration_seconds ? (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="tabular-nums">{fmtDur(c.duration_seconds)}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <span className="text-[11px] text-candle-muted tabular-nums shrink-0">
                {fmtWhen(c.started_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "rose" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/70 backdrop-blur px-3 py-3 text-center">
      <p
        className={`font-serif text-2xl italic tabular-nums ${
          tone === "rose" ? "text-rose-300" : "text-candle"
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-[0.3em] text-candle-muted mt-0.5">{label}</p>
    </div>
  );
}
