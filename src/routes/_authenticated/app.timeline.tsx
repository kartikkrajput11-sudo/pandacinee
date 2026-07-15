import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Sparkles, Heart, Calendar, Star, BookHeart, Camera, Milestone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/timeline")({
  component: TimelinePage,
  head: () => ({
    meta: [
      { title: "Timeline · Highlights of us" },
      { name: "description", content: "Your love story, unspooled beat by beat." },
    ],
  }),
});

type Memory = {
  id: string;
  title: string;
  body: string | null;
  mood: string | null;
  happened_on: string | null;
  created_at: string;
};

type TimelineItem = {
  id: string;
  date: string; // ISO
  title: string;
  body?: string | null;
  mood?: string | null;
  kind: "anniversary" | "memory" | "milestone" | "today";
};

const KIND_META: Record<TimelineItem["kind"], { Icon: typeof Heart; tint: string; label: string }> = {
  anniversary: { Icon: Heart,     tint: "#e88aab", label: "Anniversary" },
  memory:      { Icon: BookHeart, tint: "#c9a84c", label: "Memory" },
  milestone:   { Icon: Milestone, tint: "#5cbdb9", label: "Milestone" },
  today:       { Icon: Sparkles,  tint: "#f0d78c", label: "Today" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function TimelinePage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const cardsRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!me) return;
    (async () => {
      const { data: rows } = await (supabase as any)
        .from("memory_jar")
        .select("id,title,body,mood,happened_on,created_at")
        .order("happened_on", { ascending: true, nullsFirst: false });
      setMemories((rows ?? []) as Memory[]);
    })();
    const ch = supabase
      .channel("timeline_memories")
      .on("postgres_changes", { event: "*", schema: "public", table: "memory_jar" }, async () => {
        const { data: rows } = await (supabase as any)
          .from("memory_jar")
          .select("id,title,body,mood,happened_on,created_at")
          .order("happened_on", { ascending: true, nullsFirst: false });
        setMemories((rows ?? []) as Memory[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id]);

  const items = useMemo<TimelineItem[]>(() => {
    const list: TimelineItem[] = [];
    const anniv = me?.anniversary_date;
    if (anniv) {
      list.push({
        id: "anniv",
        date: anniv,
        title: "The day we began",
        body: partner?.display_name ? `You & ${me?.partner_nickname || partner.display_name}.` : "The first spark.",
        mood: "💗",
        kind: "anniversary",
      });
    }
    for (const m of memories) {
      list.push({
        id: m.id,
        date: m.happened_on ?? m.created_at,
        title: m.title,
        body: m.body,
        mood: m.mood,
        kind: "memory",
      });
    }
    // Milestone: days-together marker every 100
    if (anniv) {
      const days = daysBetween(anniv, new Date().toISOString());
      const nearestHundred = Math.floor(days / 100) * 100;
      if (nearestHundred >= 100) {
        const milestoneDate = new Date(new Date(anniv).getTime() + nearestHundred * 86400000).toISOString();
        list.push({
          id: `ms-${nearestHundred}`,
          date: milestoneDate,
          title: `${nearestHundred} days together`,
          body: "A quiet, wonderful number.",
          mood: "✨",
          kind: "milestone",
        });
      }
    }
    list.push({
      id: "today",
      date: new Date().toISOString(),
      title: "Today",
      body: "Still writing this story.",
      mood: "💜",
      kind: "today",
    });
    return list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [me?.anniversary_date, me?.partner_nickname, partner?.display_name, memories]);

  // Auto-cycle "active" item every 3.2s
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % items.length);
    }, 3200);
    return () => clearInterval(t);
  }, [items.length]);

  // Scroll the active card into view softly
  useEffect(() => {
    const el = cardsRef.current[activeIdx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-20 size-[420px] rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(closest-side, #c96b7a55, transparent)" }} />
        <div className="absolute top-1/3 -right-24 size-[420px] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(closest-side, #5cbdb955, transparent)" }} />
        <div className="absolute bottom-0 left-1/4 size-[320px] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(closest-side, #f0d78c66, transparent)" }} />
      </div>

      <div className="pt-10 px-5 pb-24 max-w-md mx-auto">
        <header className="flex items-center gap-3 mb-6">
          <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.28em] text-petal">Highlights of us</p>
            <h1 className="font-serif italic text-3xl leading-tight">Our timeline</h1>
          </div>
          <div className="size-10 rounded-full bg-petal-soft/40 border border-petal/30 flex items-center justify-center">
            <Sparkles className="size-4 text-petal animate-pulse" />
          </div>
        </header>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface p-8 text-center">
            <div className="size-14 mx-auto mb-3 rounded-full bg-petal-soft flex items-center justify-center">
              <Camera className="size-5 text-petal" />
            </div>
            <p className="font-serif italic text-xl mb-1">Nothing here yet</p>
            <p className="text-sm text-candle-muted mb-4">Add a memory or set your anniversary to start the timeline.</p>
            <Link to="/app/memories" className="inline-block h-11 px-5 leading-[44px] rounded-full bg-petal text-velvet font-semibold text-sm">Add memory</Link>
          </div>
        ) : (
          <div className="relative pl-8">
            {/* Rail */}
            <div className="absolute left-3 top-2 bottom-2 w-px overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-petal/40 to-transparent" />
              {/* Traveling light */}
              <div
                className="absolute left-0 w-px h-24 rounded-full opacity-80"
                style={{
                  background: "linear-gradient(to bottom, transparent, #f0d78c, #e88aab, transparent)",
                  animation: "timeline-travel 6s linear infinite",
                  filter: "drop-shadow(0 0 6px #e88aab)",
                }}
              />
            </div>

            <ol className="space-y-5">
              {items.map((it, i) => {
                const meta = KIND_META[it.kind];
                const Icon = meta.Icon;
                const isActive = i === activeIdx;
                return (
                  <li key={it.id}>
                    <div
                      ref={(el) => { cardsRef.current[i] = el; }}
                      className={`relative transition-all duration-500 ease-out ${isActive ? "scale-[1.015]" : "scale-100"}`}
                      style={{ animation: `timeline-in 0.7s ease-out both`, animationDelay: `${Math.min(i * 90, 900)}ms` }}
                    >
                      {/* Dot */}
                      <div
                        className={`absolute -left-8 top-4 size-6 rounded-full flex items-center justify-center border transition-all duration-500 ${isActive ? "scale-110" : "scale-100"}`}
                        style={{
                          background: `radial-gradient(closest-side, ${meta.tint}55, transparent 70%)`,
                          borderColor: `${meta.tint}88`,
                          boxShadow: isActive ? `0 0 24px ${meta.tint}` : `0 0 8px ${meta.tint}55`,
                        }}
                      >
                        <span className="size-2 rounded-full" style={{ background: meta.tint, boxShadow: `0 0 8px ${meta.tint}` }} />
                        {isActive && (
                          <span
                            className="absolute inset-0 rounded-full"
                            style={{ boxShadow: `0 0 0 0 ${meta.tint}`, animation: "timeline-ping 1.6s ease-out infinite" }}
                          />
                        )}
                      </div>

                      {/* Card */}
                      <div
                        className={`rounded-3xl border p-4 backdrop-blur-md transition-colors duration-500 ${isActive ? "border-petal/60 bg-surface/90" : "border-border bg-surface/70"}`}
                        style={{
                          boxShadow: isActive
                            ? `0 20px 60px -30px ${meta.tint}, inset 0 1px 0 rgba(255,255,255,0.05)`
                            : `0 10px 30px -25px ${meta.tint}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="size-6 rounded-full flex items-center justify-center" style={{ background: `${meta.tint}22` }}>
                            <Icon className="size-3.5" style={{ color: meta.tint }} />
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: meta.tint }}>{meta.label}</span>
                          <span className="ml-auto flex items-center gap-1 text-[11px] text-candle-muted">
                            <Calendar className="size-3" /> {fmtDate(it.date)}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          {it.mood && <span className="text-lg leading-none mt-0.5">{it.mood}</span>}
                          <div className="flex-1">
                            <h3 className="font-serif italic text-xl text-candle leading-snug">{it.title}</h3>
                            {it.body && <p className="text-sm text-candle-muted mt-1 leading-relaxed">{it.body}</p>}
                          </div>
                        </div>
                        {isActive && (
                          <div className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full"
                              style={{
                                width: "40%",
                                background: `linear-gradient(90deg, transparent, ${meta.tint}, transparent)`,
                                animation: "timeline-sweep 3.2s linear infinite",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2">
          <Link to="/app/memories" className="h-11 px-5 leading-[44px] rounded-full bg-petal text-velvet font-semibold text-sm inline-flex items-center gap-2">
            <Star className="size-4" /> Add a highlight
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes timeline-in {
          0% { opacity: 0; transform: translateY(16px) scale(0.98); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes timeline-travel {
          0% { top: -20%; }
          100% { top: 110%; }
        }
        @keyframes timeline-ping {
          0% { box-shadow: 0 0 0 0 currentColor; opacity: 0.6; }
          100% { box-shadow: 0 0 0 14px transparent; opacity: 0; }
        }
        @keyframes timeline-sweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
