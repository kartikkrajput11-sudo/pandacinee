import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, MapPin, Check, Trash2, Camera, Star, Sparkles, X, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/bucket")({
  head: () => ({
    meta: [
      { title: "Bucket List · Pandacine" },
      { name: "description", content: "Dreams and adventures for the two of you to chase together." },
      { property: "og:title", content: "Bucket List · Pandacine" },
      { property: "og:description", content: "Dreams and adventures for the two of you to chase together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BucketPage,
});

type Item = {
  id: string;
  owner_id: string;
  partner_id: string | null;
  title: string;
  description: string | null;
  emoji: string | null;
  category: string | null;
  photo_url: string | null;
  target_date: string | null;
  priority: number;
  completed_at: string | null;
  completed_note: string | null;
  created_at: string;
};

const CATEGORIES = [
  { key: "travel",    label: "Travel",    emoji: "✈️" },
  { key: "adventure", label: "Adventure", emoji: "🏞️" },
  { key: "food",      label: "Food",      emoji: "🍜" },
  { key: "milestone", label: "Milestone", emoji: "💍" },
  { key: "cozy",      label: "Cozy",      emoji: "🕯️" },
  { key: "wild",      label: "Wild",      emoji: "🔥" },
  { key: "learn",     label: "Learn",     emoji: "📚" },
  { key: "other",     label: "Other",     emoji: "✨" },
];

const PRESETS = [
  { emoji: "🗼", title: "See the Eiffel Tower at night", category: "travel" },
  { emoji: "🌌", title: "Sleep under the stars", category: "adventure" },
  { emoji: "🍝", title: "Cook a full Italian dinner together", category: "food" },
  { emoji: "🏖️", title: "Watch a sunrise on a beach", category: "travel" },
  { emoji: "💃", title: "Learn one dance", category: "learn" },
  { emoji: "🎤", title: "Sing karaoke in public", category: "wild" },
  { emoji: "🚗", title: "Take a spontaneous road trip", category: "adventure" },
  { emoji: "🏡", title: "Buy a home together", category: "milestone" },
];

function BucketPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const [rows, setRows] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");
  const [category, setCategory] = useState<string>("all");
  const [composing, setComposing] = useState<Item | "new" | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!me) return;
    const { data: r } = await (supabase as any)
      .from("bucket_list_items")
      .select("*")
      .or(`owner_id.eq.${me.id},partner_id.eq.${me.id}`)
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    setRows((r ?? []) as Item[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`bucket-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bucket_list_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [me?.id]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "todo" && r.completed_at) return false;
      if (filter === "done" && !r.completed_at) return false;
      if (category !== "all" && r.category !== category) return false;
      return true;
    });
  }, [rows, filter, category]);

  const total = rows.length;
  const done = rows.filter((r) => r.completed_at).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function toggleDone(it: Item) {
    if (it.completed_at) {
      const { error } = await (supabase as any)
        .from("bucket_list_items")
        .update({ completed_at: null, completed_note: null })
        .eq("id", it.id);
      if (error) toast.error(error.message);
      return;
    }
    const note = window.prompt("A memory from this moment? (optional)") ?? "";
    const { error } = await (supabase as any)
      .from("bucket_list_items")
      .update({ completed_at: new Date().toISOString(), completed_note: note.slice(0, 400) || null })
      .eq("id", it.id);
    if (error) toast.error(error.message);
    else toast.success("Checked off ✨");
  }

  async function remove(it: Item) {
    if (!confirm("Remove this dream?")) return;
    const { error } = await (supabase as any).from("bucket_list_items").delete().eq("id", it.id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/app" className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle hover:text-petal transition-colors">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Chapter · Together</p>
            <h1 className="text-xl font-serif italic">Bucket List</h1>
          </div>
          <button
            onClick={() => setComposing("new")}
            className="h-9 px-4 rounded-full bg-petal text-white text-sm font-medium hover:bg-petal/90 transition-colors flex items-center gap-1.5"
          >
            <Plus className="size-4" /> New
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Progress hero */}
        <section className="relative overflow-hidden rounded-3xl border border-petal/30 bg-gradient-to-br from-petal/10 via-surface to-surface p-5 mb-5">
          <div className="flex items-center gap-5">
            <ProgressRing pct={pct} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Journey so far</p>
              <p className="text-2xl font-serif italic text-candle leading-tight">
                {done} of {total || 0} dreams lived
              </p>
              <p className="text-xs text-candle-muted mt-1">
                {partner ? `Chasing them with ${partner.display_name}` : "Add your first dream — bigger with someone."}
              </p>
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="flex gap-2 mb-3">
          {(["all", "todo", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 h-10 rounded-2xl border text-sm font-medium transition-colors ${filter === f ? "bg-petal/15 border-petal/50 text-candle" : "bg-surface border-border text-candle-muted"}`}
            >
              {f === "all" ? "All" : f === "todo" ? "To do" : "Lived"}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1 no-scrollbar">
          <CatChip active={category === "all"} onClick={() => setCategory("all")}>All</CatChip>
          {CATEGORIES.map((c) => (
            <CatChip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
              {c.emoji} {c.label}
            </CatChip>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-candle-muted text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-3xl bg-surface border border-border">
            <Sparkles className="size-8 text-petal mx-auto mb-3" />
            <p className="text-candle-muted text-sm">
              {rows.length === 0 ? "Nothing here yet — add your first dream." : "Nothing matches this filter."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((it) => (
              <ItemCard
                key={it.id}
                it={it}
                mine={it.owner_id === me?.id}
                onToggle={() => toggleDone(it)}
                onEdit={() => setComposing(it)}
                onRemove={() => remove(it)}
              />
            ))}
          </div>
        )}
      </main>

      {composing && me && (
        <ComposeSheet
          initial={composing === "new" ? null : composing}
          meId={me.id}
          partnerId={partner?.id ?? null}
          onClose={() => setComposing(null)}
        />
      )}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 80 80" className="size-20 -rotate-90">
        <circle cx="40" cy="40" r={r} strokeWidth="6" className="stroke-border" fill="none" />
        <circle
          cx="40" cy="40" r={r}
          strokeWidth="6" strokeLinecap="round" fill="none"
          className="stroke-petal transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c} strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-serif italic text-candle">
        {pct}%
      </div>
    </div>
  );
}

function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-8 px-3 rounded-full border text-xs whitespace-nowrap transition-colors ${active ? "bg-petal/15 border-petal/50 text-candle" : "bg-surface border-border text-candle-muted"}`}
    >
      {children}
    </button>
  );
}

function ItemCard({
  it, mine, onToggle, onEdit, onRemove,
}: { it: Item; mine: boolean; onToggle: () => void; onEdit: () => void; onRemove: () => void }) {
  const done = !!it.completed_at;
  const cat = CATEGORIES.find((c) => c.key === it.category);
  return (
    <div className={`relative rounded-3xl border overflow-hidden transition-all ${done ? "bg-surface/60 border-border/50" : "bg-gradient-to-br from-surface via-surface to-petal/5 border-border hover:border-petal/40"}`}>
      {it.photo_url && (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={it.photo_url} alt={it.title} className={`w-full h-full object-cover ${done ? "grayscale-[30%]" : ""}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggle}
            className={`size-11 shrink-0 rounded-2xl flex items-center justify-center text-2xl transition-all ${done ? "bg-petal/25 ring-2 ring-petal" : "bg-surface-elevated hover:bg-petal/10 border border-border"}`}
            title={done ? "Unmark" : "Mark lived"}
          >
            {done ? <Check className="size-5 text-petal" /> : (it.emoji || "✨")}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {cat && (
                <span className="text-[10px] uppercase tracking-[0.25em] text-candle-muted">
                  {cat.emoji} {cat.label}
                </span>
              )}
              {it.priority >= 3 && (
                <span className="text-[10px] uppercase tracking-[0.25em] text-petal flex items-center gap-0.5">
                  <Star className="size-3 fill-petal" /> Top
                </span>
              )}
            </div>
            <h3 className={`font-serif text-lg leading-snug mt-0.5 ${done ? "text-candle-muted line-through" : "text-candle"}`}>
              {it.title}
            </h3>
            {it.description && (
              <p className="text-sm text-candle-muted mt-1 leading-relaxed">{it.description}</p>
            )}
            {it.target_date && !done && (
              <p className="text-xs text-candle-muted mt-2 flex items-center gap-1">
                <Calendar className="size-3" /> By {new Date(it.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
            {done && it.completed_note && (
              <p className="text-xs text-petal italic mt-2">"{it.completed_note}"</p>
            )}
            {done && (
              <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mt-2">
                Lived · {new Date(it.completed_at!).toLocaleDateString()}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <button onClick={onEdit} className="text-xs text-candle-muted hover:text-petal">
                Edit
              </button>
              {mine && (
                <button onClick={onRemove} className="text-xs text-candle-muted hover:text-petal flex items-center gap-1">
                  <Trash2 className="size-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposeSheet({
  initial, meId, partnerId, onClose,
}: { initial: Item | null; meId: string; partnerId: string | null; onClose: () => void }) {
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "✨");
  const [category, setCategory] = useState(initial?.category ?? "travel");
  const [priority, setPriority] = useState(initial?.priority ?? 2);
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPhoto(f: File) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
    setUploading(true);
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${meId}/bucket-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, f, { upsert: false, contentType: f.type });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    setPhotoUrl(signed?.signedUrl ?? "");
    setUploading(false);
  }

  async function save() {
    const t = title.trim();
    if (!t) { toast.error("Give it a title"); return; }
    setBusy(true);
    const payload: any = {
      title: t.slice(0, 140),
      description: description.trim().slice(0, 800) || null,
      emoji: emoji || "✨",
      category,
      priority,
      target_date: targetDate || null,
      photo_url: photoUrl || null,
    };
    let error;
    if (editing && initial) {
      ({ error } = await (supabase as any).from("bucket_list_items").update(payload).eq("id", initial.id));
    } else {
      ({ error } = await (supabase as any).from("bucket_list_items").insert({
        ...payload,
        owner_id: meId,
        partner_id: partnerId,
      }));
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Updated" : "Added to your list ✨");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-petal/30 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted mb-1">{editing ? "Refine" : "A new dream"}</p>
            <h2 className="text-2xl font-serif italic">{editing ? "Edit your dream" : "Add to the list"}</h2>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-surface-elevated flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>

        {/* Photo */}
        <div className="mb-4">
          {photoUrl ? (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={photoUrl} alt="cover" className="w-full h-40 object-cover" />
              <button onClick={() => setPhotoUrl("")} className="absolute top-2 right-2 size-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-24 rounded-2xl border-2 border-dashed border-border hover:border-petal/50 flex items-center justify-center gap-2 text-candle-muted text-sm disabled:opacity-60"
            >
              <Camera className="size-4" />
              {uploading ? "Uploading…" : "Add a photo (optional)"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])} />
        </div>

        <div className="flex gap-3 mb-3">
          <div>
            <label className="text-xs text-candle-muted">Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
              className="w-16 text-center text-2xl mt-1 h-11 rounded-xl bg-surface-elevated border border-border"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-candle-muted">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="See the northern lights…"
              maxLength={140}
              className="w-full mt-1 h-11 px-4 rounded-xl bg-surface-elevated border border-border text-candle placeholder:text-candle-muted"
            />
          </div>
        </div>

        <label className="text-xs text-candle-muted">Why this one? (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A little note about the dream…"
          maxLength={800}
          rows={3}
          className="w-full mt-1 mb-3 p-3 rounded-xl bg-surface-elevated border border-border text-candle placeholder:text-candle-muted text-sm resize-none"
        />

        <label className="text-xs text-candle-muted">Category</label>
        <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`text-xs px-3 py-1.5 rounded-full border ${category === c.key ? "bg-petal/20 border-petal/60 text-candle" : "bg-surface-elevated border-border text-candle-muted"}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-candle-muted">Target date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full mt-1 h-11 px-3 rounded-xl bg-surface-elevated border border-border text-candle text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-candle-muted">Priority</label>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setPriority(n)}
                  className={`flex-1 h-11 rounded-xl border text-sm ${priority === n ? "bg-petal/20 border-petal/60 text-candle" : "bg-surface-elevated border-border text-candle-muted"}`}
                >
                  {n === 1 ? "Someday" : n === 2 ? "Soon" : "★ Top"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!editing && (
          <>
            <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-2 mt-1">Inspiration</p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {PRESETS.map((p) => (
                <button
                  key={p.title}
                  onClick={() => { setEmoji(p.emoji); setTitle(p.title); setCategory(p.category); }}
                  className="text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-petal/50 text-candle"
                >
                  {p.emoji} {p.title}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-full bg-surface-elevated border border-border text-candle">
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="flex-1 h-11 rounded-full bg-petal text-white font-medium disabled:opacity-60 flex items-center justify-center gap-1.5">
            <MapPin className="size-4" /> {busy ? "Saving…" : editing ? "Save" : "Add dream"}
          </button>
        </div>
      </div>
    </div>
  );
}
