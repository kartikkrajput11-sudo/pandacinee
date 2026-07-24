import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookHeart, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AvatarImg } from "@/components/AvatarImg";

export const Route = createFileRoute("/_authenticated/app/journal")({
  head: () => ({
    meta: [
      { title: "Our Journal · Pandacine" },
      { name: "description", content: "A shared timeline of thoughts, moods, and memories with your partner." },
      { property: "og:title", content: "Our Journal · Pandacine" },
      { property: "og:description", content: "A shared timeline of thoughts, moods, and memories with your partner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JournalPage,
});

type Entry = {
  id: string;
  partner_a: string;
  partner_b: string;
  author_id: string;
  title: string | null;
  body: string;
  photo_url: string | null;
  mood: string | null;
  created_at: string;
};

const MOODS = ["🥰", "😊", "🌤️", "😌", "🌙", "🥲", "🔥", "🌧️", "✨"];

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function JournalPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [rows, setRows] = useState<Entry[]>([]);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pa, pb] = useMemo(() => (me && partner ? pair(me.id, partner.id) : ["", ""]), [me?.id, partner?.id]);

  async function load() {
    if (!pa || !pb) return;
    const { data: r, error } = await (supabase as any)
      .from("relationship_journal_entries")
      .select("*")
      .eq("partner_a", pa)
      .eq("partner_b", pb)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((r ?? []) as Entry[]);
  }

  useEffect(() => { load(); }, [pa, pb]);

  useEffect(() => {
    if (!pa || !pb) return;
    const ch = supabase
      .channel(`journal-${pa}-${pb}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationship_journal_entries", filter: `partner_a=eq.${pa}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pa, pb]);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !me) return;
    setUploading(true);
    const path = `journal/${me.id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, f, { upsert: false, contentType: f.type });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    setPhotoUrl(signed?.signedUrl ?? null);
    setUploading(false);
  }

  function resetCompose() {
    setTitle(""); setBody(""); setMood(""); setPhotoUrl(null); setComposing(false);
  }

  async function post() {
    if (!me || !partner) return;
    const b = body.trim();
    if (!b) { toast.error("Say something first"); return; }
    setBusy(true);
    const { error } = await (supabase as any).from("relationship_journal_entries").insert({
      partner_a: pa,
      partner_b: pb,
      author_id: me.id,
      title: title.trim().slice(0, 120) || null,
      body: b.slice(0, 4000),
      photo_url: photoUrl,
      mood: mood || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Added to your journal");
    resetCompose();
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    const { error } = await (supabase as any).from("relationship_journal_entries").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const r of rows) {
      const d = new Date(r.created_at);
      const key = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/app" className="p-2 -ml-2 rounded-full hover:bg-muted transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-serif text-xl flex items-center gap-2">
              <BookHeart className="w-5 h-5 text-primary" />
              Our Journal
            </h1>
            <p className="text-xs text-muted-foreground">
              {partner ? `Shared with ${partner.display_name}` : "Pair with someone to share entries"}
            </p>
          </div>
          <button
            onClick={() => setComposing(true)}
            disabled={!partner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Entry
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {!partner && (
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-6 text-center">
            <p className="text-muted-foreground">The Journal is a place for two. Pair with your partner from Settings to start writing together.</p>
          </div>
        )}

        {rows.length === 0 && partner && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 backdrop-blur p-10 text-center">
            <div className="text-4xl mb-3">📖</div>
            <p className="font-serif text-lg mb-1">A blank page, together.</p>
            <p className="text-sm text-muted-foreground">Write the first entry — a memory, a mood, a small thought.</p>
          </div>
        )}

        {grouped.map(([month, entries]) => (
          <section key={month} className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground pl-1">{month}</h2>
            <ul className="space-y-4">
              {entries.map((e) => {
                const isMine = e.author_id === me?.id;
                const author = isMine ? me : partner;
                return (
                  <li
                    key={e.id}
                    className="group rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 pt-4">
                      <AvatarImg src={author?.avatar_url ?? null} name={author?.display_name ?? "?"} className="w-8 h-8 rounded-full" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{author?.display_name ?? "…"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(e.created_at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                      {e.mood && <span className="text-2xl leading-none">{e.mood}</span>}
                      {isMine && (
                        <button onClick={() => remove(e.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-muted transition" aria-label="Delete">
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    {e.title && <div className="px-4 pt-3 font-serif text-lg leading-snug">{e.title}</div>}
                    {e.body && <p className="px-4 pt-2 pb-4 text-sm whitespace-pre-wrap leading-relaxed">{e.body}</p>}
                    {e.photo_url && (
                      <a href={e.photo_url} target="_blank" rel="noreferrer" className="block border-t border-border/40">
                        <img src={e.photo_url} alt="" className="w-full max-h-[520px] object-cover" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>

      {composing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-md p-3">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border/70 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div className="font-serif text-lg">New entry</div>
              <button onClick={resetCompose} className="p-1.5 rounded-full hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                maxLength={120}
                className="w-full bg-transparent border-b border-border/60 pb-2 font-serif text-lg outline-none focus:border-primary"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write what's on your mind…"
                rows={6}
                maxLength={4000}
                className="w-full bg-muted/40 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1">Mood:</span>
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(mood === m ? "" : m)}
                    className={`w-9 h-9 rounded-full text-lg transition ${mood === m ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {photoUrl && (
                <div className="relative rounded-xl overflow-hidden border border-border/60">
                  <img src={photoUrl} alt="" className="w-full max-h-64 object-cover" />
                  <button
                    onClick={() => setPhotoUrl(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur hover:bg-background"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 text-sm hover:bg-muted disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4" />
                {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Add photo"}
              </button>
            </div>
            <div className="px-4 py-3 border-t border-border/60 flex justify-end gap-2">
              <button onClick={resetCompose} className="px-4 py-2 rounded-full text-sm hover:bg-muted">Cancel</button>
              <button
                onClick={post}
                disabled={busy || !body.trim()}
                className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {busy ? "Posting…" : "Post entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
