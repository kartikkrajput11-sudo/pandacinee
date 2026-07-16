import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Trash2, Search, Check, Film, Tv, Sparkles, X, Loader2, Star,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useServerFn } from "@tanstack/react-start";
import { tmdbMulti } from "@/lib/tmdb.functions";
import { AvatarImg } from "@/components/AvatarImg";

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

  const pct = stats.total ? Math.round((stats.watched / stats.total) * 100) : 0;
  const heroPoster = items.find((i) => !i.watched && i.poster_url)?.poster_url
    ?? items.find((i) => i.poster_url)?.poster_url
    ?? null;

  return (
    <div className="relative pt-10 px-5 pb-28 min-h-screen overflow-hidden">
      {/* Ambient luxe backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-[420px] opacity-70">
        {heroPoster && (
          <img src={heroPoster} alt="" className="w-full h-full object-cover blur-3xl scale-125 opacity-30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-velvet/60 to-velvet" />
      </div>
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.22),transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute top-40 -left-20 size-64 rounded-full bg-[radial-gradient(circle,rgba(201,107,122,0.18),transparent_70%)]" />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 mb-6">
        <Link
          to="/app"
          className="size-10 rounded-full glass border border-white/10 flex items-center justify-center text-candle-muted hover:text-petal transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.45em] text-[#c9a84c]">Signature</p>
          <h1 className="font-serif italic text-3xl text-candle leading-tight truncate">Our Watchlist</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="size-11 rounded-full bg-gradient-to-br from-[#f0d78c] via-petal to-[#c9a84c] text-velvet flex items-center justify-center petal-glow shadow-[0_10px_30px_-8px_rgba(201,168,76,0.6)] active:scale-95 transition-transform"
          aria-label="Add to watchlist"
        >
          <Plus className="size-5" />
        </button>
      </header>

      {/* Luxe hero card */}
      <div className="relative z-10 mb-5 rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent backdrop-blur-xl">
        <div aria-hidden className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(135deg,#c9a84c_0%,transparent_40%,#c96b7a_100%)]" />
        <div className="absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/60 to-transparent" />
        <div className="relative p-5 flex items-center gap-4">
          {/* Progress ring */}
          <div className="relative shrink-0">
            <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
              <circle cx="36" cy="36" r="30" stroke="currentColor" strokeWidth="3" className="text-white/10" fill="none" />
              <circle
                cx="36" cy="36" r="30" fill="none" strokeWidth="3" strokeLinecap="round"
                stroke="url(#gold)"
                strokeDasharray={2 * Math.PI * 30}
                strokeDashoffset={2 * Math.PI * 30 * (1 - pct / 100)}
                style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)" }}
              />
              <defs>
                <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f0d78c" />
                  <stop offset="50%" stopColor="#c9a84c" />
                  <stop offset="100%" stopColor="#c96b7a" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-serif italic text-lg text-candle leading-none">{pct}<span className="text-[10px] not-italic">%</span></span>
              <span className="text-[8px] uppercase tracking-[0.25em] text-candle-muted mt-0.5">seen</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#c9a84c]/90 flex items-center gap-1.5">
              <Star className="size-2.5 fill-current" /> {partner ? "Synced with" : "Solo mode"}
            </p>
            <p className="font-serif italic text-lg text-candle truncate mt-0.5">
              {partner ? (partner.display_name || partner.username) : "Pair up to share"}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-candle-muted">
              <span><span className="text-candle tabular-nums">{stats.remaining}</span> to watch</span>
              <span className="size-1 rounded-full bg-white/20" />
              <span><span className="text-candle tabular-nums">{stats.watched}</span> watched</span>
            </div>
          </div>

          {partner?.avatar_url && (
            <div className="size-12 rounded-full overflow-hidden border border-[#c9a84c]/40 shrink-0 shadow-[0_6px_20px_-6px_rgba(201,168,76,0.5)]">
              <AvatarImg src={partner.avatar_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="relative z-10 flex gap-2 mb-5">
        {(["all", "unwatched", "watched"] as Filter[]).map((f) => {
          const active = filter === f;
          const label = f === "all" ? `All · ${stats.total}` : f === "unwatched" ? `To watch · ${stats.remaining}` : `Watched · ${stats.watched}`;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] tracking-wide transition-all ${
                active
                  ? "bg-gradient-to-r from-[#f0d78c] via-petal to-[#c9a84c] text-velvet shadow-[0_6px_20px_-8px_rgba(201,168,76,0.7)]"
                  : "bg-white/[0.04] border border-white/10 text-candle-muted hover:text-candle hover:border-[#c9a84c]/30"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 text-candle-muted">
          <Loader2 className="size-5 mx-auto animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative z-10 text-center py-16">
          <div className="size-20 mx-auto rounded-full bg-gradient-to-br from-white/[0.06] to-transparent border border-[#c9a84c]/25 flex items-center justify-center mb-4 shadow-[0_10px_40px_-10px_rgba(201,168,76,0.3)]">
            <Film className="size-7 text-[#c9a84c]" />
          </div>
          <p className="font-serif italic text-xl text-candle">
            {filter === "watched" ? "Nothing watched yet" : "Your reel awaits"}
          </p>
          <p className="text-candle-muted text-sm mt-1.5 max-w-[260px] mx-auto">
            Tap the golden + to add a film or show you both want to share.
          </p>
        </div>
      ) : (
        <ul className="relative z-10 space-y-3">
          {filtered.map((it) => (
            <li
              key={it.id}
              className={`group relative flex gap-3 p-3 rounded-2xl border overflow-hidden transition-all ${
                it.watched
                  ? "border-white/5 bg-white/[0.02] opacity-75"
                  : "border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] hover:border-[#c9a84c]/30 hover:-translate-y-0.5"
              }`}
            >
              {/* left gold spine */}
              {!it.watched && (
                <div aria-hidden className="absolute left-0 top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-[#c9a84c]/60 to-transparent" />
              )}
              <div className="w-16 h-24 rounded-lg overflow-hidden bg-velvet/60 shrink-0 flex items-center justify-center ring-1 ring-white/10 shadow-lg">
                {it.poster_url ? (
                  <img src={it.poster_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : it.media_type === "tv" ? (
                  <Tv className="size-5 text-candle-muted" />
                ) : (
                  <Film className="size-5 text-candle-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0 py-0.5">
                <div className="flex items-start gap-2">
                  <p className={`font-serif italic text-[15px] text-candle truncate leading-snug ${it.watched ? "line-through decoration-[#c9a84c]/60" : ""}`}>
                    {it.title}
                  </p>
                </div>
                <span className="inline-block text-[9px] uppercase tracking-[0.28em] px-1.5 py-0.5 rounded bg-[#c9a84c]/10 text-[#c9a84c] mt-1">
                  {it.media_type === "tv" ? "Series" : it.media_type === "movie" ? "Film" : "Idea"}
                </span>
                {it.overview && (
                  <p className="text-xs text-candle-muted mt-1.5 line-clamp-2">{it.overview}</p>
                )}
                {it.note && (
                  <p className="text-xs text-petal/90 mt-1.5 italic">"{it.note}"</p>
                )}
                <p className="text-[10px] text-candle-muted/70 mt-1.5">
                  Added by {it.added_by === me?.id ? "you" : (partner?.display_name || partner?.username || "partner")}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0 self-center">
                <button
                  onClick={() => toggleWatched(it)}
                  aria-label={it.watched ? "Mark unwatched" : "Mark watched"}
                  className={`size-9 rounded-full flex items-center justify-center transition-all ${
                    it.watched
                      ? "bg-gradient-to-br from-[#f0d78c] to-[#c9a84c] text-velvet shadow-[0_6px_16px_-6px_rgba(201,168,76,0.7)]"
                      : "bg-white/[0.04] border border-white/10 text-candle-muted hover:text-[#c9a84c] hover:border-[#c9a84c]/40"
                  }`}
                >
                  <Check className="size-4" />
                </button>
                <button
                  onClick={() => remove(it)}
                  aria-label="Remove"
                  className="size-9 rounded-full bg-white/[0.03] border border-white/10 text-candle-muted hover:text-red-400 hover:border-red-400/30 flex items-center justify-center transition-colors"
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
      <div className="absolute inset-0 bg-velvet/85 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto bg-gradient-to-b from-surface via-surface to-velvet/80 border border-[#c9a84c]/25 shadow-[0_-20px_60px_-20px_rgba(201,168,76,0.35)]">
        <div aria-hidden className="absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/70 to-transparent" />
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <header className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <p className="text-[9px] uppercase tracking-[0.4em] text-[#c9a84c]">Add to reel</p>
            <h2 className="font-serif italic text-2xl text-candle">A new pick</h2>
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-candle-muted hover:text-candle"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex gap-2 mb-4 p-1 rounded-full bg-white/[0.03] border border-white/10">
          {(["search", "manual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-full text-[10px] uppercase tracking-[0.28em] transition-all ${
                tab === t
                  ? "bg-gradient-to-r from-[#f0d78c] via-petal to-[#c9a84c] text-velvet shadow-[0_6px_16px_-6px_rgba(201,168,76,0.6)]"
                  : "text-candle-muted hover:text-candle"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "search" ? (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#c9a84c]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search films & series…"
                className="w-full bg-white/[0.04] border border-white/10 focus:border-[#c9a84c]/50 rounded-2xl pl-10 pr-3 py-3 text-sm text-candle placeholder:text-candle-muted/60 outline-none transition-colors"
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
                      className="w-full flex gap-3 p-2.5 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-[#c9a84c]/40 hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <div className="w-11 h-16 rounded-md overflow-hidden bg-velvet/60 shrink-0 flex items-center justify-center ring-1 ring-white/10">
                        {poster ? (
                          <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : r.media_type === "tv" ? (
                          <Tv className="size-4 text-candle-muted" />
                        ) : (
                          <Film className="size-4 text-candle-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif italic text-[15px] text-candle truncate">
                          {r.title || r.name}
                        </p>
                        <span className="inline-block text-[9px] uppercase tracking-[0.28em] text-[#c9a84c] mt-0.5">
                          {r.media_type === "tv" ? "Series" : "Film"}
                        </span>
                        {r.overview && (
                          <p className="text-xs text-candle-muted mt-1 line-clamp-2">{r.overview}</p>
                        )}
                      </div>
                      <Plus className="size-4 text-[#c9a84c] self-center shrink-0" />
                    </button>
                  </li>
                );
              })}
              {!busy && q.trim() && results.length === 0 && (
                <p className="text-center text-candle-muted text-sm py-4 italic">No matches — try Manual.</p>
              )}
            </ul>
          </>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Title (film, show, idea…)"
              className="w-full bg-white/[0.04] border border-white/10 focus:border-[#c9a84c]/50 rounded-2xl px-4 py-3 text-sm text-candle placeholder:text-candle-muted/60 outline-none transition-colors"
            />
            <textarea
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="A little note for your partner (optional)"
              rows={3}
              className="w-full bg-white/[0.04] border border-white/10 focus:border-[#c9a84c]/50 rounded-2xl px-4 py-3 text-sm text-candle placeholder:text-candle-muted/60 outline-none resize-none transition-colors"
            />
            <button
              onClick={addManual}
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#f0d78c] via-petal to-[#c9a84c] text-velvet text-xs uppercase tracking-[0.32em] font-medium shadow-[0_10px_30px_-10px_rgba(201,168,76,0.7)] active:scale-[0.98] transition-transform"
            >
              Add to watchlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
