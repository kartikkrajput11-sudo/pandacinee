import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Film } from "lucide-react";
import { tmdbMulti, type TmdbMovie } from "@/lib/tmdb.functions";

type PickItem = TmdbMovie & { media_type?: "movie" | "tv" };
import { poster } from "@/routes/_authenticated/app.movies";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (movie: TmdbMovie) => void;
};

export function WatchInvitePicker({ open, onClose, onPick }: Props) {
  const runSearch = useServerFn(tmdbSearch);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TmdbMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
    if (!open) {
      setQ("");
      setResults([]);
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
    setLoading(true);
    const t = setTimeout(() => {
      runSearch({ data: { q: term } })
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, runSearch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-surface-elevated border border-border sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        <header className="flex items-center gap-3 p-4 border-b border-border">
          <div className="size-9 rounded-full bg-petal-soft flex items-center justify-center">
            <Film className="size-4 text-petal" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-petal">Watch together</p>
            <h2 className="font-serif italic text-lg leading-tight">Send a movie invite</h2>
          </div>
          <button onClick={onClose} className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted">
            <X className="size-4" />
          </button>
        </header>

        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-candle-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a movie…"
              className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-full text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading && <div className="text-center py-8 text-xs text-candle-muted">Searching…</div>}
          {!loading && q.trim() && results.length === 0 && (
            <div className="text-center py-8 text-xs text-candle-muted">No movies found.</div>
          )}
          {!loading && !q.trim() && (
            <div className="text-center py-10 text-xs text-candle-muted">
              <p className="font-serif italic text-base text-candle mb-1">Pick a movie 🍿</p>
              <p>Search a title to send your partner a watch invite.</p>
            </div>
          )}
          <ul className="space-y-1">
            {results.map((m) => {
              const year = m.release_date ? m.release_date.slice(0, 4) : "";
              const p = poster(m.poster_path, "w185");
              return (
                <li key={m.id}>
                  <button
                    onClick={() => onPick(m)}
                    className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-surface text-left"
                  >
                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-surface border border-border shrink-0 flex items-center justify-center">
                      {p ? (
                        <img src={p} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Film className="size-4 text-candle-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif italic text-sm truncate">{m.title}</p>
                      <p className="text-[11px] text-candle-muted">
                        {year}
                        {m.vote_average > 0 && <span className="ml-2 text-petal">★ {m.vote_average.toFixed(1)}</span>}
                      </p>
                      {m.overview && <p className="text-[11px] text-candle-muted line-clamp-1 mt-0.5">{m.overview}</p>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
