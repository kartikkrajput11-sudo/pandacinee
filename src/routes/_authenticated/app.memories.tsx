import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Heart } from "lucide-react";
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
    else { setTitle(""); setBody(""); setOpen(false); }
  }

  async function remove(m: Memory) {
    await (supabase as any).from("memory_jar").delete().eq("id", m.id);
  }

  const grouped = items.reduce((acc, m) => {
    const key = (m.happened_on ?? m.created_at).slice(0, 7);
    (acc[key] = acc[key] || []).push(m);
    return acc;
  }, {} as Record<string, Memory[]>);

  return (
    <div className="pt-10 px-5 pb-10">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Together</p>
          <h1 className="font-serif text-2xl italic">Memory jar</h1>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center">
          <Plus className={`size-4 transition-transform ${open ? "rotate-45" : ""}`} />
        </button>
      </header>

      {open && (
        <form onSubmit={add} className="p-4 rounded-3xl border border-petal/40 bg-petal-soft mb-5 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened?" className="w-full bg-velvet border border-border rounded-xl px-3 py-2 text-candle text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tell the story…" rows={3} className="w-full bg-velvet border border-border rounded-xl px-3 py-2 text-candle text-sm" />
          <div className="flex gap-2">
            <input value={mood} onChange={(e) => setMood(e.target.value.slice(0, 2))} className="w-14 bg-velvet border border-border rounded-xl px-3 py-2 text-center text-base" />
            <input type="date" value={happened} onChange={(e) => setHappened(e.target.value)} className="flex-1 bg-velvet border border-border rounded-xl px-3 py-2 text-candle text-sm" />
          </div>
          <button type="submit" className="w-full py-2.5 bg-petal text-velvet rounded-xl font-semibold text-sm">Save memory</button>
        </form>
      )}

      {!items.length ? (
        <div className="text-center mt-12">
          <Heart className="size-10 text-petal mx-auto mb-2" />
          <p className="text-sm text-candle-muted">Drop your first memory in the jar.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([month, list]) => (
          <div key={month} className="mb-5">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-2">
              {new Date(month + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
            <div className="space-y-2">
              {list.map((m) => (
                <div key={m.id} className="p-4 rounded-2xl border border-border bg-surface">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{m.mood ?? "💜"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif italic text-base">{m.title}</p>
                      {m.body && <p className="text-sm text-candle-muted mt-1 whitespace-pre-wrap">{m.body}</p>}
                      <p className="text-[10px] text-candle-muted mt-2">
                        {m.happened_on ? new Date(m.happened_on).toLocaleDateString() : ""}
                        {m.author_id === me?.id ? " · you" : ` · ${partner?.display_name ?? "partner"}`}
                      </p>
                    </div>
                    {m.author_id === me?.id && (
                      <button onClick={() => remove(m)} className="text-candle-muted">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
