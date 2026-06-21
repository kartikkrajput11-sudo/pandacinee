import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Gift, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/wishlist")({
  component: Wishlist,
});

type Item = {
  id: string;
  owner_id: string;
  partner_id: string | null;
  title: string;
  note: string | null;
  url: string | null;
  got_it: boolean;
  claimed_by: string | null;
  created_at: string;
};

function Wishlist() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!me) return;
    setLoading(true);
    const { data: rows } = await (supabase as any)
      .from("wishlist_items")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((rows ?? []) as Item[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [me?.id]);

  useEffect(() => {
    const ch = supabase
      .channel("wishlist")
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlist_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !me) return;
    const { error } = await (supabase as any).from("wishlist_items").insert({
      owner_id: me.id,
      partner_id: partner?.id ?? null,
      title: title.trim(),
      note: note.trim() || null,
      url: url.trim() || null,
    });
    if (error) toast.error(error.message);
    else { setTitle(""); setNote(""); setUrl(""); }
  }

  async function toggleGot(it: Item) {
    await (supabase as any).from("wishlist_items").update({ got_it: !it.got_it, claimed_by: !it.got_it ? me?.id : null }).eq("id", it.id);
  }
  async function remove(it: Item) {
    await (supabase as any).from("wishlist_items").delete().eq("id", it.id);
  }

  const mine = items.filter((i) => i.owner_id === me?.id);
  const theirs = items.filter((i) => i.owner_id !== me?.id);

  return (
    <div className="pt-10 px-5 pb-10">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Together</p>
          <h1 className="font-serif text-2xl italic">Wishlist</h1>
        </div>
      </header>

      <form onSubmit={add} className="p-4 rounded-3xl border border-border bg-surface mb-5 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="I'd love…" className="w-full bg-velvet border border-border rounded-xl px-3 py-2 text-candle text-sm" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full bg-velvet border border-border rounded-xl px-3 py-2 text-candle text-sm" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" className="w-full bg-velvet border border-border rounded-xl px-3 py-2 text-candle text-sm" />
        <button type="submit" className="w-full py-2.5 bg-petal text-velvet rounded-xl font-semibold flex items-center justify-center gap-2 text-sm">
          <Plus className="size-4" /> Add to my wishlist
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-candle-muted">Loading…</p>
      ) : (
        <>
          <Section title="Mine" items={mine} me={me?.id} onToggle={toggleGot} onRemove={remove} />
          {partner && <Section title={`${partner.display_name}'s wishes`} items={theirs} me={me?.id} onToggle={toggleGot} secret />}
          {!partner && <p className="text-xs text-candle-muted text-center mt-6">Pair with your partner to see theirs ❤︎</p>}
        </>
      )}
    </div>
  );
}

function Section({
  title, items, me, onToggle, onRemove, secret,
}: { title: string; items: Item[]; me?: string; onToggle: (i: Item) => void; onRemove?: (i: Item) => void; secret?: boolean }) {
  if (!items.length) return (
    <div className="mt-6">
      <h2 className="font-serif italic text-lg mb-2">{title}</h2>
      <p className="text-xs text-candle-muted">Nothing yet.</p>
    </div>
  );
  return (
    <div className="mt-6">
      <h2 className="font-serif italic text-lg mb-2">{title}</h2>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className={`p-3 rounded-2xl border border-border bg-surface ${it.got_it ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-2">
              <Gift className="size-4 text-petal mt-1" />
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${it.got_it ? "line-through" : ""}`}>{it.title}</p>
                {it.note && <p className="text-xs text-candle-muted">{it.note}</p>}
                {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-xs text-petal inline-flex items-center gap-1 mt-1"><ExternalLink className="size-3" /> Link</a>}
                {secret && it.claimed_by && it.claimed_by === me && <p className="text-[10px] text-petal mt-1">🤫 You've got this one</p>}
              </div>
              {secret ? (
                <button onClick={() => onToggle(it)} className="size-8 rounded-full bg-petal-soft text-petal flex items-center justify-center" title="I'll get this">
                  <Check className="size-4" />
                </button>
              ) : (
                onRemove && (
                  <button onClick={() => onRemove(it)} className="size-8 rounded-full text-candle-muted flex items-center justify-center">
                    <Trash2 className="size-4" />
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
