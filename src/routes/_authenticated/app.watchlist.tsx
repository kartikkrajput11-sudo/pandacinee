import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Trash2, Search, Check, Film, Tv, Sparkles, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useServerFn } from "@tanstack/react-start";
import { tmdbMulti } from "@/lib/tmdb.functions";

export const Route = createFileRoute("/_authenticated/app/watchlist")({
  component: WatchlistPage,
});

type Item = {
  id: string;
  owner_id: string;
  partner_id: string | null;
  added_by: string;
  title: string;
  media_type: "movie" | "tv" | "custom";
  tmdb_id: number | null;
  poster_url: string | null;
  overview: string | null;
  note: string | null;
  watched: boolean;
  watched_at: string | null;
  created_at: string;
};

type Filter = "all" | "unwatched" | "watched";

function WatchlistPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    if (!me) return;
    const { data: rows, error } = await (supabase as any)
      .from("watchlist_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setItems((rows ?? []) as Item[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [me?.id]);

  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`watchlist:${me.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watchlist_items" },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [me?.id]);

  async function toggleWatched(it: Item) {
    const next = !it.watched;
    // optimistic
    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, watched: next, watched_at: next ? new Date().toISOString() : null } : x));
    const { error } = await (supabase as any)
      .from("watchlist_items")
      .update({ watched: next, watched_at: next ? new Date().toISOString() : null })
      .eq("id", it.id);
    if (error) {
      toast.error(error.message);
      load();
    } else if (next) {
      toast.success(`Marked "${it.title}" as watched 🎉`);
    }
  }

  async function remove(it: Item) {
    setItems((prev) => prev.filter((x) => x.id !== it.id));
    const { error } = await (supabase as any).from("watchlist_items").delete().eq("id", it.id);
    if (error) { toast.error(error.message); load(); }
  }

  const filtered = useMemo(() => {
    if (filter === "watched") return items.filter((i) => i.watched);
    if (filter === "unwatched") return items.filter((i) => !i.watched);
    return items;
  }, [items, filter]);

  const stats = useMemo(() => {
    const total = items.length;
    const watched = items.filter((i) => i.watched).length;
    return { total, watched, remaining: total - watched };
  }, [items]);

  return (
    <div className="pt-10 px-5 pb-28 min-h-screen">
      <header className="flex items-center gap-3 mb-5">
        <Link
          to="/app"
          className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted hover:text-petal"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.4em] text-petal">Together</p>
          <h1 className="font-serif italic text-2xl text-candle truncate">Our Watchlist</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow active:scale-95"
          aria-label="Add to watchlist"
        >
          <Plus className="size-5" />
        </button>
      </header>

      {/* Partner ribbon */}
      <div className="mb-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 flex items-center gap-3">
        <div className="size-9 rounded-full bg-petal/15 text-petal flex items-center justify-center overflow-hidden">
          {partner?.avatar_url ? (
            <img src={partner.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">
            {partner ? "Synced with" : "Solo mode"}
          </p>
          <p className="text-sm text-candle truncate">
            {partner ? (partner.display_name || partner.username) : "Pair up to share this list"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">Watched</p>
          <p className="text-sm text-candle tabular-nums">
            <span className="text-petal">{stats.watched}</span> / {stats.total}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "unwatched", "watched"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs capitalize transition-colors ${
              filter === f
                ? "bg-petal text-velvet"
                : "bg-white/[0.03] border border-white/10 text-candle-muted hover:text-candle"
            }`}
          >
            {f === "all" ? `All · ${stats.total}` : f === "unwatched" ? `To watch · ${stats.remaining}` : `Watched · ${stats.watched}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-candle-muted">
          <Loader2 className="size-5 mx-auto animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="size-16 mx-auto rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-3">
            <Film className="size-6 text-petal" />
          </div>
          <p className="font-serif italic text-lg text-candle">
            {filter === "watched" ? "Nothing watched yet" : "Your list is empty"}
          </p>
          <p className="text-candle-muted text-sm mt-1">
            Tap the + to add a movie or show you both want to watch.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => (
            <li
              key={it.id}
              className={`flex gap-3 p-3 rounded-2xl border transition-colors ${
                it.watched
                  ? "border-white/5 bg-white/[0.02] opacity-70"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <div className="w-14 h-20 rounded-lg overflow-hidden bg-velvet/60 shrink-0 flex items-center justify-center">
                {it.poster_url ? (
                  <img src={it.poster_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : it.media_type === "tv" ? (
                  <Tv className="size-5 text-candle-muted" />
                ) : (
                  <Film className="size-5 text-candle-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className={`font-medium text-candle truncate ${it.watched ? "line-through" : ""}`}>
                    {it.title}
                  </p>
                  <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/[0.06] text-candle-muted shrink-0">
                    {it.media_type === "tv" ? "TV" : it.media_type === "movie" ? "Film" : "Idea"}
                  </span>
                </div>
                {it.overview && (
                  <p className="text-xs text-candle-muted mt-1 line-clamp-2">{it.overview}</p>
                )}
                {it.note && (
                  <p className="text-xs text-petal/90 mt-1 italic">"{it.note}"</p>
                )}
                <p className="text-[10px] text-candle-muted/70 mt-1.5">
                  Added by {it.added_by === me?.id ? "you" : (partner?.display_name || partner?.username || "partner")}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => toggleWatched(it)}
                  aria-label={it.watched ? "Mark unwatched" : "Mark watched"}
                  className={`size-8 rounded-full flex items-center justify-center transition-colors ${
                    it.watched
                      ? "bg-petal text-velvet"
                      : "bg-white/[0.04] border border-white/10 text-candle-muted hover:text-petal"
                  }`}
                >
                  <Check className="size-4" />
                </button>
                <button
                  onClick={() => remove(it)}
                  aria-label="Remove"
                  className="size-8 rounded-full bg-white/[0.03] border border-white/10 text-candle-muted hover:text-red-400 flex items-center justify-center"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAdd && me && (
        <AddDialog
          onClose={() => setShowAdd(false)}
          meId={me.id}
          partnerId={partner?.id ?? null}
        />
      )}
    </div>
  );
}

function AddDialog({
  onClose,
  meId,
  partnerId,
}: {
  onClose: () => void;
  meId: string;
  partnerId: string | null;
}) {
  const search = useServerFn(tmdbMulti);
  const [tab, setTab] = useState<"search" | "manual">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualNote, setManualNote] = useState("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (tab !== "search") return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        const r = await search({ data: { q: q.trim() } });
        setResults(r);
      } catch (e: any) {
        toast.error(e?.message ?? "Search failed");
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, tab, search]);

  async function addFromResult(r: any) {
    const poster = r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null;
    const { error } = await (supabase as any).from("watchlist_items").insert({
      owner_id: meId,
      partner_id: partnerId,
      added_by: meId,
      title: r.title || r.name || "Untitled",
      media_type: r.media_type === "tv" ? "tv" : "movie",
      tmdb_id: r.id,
      poster_url: poster,
      overview: r.overview || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Added to your watchlist ✨");
      onClose();
    }
  }

  async function addManual() {
    const t = manualTitle.trim();
    if (!t) return toast.error("Add a title");
    const { error } = await (supabase as any).from("watchlist_items").insert({
      owner_id: meId,
      partner_id: partnerId,
      added_by: meId,
      title: t,
      media_type: "custom",
      note: manualNote.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Added ✨");
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-velvet/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto bg-surface border border-border shadow-2xl">
        <header className="flex items-center gap-3 mb-4">
          <h2 className="font-serif italic text-xl text-candle flex-1">Add to watchlist</h2>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-candle-muted"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("search")}
            className={`flex-1 py-2 rounded-full text-xs uppercase tracking-widest ${
              tab === "search" ? "bg-petal text-velvet" : "bg-white/[0.03] border border-white/10 text-candle-muted"
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 py-2 rounded-full text-xs uppercase tracking-widest ${
              tab === "manual" ? "bg-petal text-velvet" : "bg-white/[0.03] border border-white/10 text-candle-muted"
            }`}
          >
            Manual
          </button>
        </div>

        {tab === "search" ? (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-candle-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search movies & shows…"
                className="w-full bg-white/[0.03] border border-white/10 focus:border-petal/50 rounded-2xl pl-9 pr-3 py-3 text-sm text-candle placeholder:text-candle-muted/60 outline-none"
              />
            </div>
            {busy && (
              <div className="text-center py-6 text-candle-muted">
                <Loader2 className="size-5 mx-auto animate-spin" />
              </div>
            )}
            <ul className="space-y-2">
              {results.map((r) => {
                const poster = r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null;
                return (
                  <li key={`${r.media_type}-${r.id}`}>
                    <button
                      onClick={() => addFromResult(r)}
                      className="w-full flex gap-3 p-2 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-petal/40 hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <div className="w-10 h-14 rounded-md overflow-hidden bg-velvet/60 shrink-0 flex items-center justify-center">
                        {poster ? (
                          <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : r.media_type === "tv" ? (
                          <Tv className="size-4 text-candle-muted" />
                        ) : (
                          <Film className="size-4 text-candle-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-candle truncate">
                          {r.title || r.name}
                          <span className="text-[10px] uppercase tracking-widest text-candle-muted ml-2">
                            {r.media_type === "tv" ? "TV" : "Film"}
                          </span>
                        </p>
                        {r.overview && (
                          <p className="text-xs text-candle-muted mt-0.5 line-clamp-2">{r.overview}</p>
                        )}
                      </div>
                      <Plus className="size-4 text-petal self-center" />
                    </button>
                  </li>
                );
              })}
              {!busy && q.trim() && results.length === 0 && (
                <p className="text-center text-candle-muted text-sm py-4">No matches — try Manual.</p>
              )}
            </ul>
          </>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Title (movie, show, idea…)"
              className="w-full bg-white/[0.03] border border-white/10 focus:border-petal/50 rounded-2xl px-4 py-3 text-sm text-candle placeholder:text-candle-muted/60 outline-none"
            />
            <textarea
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="A little note for your partner (optional)"
              rows={3}
              className="w-full bg-white/[0.03] border border-white/10 focus:border-petal/50 rounded-2xl px-4 py-3 text-sm text-candle placeholder:text-candle-muted/60 outline-none resize-none"
            />
            <button
              onClick={addManual}
              className="w-full py-3 rounded-full bg-petal text-velvet text-sm uppercase tracking-widest font-medium"
            >
              Add to watchlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
