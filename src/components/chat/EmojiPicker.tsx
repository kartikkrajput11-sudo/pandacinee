import { useMemo, useState, useEffect } from "react";
import { Search, X, Clock } from "lucide-react";
import {
  EMOJI_CATEGORIES,
  EMOJIS,
  searchEmojis,
  loadRecentEmojis,
  pushRecentEmoji,
  type EmojiCategory,
} from "@/lib/emoji-data";

type Props = {
  open: boolean;
  onPick: (emoji: string, opts: { asSticker: boolean }) => void;
  onClose: () => void;
};

export function EmojiPicker({ open, onPick, onClose }: Props) {
  const [cat, setCat] = useState<EmojiCategory>("smileys");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (open) setRecent(loadRecentEmojis());
  }, [open]);

  const results = useMemo(() => (query ? searchEmojis(query, 300) : null), [query]);
  const list = results ?? EMOJIS[cat];

  function handlePick(char: string, asSticker: boolean) {
    pushRecentEmoji(char);
    onPick(char, { asSticker });
  }

  if (!open) return null;

  return (
    <div className="border-b border-border/60 bg-surface/60 backdrop-blur">
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-candle-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="w-full pl-9 pr-3 py-2 rounded-full bg-velvet/50 border border-border text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
          />
        </div>
        <button
          onClick={onClose}
          className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
          aria-label="Close emoji picker"
        >
          <X className="size-4" />
        </button>
      </div>

      {!query && (
        <div className="flex items-center gap-1 px-3 pt-2 pb-1 overflow-x-auto no-scrollbar">
          {recent.length > 0 && (
            <button
              onClick={() => setCat("smileys")}
              className="shrink-0 size-8 rounded-full flex items-center justify-center text-lg opacity-60"
              aria-label="Recent"
              title="Recent"
            >
              <Clock className="size-4 text-petal" />
            </button>
          )}
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`shrink-0 size-9 rounded-full flex items-center justify-center text-lg transition-all ${
                cat === c.id ? "bg-petal-soft ring-1 ring-petal/40" : "hover:bg-surface"
              }`}
              title={c.label}
              aria-label={c.label}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-56 overflow-y-auto px-2 py-2">
        {!query && recent.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted px-2 mb-1">
              Recent
            </p>
            <div className="grid grid-cols-8 gap-1">
              {recent.slice(0, 16).map((char) => (
                <button
                  key={`r-${char}`}
                  onClick={() => handlePick(char, false)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handlePick(char, true);
                  }}
                  className="text-2xl h-9 rounded-lg hover:bg-petal-soft/60 transition-colors"
                  aria-label={char}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}

        {query && list.length === 0 ? (
          <p className="text-center text-xs text-candle-muted py-6">No emojis match "{query}"</p>
        ) : (
          <>
            {!query && (
              <p className="text-[10px] uppercase tracking-widest text-candle-muted px-2 mb-1">
                {EMOJI_CATEGORIES.find((c) => c.id === cat)?.label}
              </p>
            )}
            <div className="grid grid-cols-8 gap-1">
              {list.map((e, i) => (
                <button
                  key={`${e.c}-${i}`}
                  onClick={() => handlePick(e.c, false)}
                  onContextMenu={(ev) => {
                    ev.preventDefault();
                    handlePick(e.c, true);
                  }}
                  className="text-2xl h-9 rounded-lg hover:bg-petal-soft/60 transition-colors"
                  aria-label={e.n}
                  title={e.n}
                >
                  {e.c}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="text-[10px] text-candle-muted text-center pb-2 opacity-70">
        Tap to insert · long-press for sticker
      </p>
    </div>
  );
}
