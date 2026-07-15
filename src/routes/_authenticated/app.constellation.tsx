import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/constellation")({
  component: ConstellationRoute,
});

type Star = {
  id: string;
  title: string;
  detail: string;
  glyph: string;
  date: string; // ISO date
  origin: "paired" | "anniversary" | "memory" | "mood" | "note";
};

function ConstellationRoute() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [stars, setStars] = useState<Star[]>([]);
  const [selected, setSelected] = useState<Star | null>(null);
  const [composing, setComposing] = useState(false);

  async function load() {
    if (!me) return;
    const derived: Star[] = [];

    // Pairing star.
    if (me.paired_at) {
      derived.push({
        id: `paired-${me.paired_at}`,
        title: "The night you two paired",
        detail: "The first spark of us — everything after grew from here.",
        glyph: "✧",
        date: me.paired_at,
        origin: "paired",
      });
    }

    // Anniversary star.
    if (me.anniversary_date) {
      derived.push({
        id: `anniv-${me.anniversary_date}`,
        title: "Anniversary",
        detail: "The date you promised to keep returning to.",
        glyph: "❤︎",
        date: me.anniversary_date,
        origin: "anniversary",
      });
    }

    // Memory-jar entries.
    const { data: mems } = await (supabase as any)
      .from("memory_jar")
      .select("id,title,note,happened_at,emoji,created_at,owner_id,partner_id")
      .order("happened_at", { ascending: false })
      .limit(60);
    for (const m of (mems ?? []) as any[]) {
      derived.push({
        id: `mem-${m.id}`,
        title: m.title ?? "A memory",
        detail: m.note ?? "",
        glyph: m.emoji ?? "✦",
        date: m.happened_at ?? m.created_at,
        origin: "memory",
      });
    }

    // Mood peaks for both partners (last 90 days, keep peaks).
    if (partner) {
      const since = new Date(Date.now() - 90 * 86400_000).toISOString();
      const { data: moods } = await (supabase as any)
        .from("mood_log")
        .select("id,user_id,mood,emoji,created_at,intensity")
        .in("user_id", [me.id, partner.id])
        .gt("created_at", since)
        .order("intensity", { ascending: false })
        .limit(12);
      for (const m of (moods ?? []) as any[]) {
        derived.push({
          id: `mood-${m.id}`,
          title: `A ${m.mood ?? "bright"} day`,
          detail: m.user_id === me.id ? "You felt it strongly." : "They felt it strongly.",
          glyph: m.emoji ?? "✦",
          date: m.created_at,
          origin: "mood",
        });
      }
    }

    // Custom notes.
    const { data: notes } = await (supabase as any)
      .from("constellation_notes")
      .select("*")
      .order("occurred_at", { ascending: false });
    for (const n of (notes ?? []) as any[]) {
      derived.push({
        id: `note-${n.id}`,
        title: n.title,
        detail: n.note ?? "",
        glyph: n.glyph ?? "✦",
        date: n.occurred_at,
        origin: "note",
      });
    }

    // De-dupe by id, sort by date desc.
    const map = new Map<string, Star>();
    for (const s of derived) map.set(s.id, s);
    setStars([...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, partner?.id]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("constellation-notes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "constellation_notes" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050716] via-[#0a0f2a] to-[#050716] relative overflow-hidden">
      <BackgroundStars />

      <div className="relative z-10 pt-10 px-5 pb-24">
        <header className="flex items-center gap-3 mb-6">
          <Link to="/app" className="text-white/60">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#c9a84c]">Night sky</p>
            <h1 className="font-serif text-2xl italic text-white">Constellation of Us</h1>
          </div>
          {partner && (
            <button
              onClick={() => setComposing(true)}
              className="size-10 rounded-2xl bg-[#c9a84c] text-[#050716] flex items-center justify-center"
              aria-label="Pin a star"
            >
              <Plus className="size-4" />
            </button>
          )}
        </header>

        {!partner ? (
          <div className="p-5 rounded-3xl border border-white/10 bg-white/5">
            <p className="text-sm text-white/80">
              Pair with your partner to build the sky together.{" "}
              <Link to="/app/invite" className="text-[#c9a84c] underline">
                Invite →
              </Link>
            </p>
          </div>
        ) : (
          <>
            <ConstellationCanvas stars={stars} onSelect={setSelected} />

            {stars.length === 0 && (
              <div className="mt-6 p-5 rounded-2xl border border-white/10 text-white/70 text-sm text-center">
                Your sky is dark. Every anniversary, memory, and moment you save adds a star.
              </div>
            )}

            <div className="mt-8 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2">Recent stars</p>
              {stars.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[#c9a84c]/50 transition-colors text-left"
                >
                  <span className="text-xl w-8 text-center">{s.glyph}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 truncate">{s.title}</p>
                    <p className="text-[10px] text-white/40">
                      {new Date(s.date).toLocaleDateString([], { dateStyle: "medium" })} ·{" "}
                      <span className="text-[#c9a84c]/70 uppercase tracking-widest">{s.origin}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && (
        <StarSheet star={selected} onClose={() => setSelected(null)} />
      )}

      {composing && me && partner && (
        <NoteComposer
          me={me.id}
          partnerId={partner.id}
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function BackgroundStars() {
  const seeds = useMemo(
    () => new Array(80).fill(0).map((_, i) => ({ i, x: Math.random() * 100, y: Math.random() * 100, o: 0.2 + Math.random() * 0.5, s: 0.5 + Math.random() * 1.5 })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none">
      {seeds.map((s) => (
        <span
          key={s.i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            opacity: s.o,
            filter: `blur(${s.s > 1.2 ? 0.5 : 0}px)`,
          }}
        />
      ))}
    </div>
  );
}

function ConstellationCanvas({ stars, onSelect }: { stars: Star[]; onSelect: (s: Star) => void }) {
  // Deterministic layout: chronological ribbon that zig-zags across the sky.
  const items = useMemo(() => {
    const asc = [...stars].sort((a, b) => (a.date < b.date ? -1 : 1));
    return asc.map((s, i) => {
      const t = asc.length <= 1 ? 0.5 : i / (asc.length - 1);
      const x = 10 + t * 80;
      const y = 20 + 50 * (0.5 + 0.5 * Math.sin(i * 1.7 + 0.3));
      return { s, x, y };
    });
  }, [stars]);

  return (
    <div className="relative w-full aspect-[4/5] rounded-3xl border border-white/10 bg-gradient-to-b from-[#0a0f2a] to-[#050716] overflow-hidden">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="linegrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#c96b7a" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {items.length > 1 &&
          items.slice(1).map((it, idx) => {
            const prev = items[idx];
            return (
              <line
                key={`l-${it.s.id}`}
                x1={prev.x}
                y1={prev.y}
                x2={it.x}
                y2={it.y}
                stroke="url(#linegrad)"
                strokeWidth="0.25"
                strokeDasharray="0.5 1"
              />
            );
          })}
      </svg>
      {items.map(({ s, x, y }) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className="absolute -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: `${x}%`, top: `${y}%` }}
          title={s.title}
        >
          <span
            className="block text-[13px] text-white drop-shadow-[0_0_10px_rgba(232,196,100,0.6)] group-hover:scale-125 transition-transform"
            style={{ textShadow: "0 0 12px rgba(232,196,100,0.7)" }}
          >
            {s.glyph}
          </span>
        </button>
      ))}
    </div>
  );
}

function StarSheet({ star, onClose }: { star: Star; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#0a0f2a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 animate-scale-in"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="size-14 rounded-2xl bg-white/5 border border-[#c9a84c]/30 flex items-center justify-center text-2xl">
            {star.glyph}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#c9a84c] mb-1">
              {star.origin === "paired"
                ? "The beginning"
                : star.origin === "anniversary"
                  ? "The promise"
                  : star.origin === "memory"
                    ? "Kept memory"
                    : star.origin === "mood"
                      ? "A feeling peak"
                      : "Pinned"}
            </p>
            <h2 className="font-serif italic text-2xl text-white leading-tight">{star.title}</h2>
            <p className="text-xs text-white/50 mt-1">{new Date(star.date).toLocaleDateString([], { dateStyle: "long" })}</p>
          </div>
          <button onClick={onClose} className="text-white/60">
            <X className="size-4" />
          </button>
        </div>
        {star.detail && (
          <p className="text-white/80 text-sm leading-relaxed font-serif italic">{star.detail}</p>
        )}
      </div>
    </div>
  );
}

function NoteComposer({
  me,
  partnerId,
  onClose,
  onSaved,
}: {
  me: string;
  partnerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [glyph, setGlyph] = useState("✦");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.error("Give this star a name.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("constellation_notes").insert({
      author_id: me,
      partner_id: partnerId,
      title: title.trim(),
      note: note.trim(),
      glyph,
      occurred_at: occurredAt,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Star pinned.");
    onSaved();
  }

  const GLYPHS = ["✦", "✧", "★", "❤︎", "🌙", "🕯️", "🌸", "🍷", "☕", "🎬"];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#0a0f2a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 animate-scale-in"
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-4 text-[#c9a84c]" />
          <p className="font-serif italic text-xl text-white">Pin a star</p>
          <button onClick={onClose} className="ml-auto text-white/60">
            <X className="size-4" />
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What happened?"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/40 mb-3"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="A line about it…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/40 mb-3 resize-none"
        />
        <input
          type="date"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white mb-3"
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {GLYPHS.map((g) => (
            <button
              key={g}
              onClick={() => setGlyph(g)}
              className={`size-9 rounded-xl text-lg flex items-center justify-center border ${glyph === g ? "border-[#c9a84c] bg-[#c9a84c]/15" : "border-white/10 bg-white/5"}`}
            >
              {g}
            </button>
          ))}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-[#c9a84c] text-[#050716] font-semibold disabled:opacity-60"
        >
          {saving ? "Pinning…" : "Pin to our sky"}
        </button>
      </div>
    </div>
  );
}
