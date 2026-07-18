import { useEffect, useState } from "react";
import { Calendar, Check, X, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Rsvp = { user_id: string; response: "yes" | "no" | "maybe" };

export function GroupEventCard({
  eventId,
  meId,
  mine,
}: {
  eventId: string;
  meId: string | null;
  mine: boolean;
}) {
  const [ev, setEv] = useState<{ title: string; starts_at: string; location: string | null } | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);

  useEffect(() => {
    let alive = true;
    supabase.from("group_events" as never).select("title,starts_at,location").eq("id", eventId).maybeSingle().then(({ data }) => {
      if (alive) setEv((data as never) ?? null);
    });
    supabase.from("group_event_rsvps" as never).select("user_id,response").eq("event_id", eventId).then(({ data }) => {
      if (alive) setRsvps(((data ?? []) as unknown) as Rsvp[]);
    });
    const ch = supabase
      .channel(`ev-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_rsvps", filter: `event_id=eq.${eventId}` }, async () => {
        const { data } = await supabase.from("group_event_rsvps" as never).select("user_id,response").eq("event_id", eventId);
        if (alive) setRsvps(((data ?? []) as unknown) as Rsvp[]);
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [eventId]);

  async function rsvp(response: "yes" | "no" | "maybe") {
    if (!meId) return;
    const { error } = await supabase
      .from("group_event_rsvps" as never)
      .upsert({ event_id: eventId, user_id: meId, response, updated_at: new Date().toISOString() } as never, { onConflict: "event_id,user_id" });
    if (error) toast.error(error.message);
  }

  if (!ev) return null;
  const yes = rsvps.filter((r) => r.response === "yes").length;
  const maybe = rsvps.filter((r) => r.response === "maybe").length;
  const no = rsvps.filter((r) => r.response === "no").length;
  const myR = rsvps.find((r) => r.user_id === meId)?.response;
  const when = new Date(ev.starts_at);
  const fmt = when.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className={`w-[280px] rounded-2xl overflow-hidden border ${mine ? "border-velvet/30 bg-velvet/10" : "border-petal/40 bg-surface-elevated"}`}>
      <div className="p-4 bg-gradient-to-br from-petal/20 via-petal-soft/15 to-transparent">
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className={`size-3.5 ${mine ? "text-velvet/70" : "text-petal"}`} />
          <span className={`text-[10px] uppercase tracking-[0.25em] ${mine ? "text-velvet/70" : "text-petal"}`}>Plan</span>
        </div>
        <p className={`font-serif italic text-base leading-tight ${mine ? "text-velvet" : "text-candle"}`}>{ev.title}</p>
        <p className={`text-[11px] mt-1 ${mine ? "text-velvet/70" : "text-candle-muted"}`}>{fmt}</p>
        {ev.location && <p className={`text-[11px] italic ${mine ? "text-velvet/70" : "text-candle-muted"}`}>{ev.location}</p>}
      </div>
      <div className="grid grid-cols-3 border-t border-border/60 text-[11px]">
        <RsvpBtn active={myR === "yes"} onClick={() => rsvp("yes")} icon={<Check className="size-3" />} label={`Going · ${yes}`} />
        <RsvpBtn active={myR === "maybe"} onClick={() => rsvp("maybe")} icon={<HelpCircle className="size-3" />} label={`Maybe · ${maybe}`} />
        <RsvpBtn active={myR === "no"} onClick={() => rsvp("no")} icon={<X className="size-3" />} label={`Can't · ${no}`} />
      </div>
    </div>
  );
}

function RsvpBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`px-2 py-2 flex items-center justify-center gap-1 border-r last:border-r-0 border-border/60 transition-colors ${
        active ? "bg-petal/20 text-petal font-medium" : "text-candle-muted hover:bg-surface"
      }`}
    >
      {icon} {label}
    </button>
  );
}
