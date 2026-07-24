import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Clock, Sparkles, Lock } from "lucide-react";
import { PANDA_STICKERS, PANDA_CATEGORY_ORDER, isAdultUnlocked, unlockAdult, lockAdult, type PandaStickerId, type PandaStickerCategory } from "@/lib/panda-stickers";


type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (id: PandaStickerId) => void;
  onOpenAi?: () => void;
};

const RECENT_KEY = "panda_sticker_recent_v1";
const MAX_RECENT = 8;

function getRecent(): PandaStickerId[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}
function pushRecent(id: PandaStickerId) {
  try {
    const prev = getRecent().filter((x) => x !== id);
    const next = [id, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export function PandaStickerPicker({ open, onClose, onPick, onOpenAi }: Props) {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<PandaStickerId[]>([]);
  const [adultOk, setAdultOk] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (open) { setRecent(getRecent()); setAdultOk(isAdultUnlocked()); } }, [open]);

  const recentStickers = useMemo(
    () => recent
      .map((id) => PANDA_STICKERS.find((s) => s.id === id))
      .filter((s): s is (typeof PANDA_STICKERS)[number] => !!s && (s.category !== "adult" || adultOk)),
    [recent, adultOk]
  );

  const visibleStickers = useMemo(
    () => PANDA_STICKERS.filter((s) => s.category !== "adult" || adultOk),
    [adultOk]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return visibleStickers;
    return visibleStickers.filter((s) => s.label.toLowerCase().includes(term) || s.id.includes(term));
  }, [q, visibleStickers]);

  if (!open) return null;

  function pick(id: PandaStickerId) {
    pushRecent(id);
    onPick(id);
    setRecent(getRecent());
  }

  function scrollToSection(id: PandaStickerCategory | "recent") {
    const el = scrollRef.current?.querySelector(`[data-section="${id}"]`) as HTMLElement | null;
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - scrollRef.current.offsetTop - 4, behavior: "smooth" });
    }
  }


  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-center pointer-events-none animate-fade-in">
      <div
        className="pointer-events-auto w-[min(340px,92vw)] mb-20 mx-2 bg-surface border border-petal/30 rounded-2xl shadow-2xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >

        {/* drag handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <span className="h-1 w-10 rounded-full bg-candle/20" />
        </div>

        {/* header row: search + close + AI shortcut */}
        <div className="px-3 pb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-candle-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stickers…"
              className="w-full pl-8 pr-3 py-2 rounded-full bg-surface-elevated border border-border text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
              autoFocus
            />
          </div>
          {onOpenAi && (
            <button
              onClick={() => { onClose(); onOpenAi(); }}
              className="h-9 px-3 rounded-full bg-petal/15 border border-petal/40 text-petal text-xs font-medium flex items-center gap-1.5 hover:bg-petal/25 transition-colors shrink-0"
              aria-label="AI stickers"
            >
              <Sparkles className="size-3.5" /> AI
            </button>
          )}
          <button
            onClick={onClose}
            className="size-9 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-candle-muted hover:text-petal transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Category tabs (hidden while searching) */}
        {!q && (
          <div className="px-2 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
            {recentStickers.length > 0 && (
              <CatChip
                emoji="🕒"
                label="Recent"
                onClick={() => scrollToSection("recent")}
              />
            )}
            {PANDA_CATEGORY_ORDER.map((c) => (
              <CatChip
                key={c.id}
                emoji={c.emoji}
                label={c.label}
                onClick={() => scrollToSection(c.id)}
              />
            ))}
          </div>
        )}

        <div ref={scrollRef} className="px-3 pb-3 max-h-[45vh] overflow-y-auto">
          {recentStickers.length > 0 && !q && (
            <section data-section="recent" className="mb-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-1.5 flex items-center gap-1.5">
                <Clock className="size-3" /> Recent
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {recentStickers.map((s) => (
                  <StickerBtn key={"r-" + s.id} sticker={s} onClick={() => pick(s.id)} />
                ))}
              </div>
            </section>
          )}

          {q ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-1.5">
                {filtered.length} result{filtered.length === 1 ? "" : "s"}
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {filtered.map((s) => (
                  <StickerBtn key={s.id} sticker={s} onClick={() => pick(s.id)} />
                ))}
              </div>
              {filtered.length === 0 && (
                <p className="text-center text-sm text-candle-muted py-8">No stickers match "{q}"</p>
              )}
            </>
          ) : (
            PANDA_CATEGORY_ORDER.map((c) => {
              const items = PANDA_STICKERS.filter((s) => s.category === c.id);
              if (items.length === 0) return null;
              return (
                <section key={c.id} data-section={c.id} className="mb-3 last:mb-1">
                  <div className="flex items-center gap-2 mb-1.5 mt-0.5">
                    <span className="text-sm leading-none">{c.emoji}</span>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted">{c.label}</p>
                    <span className="flex-1 h-px bg-gradient-to-r from-petal/25 via-border/60 to-transparent" />
                    <span className="text-[9px] text-candle-muted/60">{items.length}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {items.map((s) => (
                      <StickerBtn key={s.id} sticker={s} onClick={() => pick(s.id)} />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

function StickerBtn({ sticker, onClick }: { sticker: { id: string; url: string; label: string }; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group aspect-square rounded-xl bg-surface-elevated border border-border hover:border-petal/60 hover:bg-petal/10 transition-all p-1 flex items-center justify-center active:scale-90"
      aria-label={sticker.label}
      title={sticker.label}
    >
      <img
        src={sticker.url}
        alt={sticker.label}
        loading="lazy"
        width={512}
        height={512}
        className="w-full h-full object-contain drop-shadow-sm group-hover:scale-110 transition-transform"
      />
    </button>
  );
}

function CatChip({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 h-7 px-2.5 rounded-full bg-surface-elevated border border-border hover:border-petal/50 hover:bg-petal/10 text-[11px] text-candle flex items-center gap-1 transition-colors"
    >
      <span className="text-sm leading-none">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

