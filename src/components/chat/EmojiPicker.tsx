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
    <div className="border-t border-border/60 bg-gradient-to-b from-surface/95 to-velvet/90 backdrop-blur-xl rounded-t-3xl shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.4)] overflow-hidden animate-fade-in">
      {/* Drag handle */}
      <div className="pt-2 pb-1 flex justify-center">
        <div className="h-1 w-10 rounded-full bg-candle-muted/30" />
      </div>

      <div className="flex items-center gap-2 px-3 pb-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-candle-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="w-full pl-9 pr-3 h-9 rounded-full bg-velvet/60 border border-border/70 text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60 focus:bg-velvet/80 transition-colors"
          />
        </div>
        <button
          onClick={onClose}
          className="size-9 rounded-full bg-velvet/60 border border-border/70 flex items-center justify-center text-candle-muted hover:text-candle hover:bg-velvet/80 transition-colors"
          aria-label="Close emoji picker"
        >
          <X className="size-4" />
        </button>
      </div>

      {!query && (
        <div className="sticky top-0 z-10 flex items-center gap-1 px-3 py-2 overflow-x-auto no-scrollbar border-b border-border/40 bg-surface/70 backdrop-blur">
          {recent.length > 0 && (
            <button
              onClick={() => setCat("smileys")}
              className="shrink-0 size-9 rounded-full flex items-center justify-center text-petal/80 hover:bg-petal-soft/60 transition-colors"
              aria-label="Recent"
              title="Recent"
            >
              <Clock className="size-4" />
            </button>
          )}
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`shrink-0 size-9 rounded-full flex items-center justify-center text-lg transition-all ${
                cat === c.id
                  ? "bg-petal-soft ring-1 ring-petal/50 scale-105"
                  : "opacity-60 hover:opacity-100 hover:bg-surface"
              }`}
              title={c.label}
              aria-label={c.label}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto px-3 py-2">
        {!query && recent.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-candle-muted/80 px-1 mb-1.5 flex items-center gap-1">
              <Clock className="size-3" /> Recent
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
                  className="text-2xl h-10 rounded-xl hover:bg-petal-soft/70 active:scale-90 transition-all"
                  aria-label={char}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}

        {query && list.length === 0 ? (
          <p className="text-center text-xs text-candle-muted py-8">No emojis match "{query}"</p>
        ) : (
          <>
            {!query && (
              <p className="text-[10px] uppercase tracking-[0.15em] text-candle-muted/80 px-1 mb-1.5">
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
                  className="text-2xl h-10 rounded-xl hover:bg-petal-soft/70 active:scale-90 transition-all"
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
      <p className="text-[10px] text-candle-muted/70 text-center py-2 border-t border-border/40">
        Tap to insert · long-press for sticker
      </p>
    </div>
  );
}
