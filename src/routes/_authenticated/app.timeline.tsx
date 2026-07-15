import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Sparkles, Heart, Calendar, Star, BookHeart, Camera, Milestone,
  Moon, Feather, Gem, Crown, Wand2,
} from "lucide-react";
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
  date: string;
  title: string;
  body?: string | null;
  mood?: string | null;
  kind: "anniversary" | "memory" | "milestone" | "today";
};

const KIND_META: Record<TimelineItem["kind"], { Icon: typeof Heart; tint: string; label: string; ornament: typeof Crown }> = {
  anniversary: { Icon: Heart,     tint: "#e88aab", label: "Anniversary", ornament: Crown },
  memory:      { Icon: BookHeart, tint: "#c9a84c", label: "Memory",       ornament: Feather },
  milestone:   { Icon: Milestone, tint: "#5cbdb9", label: "Milestone",    ornament: Gem },
  today:       { Icon: Sparkles,  tint: "#f0d78c", label: "Today",        ornament: Wand2 },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/* ---------- Ambient sky ---------- */
function Sky() {
  const stars = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 0.6,
        delay: Math.random() * 6,
        dur: 3 + Math.random() * 5,
      })),
    [],
  );
  const shootings = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        id: i,
        top: 10 + Math.random() * 60,
        delay: i * 4 + Math.random() * 3,
      })),
    [],
  );
  const petals = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 10,
        dur: 12 + Math.random() * 12,
        rot: Math.random() * 360,
        size: 8 + Math.random() * 10,
      })),
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Deep night gradient */}
      <div className="absolute inset-0" style={{
        background:
          "radial-gradient(1200px 700px at 80% -10%, #3a1f3a 0%, transparent 60%)," +
          "radial-gradient(900px 700px at 10% 20%, #1a1b3a 0%, transparent 55%)," +
          "linear-gradient(180deg, #0a0714 0%, #100722 50%, #180a2e 100%)",
      }} />

      {/* Aurora ribbons */}
      <div className="absolute -inset-20 opacity-60 mix-blend-screen" style={{
        background:
          "radial-gradient(60% 40% at 20% 30%, #c96b7a55 0%, transparent 60%)," +
          "radial-gradient(50% 40% at 80% 60%, #5cbdb955 0%, transparent 60%)," +
          "radial-gradient(60% 40% at 50% 90%, #f0d78c44 0%, transparent 60%)",
        animation: "aurora-drift 18s ease-in-out infinite alternate",
        filter: "blur(30px)",
      }} />

      {/* Stars */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            opacity: 0.7,
            boxShadow: "0 0 6px rgba(255,255,255,0.9)",
            animation: `star-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Shooting stars */}
      {shootings.map((s) => (
        <span
          key={s.id}
          className="absolute h-px w-40"
          style={{
            top: `${s.top}%`,
            left: "-10%",
            background: "linear-gradient(90deg, transparent, #ffffff, #f0d78c, transparent)",
            filter: "drop-shadow(0 0 6px #f0d78c)",
            animation: `shooting 7s ease-in ${s.delay}s infinite`,
            transform: "rotate(15deg)",
          }}
        />
      ))}

      {/* Moon */}
      <div className="absolute top-8 right-8 size-16 rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 35%, #fff8e7, #f0d78c 60%, #a68a3a 100%)",
          boxShadow: "0 0 60px 10px #f0d78c55, inset -8px -8px 20px rgba(0,0,0,0.35)",
          animation: "moon-float 8s ease-in-out infinite",
        }}
      />

      {/* Falling petals */}
      {petals.map((p) => (
        <span
          key={p.id}
          className="absolute block"
          style={{
            top: "-5%",
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            borderRadius: "60% 40% 55% 45% / 55% 45% 55% 45%",
            background: "linear-gradient(135deg, #f8c8d8, #e88aab)",
            opacity: 0.55,
            transform: `rotate(${p.rot}deg)`,
            animation: `petal-fall ${p.dur}s linear ${p.delay}s infinite`,
            filter: "drop-shadow(0 4px 6px #00000040)",
          }}
        />
      ))}
    </div>
  );
}

/* ---------- Main ---------- */
function TimelinePage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const cardsRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!me) return;
    const load = async () => {
      const { data: rows } = await (supabase as any)
        .from("memory_jar")
        .select("id,title,body,mood,happened_on,created_at")
        .order("happened_on", { ascending: true, nullsFirst: false });
      setMemories((rows ?? []) as Memory[]);
    };
    void load();
    const ch = supabase
      .channel("timeline_memories")
      .on("postgres_changes", { event: "*", schema: "public", table: "memory_jar" }, () => void load())
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
        body: partner?.display_name ? `You & ${me?.partner_nickname || partner.display_name}. The first spark.` : "The first spark.",
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
    if (anniv) {
      const days = daysBetween(anniv, new Date().toISOString());
      const nearestHundred = Math.floor(days / 100) * 100;
      if (nearestHundred >= 100) {
        list.push({
          id: `ms-${nearestHundred}`,
          date: new Date(new Date(anniv).getTime() + nearestHundred * 86400000).toISOString(),
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
      body: "Still writing this story, together.",
      mood: "💜",
      kind: "today",
    });
    return list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [me?.anniversary_date, me?.partner_nickname, partner?.display_name, memories]);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % items.length), 3600);
    return () => clearInterval(t);
  }, [items.length]);

  useEffect(() => {
    const el = cardsRef.current[activeIdx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIdx]);

  const daysTotal = me?.anniversary_date ? daysBetween(me.anniversary_date, new Date().toISOString()) : null;

  return (
    <div className="relative min-h-screen">
      <Sky />

      <div className="pt-8 px-5 pb-28 max-w-md mx-auto">
        {/* Ornate header */}
        <header className="relative mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/app" className="size-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex-1 text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur">
                <Moon className="size-3 text-[#f0d78c]" />
                <span className="text-[10px] uppercase tracking-[0.28em] text-white/70">Chronicle</span>
              </div>
            </div>
          </div>

          <div className="text-center relative py-2">
            {/* Filigree */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="h-px w-16" style={{ background: "linear-gradient(90deg, transparent, #f0d78c, transparent)" }} />
              <Gem className="size-3 text-[#f0d78c] animate-pulse" />
              <span className="h-px w-16" style={{ background: "linear-gradient(90deg, transparent, #f0d78c, transparent)" }} />
            </div>
            <p className="text-[10px] uppercase tracking-[0.42em] text-[#f0d78c]/80">Highlights of us</p>
            <h1
              className="font-serif italic text-5xl leading-tight mt-1"
              style={{
                background: "linear-gradient(180deg, #fff8e7 0%, #f0d78c 55%, #a68a3a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 4px 20px #f0d78c33)",
              }}
            >
              Our Timeline
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="h-px w-10" style={{ background: "linear-gradient(90deg, transparent, #e88aab, transparent)" }} />
              <Heart className="size-3 text-[#e88aab]" style={{ animation: "heart-beat 1.6s ease-in-out infinite" }} />
              <span className="h-px w-10" style={{ background: "linear-gradient(90deg, transparent, #e88aab, transparent)" }} />
            </div>
          </div>

          {/* Stat ribbon */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <RibbonStat value={items.length} label="Chapters" tint="#f0d78c" />
            <RibbonStat value={daysTotal ?? "—"} label="Days" tint="#e88aab" />
            <RibbonStat value={memories.length} label="Memories" tint="#5cbdb9" />
          </div>
        </header>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center">
            <div className="size-14 mx-auto mb-3 rounded-full bg-petal-soft flex items-center justify-center">
              <Camera className="size-5 text-petal" />
            </div>
            <p className="font-serif italic text-xl mb-1 text-white">Nothing here yet</p>
            <p className="text-sm text-white/60 mb-4">Add a memory or set your anniversary to start the timeline.</p>
            <Link to="/app/memories" className="inline-block h-11 px-5 leading-[44px] rounded-full bg-petal text-velvet font-semibold text-sm">Add memory</Link>
          </div>
        ) : (
          <div className="relative pl-10">
            {/* Ornate rail */}
            <div className="absolute left-4 top-2 bottom-2 w-[3px] overflow-hidden rounded-full">
              <div className="absolute inset-0" style={{
                background:
                  "linear-gradient(180deg, transparent 0%, #f0d78c66 15%, #e88aab66 50%, #5cbdb966 85%, transparent 100%)",
              }} />
              <div className="absolute inset-0 opacity-70" style={{
                backgroundImage: "repeating-linear-gradient(180deg, transparent 0 10px, #ffffff22 10px 11px)",
              }} />
              <div
                className="absolute -left-[3px] w-[9px] h-28 rounded-full"
                style={{
                  background: "linear-gradient(to bottom, transparent, #fff8e7, #f0d78c, transparent)",
                  animation: "timeline-travel 6s linear infinite",
                  filter: "blur(1px) drop-shadow(0 0 12px #f0d78c)",
                }}
              />
            </div>

            <ol className="space-y-6">
              {items.map((it, i) => {
                const meta = KIND_META[it.kind];
                const Icon = meta.Icon;
                const Ornament = meta.ornament;
                const isActive = i === activeIdx;
                return (
                  <li key={it.id}>
                    <div
                      ref={(el) => { cardsRef.current[i] = el; }}
                      className="relative"
                      style={{ animation: "timeline-in 0.8s cubic-bezier(.2,.7,.2,1) both", animationDelay: `${Math.min(i * 100, 900)}ms` }}
                    >
                      {/* Ornate dot with rotating ring */}
                      <div className="absolute -left-[42px] top-6">
                        <span
                          className="absolute inset-0 -m-2 rounded-full"
                          style={{
                            background: `conic-gradient(from 0deg, transparent, ${meta.tint}, transparent 60%)`,
                            animation: "ring-spin 6s linear infinite",
                            filter: "blur(1px)",
                            opacity: isActive ? 1 : 0.5,
                          }}
                        />
                        <div
                          className="relative size-7 rounded-full flex items-center justify-center border-2"
                          style={{
                            background: `radial-gradient(closest-side, ${meta.tint}, ${meta.tint}44 60%, transparent)`,
                            borderColor: "#fff8e7",
                            boxShadow: isActive ? `0 0 30px ${meta.tint}` : `0 0 10px ${meta.tint}77`,
                          }}
                        >
                          <Ornament className="size-3.5 text-white drop-shadow" />
                          {isActive && (
                            <span className="absolute inset-0 rounded-full"
                              style={{
                                animation: "timeline-ping 1.8s ease-out infinite",
                                boxShadow: `0 0 0 0 ${meta.tint}`,
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Card */}
                      <div
                        className="relative rounded-[28px] p-[1.5px] overflow-hidden group"
                        style={{
                          background: isActive
                            ? `conic-gradient(from 90deg, ${meta.tint}, #fff8e7, ${meta.tint}, #e88aab, ${meta.tint})`
                            : `linear-gradient(140deg, ${meta.tint}55, transparent 50%, ${meta.tint}33)`,
                          animation: isActive ? "border-spin 8s linear infinite" : undefined,
                        }}
                      >
                        <div
                          className="rounded-[26px] p-4 backdrop-blur-xl relative overflow-hidden"
                          style={{
                            background: "linear-gradient(160deg, rgba(20,10,32,0.85), rgba(30,14,48,0.7))",
                          }}
                        >
                          {/* Inner sheen */}
                          <div aria-hidden className="absolute inset-0 pointer-events-none opacity-70"
                            style={{
                              background:
                                `radial-gradient(120% 60% at 0% 0%, ${meta.tint}18, transparent 60%),` +
                                "radial-gradient(80% 50% at 100% 100%, #ffffff10, transparent 60%)",
                            }}
                          />
                          {/* Sparkle dust */}
                          <span aria-hidden className="absolute top-3 right-3 size-1 rounded-full bg-white/90" style={{ animation: "star-twinkle 2.4s ease-in-out infinite", boxShadow: "0 0 6px #fff" }} />
                          <span aria-hidden className="absolute top-8 right-10 size-[3px] rounded-full bg-[#f0d78c]" style={{ animation: "star-twinkle 3.4s ease-in-out .6s infinite", boxShadow: "0 0 6px #f0d78c" }} />
                          <span aria-hidden className="absolute bottom-6 left-4 size-[2px] rounded-full bg-[#e88aab]" style={{ animation: "star-twinkle 2.8s ease-in-out 1.2s infinite", boxShadow: "0 0 6px #e88aab" }} />

                          {/* Header row */}
                          <div className="relative flex items-center gap-2 mb-2">
                            <div className="size-7 rounded-full flex items-center justify-center border"
                              style={{ background: `${meta.tint}22`, borderColor: `${meta.tint}66` }}>
                              <Icon className="size-3.5" style={{ color: meta.tint }} />
                            </div>
                            <span
                              className="text-[10px] uppercase tracking-[0.28em] font-medium"
                              style={{ color: meta.tint, textShadow: `0 0 12px ${meta.tint}66` }}
                            >
                              {meta.label}
                            </span>
                            <span className="ml-auto flex items-center gap-1 text-[11px] text-white/70 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                              <Calendar className="size-3" /> {fmtDate(it.date)}
                            </span>
                          </div>

                          {/* Body */}
                          <div className="relative flex items-start gap-3">
                            {it.mood && (
                              <div
                                className="size-11 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${meta.tint}33, ${meta.tint}11)`,
                                  border: `1px solid ${meta.tint}44`,
                                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px -12px ${meta.tint}`,
                                }}
                              >
                                <span style={{ animation: "float-bob 3.2s ease-in-out infinite" }}>{it.mood}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3
                                className="font-serif italic text-2xl leading-snug"
                                style={{
                                  background: "linear-gradient(180deg, #fff8e7, #f0d78c)",
                                  WebkitBackgroundClip: "text",
                                  WebkitTextFillColor: "transparent",
                                }}
                              >
                                {it.title}
                              </h3>
                              {it.body && <p className="text-sm text-white/70 mt-1 leading-relaxed">{it.body}</p>}
                            </div>
                          </div>

                          {/* Footer chips */}
                          <div className="relative mt-3 flex items-center gap-2 flex-wrap">
                            <Chip tint={meta.tint} icon={<Star className="size-3" />} label={meta.label} />
                            {me?.anniversary_date && (
                              <Chip
                                tint="#5cbdb9"
                                icon={<Heart className="size-3" />}
                                label={`Day ${Math.max(0, daysBetween(me.anniversary_date, it.date))}`}
                              />
                            )}
                          </div>

                          {/* Sweep bar when active */}
                          {isActive && (
                            <div className="relative mt-3 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full"
                                style={{
                                  width: "45%",
                                  background: `linear-gradient(90deg, transparent, ${meta.tint}, #fff8e7, ${meta.tint}, transparent)`,
                                  animation: "timeline-sweep 3.6s linear infinite",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mt-10 flex items-center justify-center">
          <Link
            to="/app/memories"
            className="relative h-12 px-6 leading-[48px] rounded-full font-semibold text-sm inline-flex items-center gap-2 overflow-hidden group"
            style={{
              background: "linear-gradient(135deg, #f0d78c, #e88aab)",
              color: "#180a2e",
              boxShadow: "0 20px 50px -20px #e88aab",
            }}
          >
            <span className="absolute inset-0 opacity-40" style={{
              background: "linear-gradient(90deg, transparent, #ffffff88, transparent)",
              animation: "btn-shine 2.6s linear infinite",
            }} />
            <Star className="size-4 relative" /> <span className="relative">Add a highlight</span>
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes timeline-in {
          0% { opacity: 0; transform: translateY(24px) scale(0.96); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes timeline-travel { 0% { top: -20%; } 100% { top: 110%; } }
        @keyframes timeline-ping {
          0% { box-shadow: 0 0 0 0 currentColor; opacity: 0.7; }
          100% { box-shadow: 0 0 0 18px transparent; opacity: 0; }
        }
        @keyframes timeline-sweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes shooting {
          0% { transform: translate(0, 0) rotate(15deg); opacity: 0; }
          8% { opacity: 1; }
          40% { opacity: 1; }
          60% { transform: translate(140vw, 40vh) rotate(15deg); opacity: 0; }
          100% { transform: translate(140vw, 40vh) rotate(15deg); opacity: 0; }
        }
        @keyframes petal-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.7; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }
        @keyframes aurora-drift {
          0% { transform: translate(0,0) scale(1); }
          100% { transform: translate(-4%, 3%) scale(1.05); }
        }
        @keyframes moon-float {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes ring-spin { to { transform: rotate(360deg); } }
        @keyframes border-spin { to { filter: hue-rotate(360deg); } }
        @keyframes heart-beat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.2); }
          50% { transform: scale(0.95); }
          75% { transform: scale(1.15); }
        }
        @keyframes float-bob {
          0%,100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-4px) rotate(3deg); }
        }
        @keyframes btn-shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function RibbonStat({ value, label, tint }: { value: number | string; label: string; tint: string }) {
  return (
    <div
      className="relative rounded-2xl p-[1px] overflow-hidden"
      style={{ background: `linear-gradient(140deg, ${tint}, transparent 60%)` }}
    >
      <div className="rounded-[15px] px-3 py-2 text-center backdrop-blur-md"
        style={{ background: "linear-gradient(160deg, rgba(20,10,32,0.75), rgba(30,14,48,0.55))" }}>
        <p className="font-serif italic text-2xl leading-none"
          style={{
            background: `linear-gradient(180deg, #fff8e7, ${tint})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {value}
        </p>
        <p className="text-[9px] uppercase tracking-[0.24em] text-white/60 mt-1">{label}</p>
      </div>
    </div>
  );
}

function Chip({ tint, icon, label }: { tint: string; icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border backdrop-blur"
      style={{
        color: tint,
        borderColor: `${tint}55`,
        background: `${tint}12`,
      }}
    >
      {icon} {label}
    </span>
  );
}
