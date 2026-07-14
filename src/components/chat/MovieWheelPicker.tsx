import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Film, Sparkles, Plus, Trash2, Disc3 } from "lucide-react";
import { toast } from "sonner";
import { tmdbSearch, type TmdbMovie } from "@/lib/tmdb.functions";
import { wheelAiSuggest, wheelTrending } from "@/lib/wheel.functions";
import { poster } from "@/routes/_authenticated/app.movies";

export type WheelEntry = {
  tmdb_id?: number;
  title: string;
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number;
  overview?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSend: (entries: WheelEntry[]) => Promise<void>;
};

export function MovieWheelPicker({ open, onClose, onSend }: Props) {
  const runSearch = useServerFn(tmdbSearch);
  const runAi = useServerFn(wheelAiSuggest);
  const runTrending = useServerFn(wheelTrending);

  const [entries, setEntries] = useState<WheelEntry[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TmdbMovie[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [vibe, setVibe] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      setQ("");
      setResults([]);
      setVibe("");
    } else {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      runSearch({ data: { q: term } })
        .then((r) => !cancelled && setResults(r.slice(0, 8)))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, runSearch]);

  function addEntry(m: WheelEntry) {
    setEntries((prev) => {
      if (prev.length >= 8) {
        toast.error("Wheel is full (max 8)");
        return prev;
      }
      if (m.tmdb_id && prev.some((e) => e.tmdb_id === m.tmdb_id)) return prev;
      return [...prev, m];
    });
    setQ("");
    setResults([]);
  }

  function removeAt(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function fillAi() {
    setAiBusy(true);
    try {
      const remaining = Math.max(4, 6 - entries.length);
      const picks = await runAi({ data: { vibe, count: remaining } });
      const merged: WheelEntry[] = [...entries];
      const seen = new Set(merged.map((e) => e.tmdb_id).filter(Boolean));
      for (const m of picks) {
        if (merged.length >= 8) break;
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        merged.push({
          tmdb_id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          release_date: m.release_date,
          vote_average: m.vote_average,
          overview: m.overview,
        });
      }
      setEntries(merged);
    } catch (e: any) {
      toast.error(e?.message ?? "AI picks failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function fillTrending() {
    setAiBusy(true);
    try {
      const remaining = Math.max(4, 6 - entries.length);
      const picks = await runTrending({ data: { count: remaining } });
      const merged: WheelEntry[] = [...entries];
      const seen = new Set(merged.map((e) => e.tmdb_id).filter(Boolean));
      for (const m of picks) {
        if (merged.length >= 8) break;
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        merged.push({
          tmdb_id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          release_date: m.release_date,
          vote_average: m.vote_average,
          overview: m.overview,
        });
      }
      setEntries(merged);
    } catch {
      toast.error("Couldn't load trending");
    } finally {
      setAiBusy(false);
    }
  }

  async function send() {
    if (entries.length < 2) {
      toast.error("Add at least 2 movies");
      return;
    }
    setSending(true);
    try {
      await onSend(entries);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-surface-elevated border border-border sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        <header className="flex items-center gap-3 p-4 border-b border-border">
          <div className="size-9 rounded-full bg-petal-soft flex items-center justify-center">
            <Disc3 className="size-4 text-petal" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-petal">Movie wheel</p>
            <h2 className="font-serif italic text-lg leading-tight">Spin for tonight's pick</h2>
          </div>
          <button onClick={onClose} className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted">
            <X className="size-4" />
          </button>
        </header>

        {/* Selected entries */}
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">On the wheel · {entries.length}/8</p>
            {entries.length > 0 && (
              <button onClick={() => setEntries([])} className="text-[11px] text-candle-muted hover:text-petal">
                Clear
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <div className="text-[11px] text-candle-muted italic border border-dashed border-border rounded-xl p-3 text-center">
              Add movies below or let AI spin one up ✨
            </div>
          ) : (
            <ul className="space-y-1">
              {entries.map((e, i) => {
                const p = poster(e.poster_path ?? null, "w185");
                return (
                  <li key={`${e.tmdb_id ?? e.title}-${i}`} className="flex items-center gap-2 p-1.5 rounded-xl bg-surface border border-border">
                    <div className="w-8 h-11 rounded-md overflow-hidden bg-velvet/40 shrink-0 flex items-center justify-center">
                      {p ? <img src={p} alt="" className="w-full h-full object-cover" /> : <Film className="size-3 text-candle-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-serif italic truncate text-candle">{e.title}</p>
                      {e.release_date && <p className="text-[10px] text-candle-muted">{e.release_date.slice(0, 4)}</p>}
                    </div>
                    <button onClick={() => removeAt(i)} className="size-7 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-candle-muted hover:text-petal">
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* AI + trending */}
        <div className="px-4 pt-3 space-y-2">
          <input
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="Vibe? e.g. rom-com date night, 90s classics…"
            className="w-full px-3 py-2 bg-surface border border-border rounded-full text-xs text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={aiBusy || entries.length >= 8}
              onClick={fillAi}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-gradient-to-br from-petal/30 to-petal-soft/40 border border-petal/40 text-xs font-medium text-candle disabled:opacity-50"
            >
              <Sparkles className="size-3.5 text-petal" />
              {aiBusy ? "Picking…" : "AI suggest"}
            </button>
            <button
              disabled={aiBusy || entries.length >= 8}
              onClick={fillTrending}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-surface border border-border text-xs text-candle disabled:opacity-50"
            >
              🔥 Trending
            </button>
          </div>
        </div>

        {/* Manual add */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-candle-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a movie to add…"
              className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-full text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {searching && <div className="text-center py-4 text-xs text-candle-muted">Searching…</div>}
          {!searching && q.trim() && results.length === 0 && (
            <div className="text-center py-4 text-xs text-candle-muted">No matches.</div>
          )}
          <ul className="space-y-1">
            {results.map((m) => {
              const year = m.release_date ? m.release_date.slice(0, 4) : "";
              const p = poster(m.poster_path, "w185");
              const already = entries.some((e) => e.tmdb_id === m.id);
              return (
                <li key={m.id}>
                  <button
                    disabled={already}
                    onClick={() =>
                      addEntry({
                        tmdb_id: m.id,
                        title: m.title,
                        poster_path: m.poster_path,
                        release_date: m.release_date,
                        vote_average: m.vote_average,
                        overview: m.overview,
                      })
                    }
                    className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-surface text-left disabled:opacity-40"
                  >
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface border border-border shrink-0 flex items-center justify-center">
                      {p ? <img src={p} alt="" className="w-full h-full object-cover" /> : <Film className="size-4 text-candle-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif italic text-sm truncate">{m.title}</p>
                      <p className="text-[11px] text-candle-muted">
                        {year}
                        {m.vote_average > 0 && <span className="ml-2 text-petal">★ {m.vote_average.toFixed(1)}</span>}
                      </p>
                    </div>
                    <Plus className="size-4 text-petal shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-3 border-t border-border">
          <button
            onClick={send}
            disabled={entries.length < 2 || sending}
            className="w-full py-3 rounded-full bg-petal text-velvet font-medium text-sm petal-glow disabled:opacity-40"
          >
            {sending ? "Sending…" : `Spin & send · ${entries.length} movie${entries.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
