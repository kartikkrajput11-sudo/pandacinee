import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Film, Sparkles, Plus, Disc3 } from "lucide-react";
import { toast } from "sonner";
import { tmdbSearch, type TmdbMovie } from "@/lib/tmdb.functions";
import { wheelAiSuggest } from "@/lib/wheel.functions";
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

  const [entries, setEntries] = useState<WheelEntry[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TmdbMovie[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      setQ("");
      setResults([]);
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
      const picks = await runAi({ data: { vibe: "", count: remaining } });
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
    <div
      className="fixed inset-0 z-50 bg-velvet/85 backdrop-blur-md flex items-end sm:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-sm studio-surface backdrop-blur-2xl sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[86vh] overflow-hidden shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.4)]"
      >
        {/* Champagne hairline */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petal/50 to-transparent" />
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-petal/10 blur-3xl" />

        {/* Handle + Header */}
        <div className="relative pt-2.5 pb-3">
          <div className="mx-auto h-[3px] w-9 rounded-full bg-candle/25 sm:hidden" />
          <div className="mt-2 flex flex-col items-center px-6">
            <div className="flex items-center gap-2 text-petal">
              <Disc3 className="size-3.5" />
              <p className="text-[9px] uppercase tracking-[0.32em] font-medium">Movie Wheel</p>
            </div>
            <h2 className="mt-1 font-serif italic text-lg text-candle">Tonight's pick</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 size-8 rounded-full bg-velvet/60 border border-white/[0.06] flex items-center justify-center text-candle-muted hover:text-candle transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Selection chips */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase tracking-[0.28em] text-candle-muted/70">
              On the wheel · {entries.length}/8
            </p>
            {entries.length > 0 && (
              <button
                onClick={() => setEntries([])}
                className="text-[10px] uppercase tracking-widest text-candle-muted/70 hover:text-petal transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <div className="text-[11px] text-candle-muted/70 italic text-center py-3">
              Add a few titles, or let the AI pick.
            </div>
          ) : (
            <ul className="flex flex-wrap gap-1.5 mb-1">
              {entries.map((e, i) => (
                <li
                  key={`${e.tmdb_id ?? e.title}-${i}`}
                  className="group flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-candle max-w-[160px]"
                >
                  <span className="truncate font-serif italic">{e.title}</span>
                  <button
                    onClick={() => removeAt(i)}
                    aria-label="Remove"
                    className="size-4 rounded-full flex items-center justify-center text-candle-muted hover:text-petal hover:bg-white/[0.06]"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AI single luxury action */}
        <div className="px-4 pt-3">
          <button
            disabled={aiBusy || entries.length >= 8}
            onClick={fillAi}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-gradient-to-r from-petal/25 via-petal/15 to-petal/25 border border-petal/40 text-xs tracking-[0.16em] uppercase text-candle disabled:opacity-40 hover:from-petal/40 hover:to-petal/40 transition-all shadow-[0_4px_16px_-8px_rgba(236,72,153,0.5)]"
          >
            <Sparkles className="size-3.5 text-petal" />
            {aiBusy ? "Curating…" : "AI curate"}
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="size-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-candle-muted/70" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a title…"
              className="w-full pl-9 pr-3 h-9 bg-velvet/70 border border-white/[0.06] rounded-full text-[13px] text-candle placeholder:text-candle-muted/60 focus:outline-none focus:border-petal/40 focus:bg-velvet/90 transition-all"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-1 no-scrollbar min-h-0">
          {searching && (
            <div className="text-center py-6 text-[11px] text-candle-muted/70 tracking-wide">Searching…</div>
          )}
          {!searching && q.trim() && results.length === 0 && (
            <div className="text-center py-6 text-[11px] text-candle-muted/70 tracking-wide">No matches.</div>
          )}
          <ul>
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
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] text-left disabled:opacity-40 transition-colors"
                  >
                    <div className="w-9 h-12 rounded-md overflow-hidden bg-velvet/60 border border-white/[0.06] shrink-0 flex items-center justify-center">
                      {p ? <img src={p} alt="" className="w-full h-full object-cover" /> : <Film className="size-3.5 text-candle-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif italic text-sm truncate text-candle">{m.title}</p>
                      <p className="text-[10px] text-candle-muted/80 tracking-wide">
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

        {/* Send */}
        <div className="relative px-4 pt-2 pb-3">
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          <button
            onClick={send}
            disabled={entries.length < 2 || sending}
            className="w-full py-3 rounded-full bg-petal text-velvet font-medium text-xs uppercase tracking-[0.2em] petal-glow disabled:opacity-40 transition-opacity"
          >
            {sending ? "Sending…" : `Spin · ${entries.length} title${entries.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
