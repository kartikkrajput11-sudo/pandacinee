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
    <div className="relative studio-surface backdrop-blur-2xl rounded-t-[28px] overflow-hidden animate-fade-in shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.35)]">
      {/* Champagne hairline */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petal/50 to-transparent" />
      {/* Ambient corner glow */}
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-petal/10 blur-3xl" />

      {/* Handle + title bar */}
      <div className="relative pt-2.5 pb-1 flex flex-col items-center">
        <div className="h-[3px] w-9 rounded-full bg-candle/25" />
        <p className="mt-1.5 text-[9px] uppercase tracking-[0.32em] text-candle-muted/80 font-medium">
          Reactions
        </p>
      </div>

      {/* Search */}
      <div className="relative flex items-center gap-2 px-4 pt-2 pb-3">
        <div className="flex-1 relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-candle-muted/70 group-focus-within:text-petal transition-colors" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full pl-9 pr-3 h-9 rounded-full bg-velvet/70 border border-white/[0.06] text-[13px] text-candle placeholder:text-candle-muted/60 focus:outline-none focus:border-petal/40 focus:bg-velvet/90 focus:shadow-[0_0_0_3px_rgba(236,72,153,0.08)] transition-all"
          />
        </div>
        <button
          onClick={onClose}
          className="size-9 rounded-full bg-velvet/70 border border-white/[0.06] flex items-center justify-center text-candle-muted/80 hover:text-candle hover:border-petal/30 transition-all"
          aria-label="Close emoji picker"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Category rail */}
      {!query && (
        <div className="relative">
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          <div className="flex items-center gap-1 px-3 py-2.5 overflow-x-auto no-scrollbar">
            {recent.length > 0 && (
              <button
                onClick={() => setCat("smileys")}
                className="shrink-0 size-9 rounded-full flex items-center justify-center text-petal/70 hover:text-petal transition-colors"
                aria-label="Recent"
                title="Recent"
              >
                <Clock className="size-4" />
              </button>
            )}
            {EMOJI_CATEGORIES.map((c) => {
              const active = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className="relative shrink-0 size-9 rounded-full flex items-center justify-center text-[17px] transition-all"
                  title={c.label}
                  aria-label={c.label}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-full bg-gradient-to-b from-petal/25 to-petal/5 ring-1 ring-petal/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
                  )}
                  <span
                    className={`relative transition-all ${
                      active
                        ? "scale-110 drop-shadow-[0_0_6px_rgba(236,72,153,0.5)]"
                        : "opacity-50 hover:opacity-90 hover:scale-105 grayscale hover:grayscale-0"
                    }`}
                  >
                    {c.icon}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>
      )}

      {/* Grid */}
      <div className="max-h-[280px] overflow-y-auto px-4 py-3 no-scrollbar">
        {!query && recent.length > 0 && (
          <div className="mb-4">
            <p className="text-[9px] uppercase tracking-[0.28em] text-candle-muted/70 mb-2 flex items-center gap-1.5">
              <span className="h-px flex-1 max-w-6 bg-gradient-to-r from-transparent to-white/10" />
              Recent
              <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </p>
            <div className="grid grid-cols-8 gap-1.5">
              {recent.slice(0, 16).map((char) => (
                <EmojiCell key={`r-${char}`} char={char} label={char} onPick={handlePick} />
              ))}
            </div>
          </div>
        )}

        {query && list.length === 0 ? (
          <p className="text-center text-xs text-candle-muted/70 py-10 tracking-wide">
            Nothing matches "{query}"
          </p>
        ) : (
          <>
            {!query && (
              <p className="text-[9px] uppercase tracking-[0.28em] text-candle-muted/70 mb-2 flex items-center gap-1.5">
                <span className="h-px flex-1 max-w-6 bg-gradient-to-r from-transparent to-white/10" />
                {EMOJI_CATEGORIES.find((c) => c.id === cat)?.label}
                <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </p>
            )}
            <div className="grid grid-cols-8 gap-1.5">
              {list.map((e, i) => (
                <EmojiCell
                  key={`${e.c}-${i}`}
                  char={e.c}
                  label={e.n}
                  onPick={handlePick}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="relative">
        <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        <p className="text-[9px] text-candle-muted/60 text-center py-2.5 tracking-[0.2em] uppercase">
          Tap to send · Hold for sticker
        </p>
      </div>
    </div>
  );
}

function EmojiCell({
  char,
  label,
  onPick,
}: {
  char: string;
  label: string;
  onPick: (c: string, asSticker: boolean) => void;
}) {
  return (
    <button
      onClick={() => onPick(char, false)}
      onContextMenu={(e) => {
        e.preventDefault();
        onPick(char, true);
      }}
      className="group relative aspect-square rounded-xl flex items-center justify-center text-[22px] transition-all duration-200 hover:bg-gradient-to-b hover:from-petal/20 hover:to-petal/5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_-2px_rgba(236,72,153,0.25)] active:scale-90"
      aria-label={label}
      title={label}
    >
      <span className="transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5">
        {char}
      </span>
    </button>
  );
}
