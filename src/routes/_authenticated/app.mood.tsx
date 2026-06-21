import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/mood")({
  component: MoodPage,
});

type Entry = { user_id: string; date: string; emoji: string | null; label: string | null; score: number };

const SCALE: { score: number; emoji: string; label: string }[] = [
  { score: 1, emoji: "😞", label: "Rough" },
  { score: 2, emoji: "😔", label: "Meh" },
  { score: 3, emoji: "😌", label: "Okay" },
  { score: 4, emoji: "😊", label: "Good" },
  { score: 5, emoji: "🥰", label: "Glowing" },
];

function MoodPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [entries, setEntries] = useState<Entry[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const myToday = entries.find((e) => e.user_id === me?.id && e.date === today);

  async function load() {
    if (!me) return;
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: rows } = await (supabase as any)
      .from("mood_log")
      .select("*")
      .gte("date", since)
      .order("date", { ascending: true });
    setEntries((rows ?? []) as Entry[]);
  }
  useEffect(() => { load(); }, [me?.id]);

  useEffect(() => {
    const ch = supabase.channel("mood_log")
      .on("postgres_changes", { event: "*", schema: "public", table: "mood_log" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id]);

  async function log(item: typeof SCALE[number]) {
    if (!me) return;
    const { error } = await (supabase as any).from("mood_log").upsert({
      user_id: me.id, date: today, score: item.score, emoji: item.emoji, label: item.label,
    }, { onConflict: "user_id,date" });
    if (error) toast.error(error.message);
  }

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
  const series = (uid?: string) => days.map((d) => entries.find((e) => e.user_id === uid && e.date === d)?.score ?? 0);
  const myScores = series(me?.id);
  const theirScores = series(partner?.id);

  return (
    <div className="pt-10 px-5 pb-10">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Together</p>
          <h1 className="font-serif text-2xl italic">Mood graph</h1>
        </div>
      </header>

      <div className="p-4 rounded-3xl border border-border bg-surface mb-5">
        <p className="text-xs text-candle-muted mb-3">How are you today?</p>
        <div className="grid grid-cols-5 gap-2">
          {SCALE.map((s) => (
            <button
              key={s.score}
              onClick={() => log(s)}
              className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                myToday?.score === s.score ? "border-petal bg-petal-soft" : "border-border bg-velvet"
              }`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <span className="text-[9px] text-candle-muted">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-3xl border border-border bg-surface mb-5">
        <p className="text-xs text-candle-muted mb-1">Last 30 days · you</p>
        <Bars scores={myScores} color="hsl(var(--petal, 340 80% 65%))" />
        {partner && (
          <>
            <p className="text-xs text-candle-muted mt-4 mb-1">{partner.display_name}</p>
            <Bars scores={theirScores} color="#a78bfa" />
          </>
        )}
      </div>

      <p className="text-xs text-candle-muted text-center">
        Average · you {avg(myScores).toFixed(1)}{partner ? ` · ${partner.display_name} ${avg(theirScores).toFixed(1)}` : ""}
      </p>
    </div>
  );
}

function avg(s: number[]) {
  const v = s.filter(Boolean);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

function Bars({ scores, color }: { scores: number[]; color: string }) {
  return (
    <div className="flex items-end gap-[2px] h-20">
      {scores.map((s, i) => (
        <div key={i} className="flex-1 bg-velvet rounded-sm relative" style={{ minHeight: 2 }}>
          {s > 0 && <div className="absolute bottom-0 left-0 right-0 rounded-sm" style={{ height: `${(s / 5) * 100}%`, background: color }} />}
        </div>
      ))}
    </div>
  );
}
