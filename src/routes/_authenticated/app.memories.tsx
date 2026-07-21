import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Heart, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/memories")({
  component: Memories,
});

type Memory = {
  id: string;
  author_id: string;
  partner_id: string | null;
  title: string;
  body: string | null;
  mood: string | null;
  happened_on: string | null;
  created_at: string;
};

const MOOD_PRESETS = ["💜", "🌸", "🕯️", "✨", "🍷", "🌙", "🐼", "🌊", "☕"];

function Memories() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [items, setItems] = useState<Memory[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("💜");
  const [happened, setHappened] = useState(() => new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const { data: rows } = await (supabase as any)
      .from("memory_jar")
      .select("*")
      .order("happened_on", { ascending: false, nullsFirst: false });
    setItems((rows ?? []) as Memory[]);
  }
  useEffect(() => { if (me) load(); }, [me?.id]);

  useEffect(() => {
    const ch = supabase
      .channel("memory_jar")
      .on("postgres_changes", { event: "*", schema: "public", table: "memory_jar" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !me) return;
    const { error } = await (supabase as any).from("memory_jar").insert({
      author_id: me.id,
      partner_id: partner?.id ?? null,
      title: title.trim(),
      body: body.trim() || null,
      mood,
      happened_on: happened,
    });
    if (error) toast.error(error.message);
    else {
      setTitle("");
      setBody("");
      setOpen(false);
      toast.success("Memory sealed in the jar ✨");
    }
  }

  async function remove(m: Memory) {
    await (supabase as any).from("memory_jar").delete().eq("id", m.id);
    toast.success("Removed");
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (m) =>
        m.title.toLowerCase().includes(needle) ||
        (m.body ?? "").toLowerCase().includes(needle),
    );
  }, [items, q]);

  const grouped = filtered.reduce((acc, m) => {
    const key = (m.happened_on ?? m.created_at).slice(0, 7);
    (acc[key] = acc[key] || []).push(m);
    return acc;
  }, {} as Record<string, Memory[]>);

  return (
    <div className="pt-10 px-5 pb-24 relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px]"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 0%, hsl(var(--petal) / 0.18), transparent 70%)",
        }}
      />

      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-6">
        <Link
          to="/app"
          className="size-9 rounded-full grid place-items-center bg-surface/60 border border-border text-candle-muted hover:text-candle transition"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.35em] text-petal">Together</p>
          <h1 className="font-serif text-2xl italic truncate">Memory jar</h1>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="size-10 rounded-full bg-petal text-velvet grid place-items-center petal-glow"
          aria-label="Add memory"
        >
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
        </button>
      </header>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-2xl border border-border bg-surface/70 backdrop-blur px-3 py-3 text-center">
          <p className="font-serif text-2xl italic tabular-nums text-candle">{items.length}</p>
          <p className="text-[9px] uppercase tracking-[0.3em] text-candle-muted mt-0.5">Memories</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/70 backdrop-blur px-3 py-3 text-center">
          <p className="font-serif text-2xl italic tabular-nums text-candle">
            {Object.keys(grouped).length}
          </p>
          <p className="text-[9px] uppercase tracking-[0.3em] text-candle-muted mt-0.5">Months</p>
        </div>
      </div>

      {open && (
        <form
          onSubmit={add}
          className="p-5 rounded-3xl border border-petal/40 bg-gradient-to-br from-petal-soft to-transparent mb-5 space-y-3 animate-fade-in"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What happened?"
            className="w-full bg-velvet/60 border border-border rounded-xl px-3 py-2.5 text-candle text-sm placeholder:text-candle-muted focus:outline-none focus:border-petal/50"
            autoFocus
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tell the story…"
            rows={3}
            className="w-full bg-velvet/60 border border-border rounded-xl px-3 py-2.5 text-candle text-sm placeholder:text-candle-muted focus:outline-none focus:border-petal/50 resize-none"
          />
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted mb-2">Mood</p>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_PRESETS.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMood(m)}
                  className={`size-9 rounded-xl text-lg grid place-items-center border transition ${
                    mood === m
                      ? "bg-petal/20 border-petal/60 scale-110"
                      : "bg-velvet/50 border-border hover:border-petal/40"
                  }`}
                >
                  {m}
                </button>
              ))}
              <input
                value={mood}
                onChange={(e) => setMood(e.target.value.slice(0, 2))}
                placeholder="✎"
                className="size-9 bg-velvet/50 border border-border rounded-xl text-center text-base focus:outline-none focus:border-petal/50"
              />
            </div>
          </div>
          <input
            type="date"
            value={happened}
            onChange={(e) => setHappened(e.target.value)}
            className="w-full bg-velvet/60 border border-border rounded-xl px-3 py-2.5 text-candle text-sm focus:outline-none focus:border-petal/50"
          />
          <button
            type="submit"
            className="w-full py-3 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow"
          >
            Seal in the jar
          </button>
        </form>
      )}

      {items.length > 0 && (
        <div className="relative mb-5">
          <Search className="size-4 text-candle-muted absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search memories…"
            className="w-full bg-surface/70 backdrop-blur border border-border rounded-2xl pl-11 pr-4 py-2.5 text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/40"
          />
        </div>
      )}

      {!items.length ? (
        <div className="text-center mt-16 p-8 rounded-3xl border border-dashed border-border">
          <div className="mx-auto size-16 rounded-full grid place-items-center bg-petal-soft border border-petal/30 mb-3">
            <Heart className="size-6 text-petal fill-petal/20" />
          </div>
          <p className="font-serif text-xl italic mb-1">The jar is empty.</p>
          <p className="text-sm text-candle-muted">
            Drop your first memory — a laugh, a photo caption, a tiny detail.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-candle-muted text-center py-8 font-serif italic">
          Nothing matches "{q}".
        </p>
      ) : (
        Object.entries(grouped).map(([month, list]) => (
          <div key={month} className="mb-6">
            <div className="flex items-center gap-3 mb-3 px-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-petal font-medium">
                {new Date(month + "-01").toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <span className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-candle-muted tabular-nums">{list.length}</span>
            </div>
            <div className="space-y-2.5">
              {list.map((m) => (
                <article
                  key={m.id}
                  className="group relative p-4 rounded-2xl border border-border bg-surface/70 backdrop-blur hover:border-petal/40 transition overflow-hidden"
                >
                  <div
                    aria-hidden
                    className="absolute left-0 top-4 bottom-4 w-0.5 rounded-r bg-petal/50"
                  />
                  <div className="flex items-start gap-3 pl-2">
                    <span className="text-2xl leading-none pt-0.5">{m.mood ?? "💜"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif italic text-base leading-snug">{m.title}</p>
                      {m.body && (
                        <p className="text-sm text-candle-muted mt-1 whitespace-pre-wrap leading-relaxed">
                          {m.body}
                        </p>
                      )}
                      <p className="text-[10px] uppercase tracking-[0.2em] text-candle-muted mt-2 flex items-center gap-1.5">
                        <span>
                          {m.happened_on
                            ? new Date(m.happened_on).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            : ""}
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="text-petal">
                          {m.author_id === me?.id ? "you" : partner?.display_name ?? "partner"}
                        </span>
                      </p>
                    </div>
                    {m.author_id === me?.id && (
                      <button
                        onClick={() => remove(m)}
                        className="text-candle-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition p-1"
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
