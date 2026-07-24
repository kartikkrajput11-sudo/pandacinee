import { useEffect, useMemo, useState } from "react";
import { X, Search, Clock, Sparkles } from "lucide-react";
import { PANDA_STICKERS, type PandaStickerId } from "@/lib/panda-stickers";

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

  useEffect(() => { if (open) setRecent(getRecent()); }, [open]);

  const recentStickers = useMemo(
    () => recent.map((id) => PANDA_STICKERS.find((s) => s.id === id)).filter(Boolean) as typeof PANDA_STICKERS,
    [recent]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return PANDA_STICKERS;
    return PANDA_STICKERS.filter((s) => s.label.toLowerCase().includes(term) || s.id.includes(term));
  }, [q]);

  if (!open) return null;

  function pick(id: PandaStickerId) {
    pushRecent(id);
    onPick(id);
    // stay open for rapid-fire sending
    setRecent(getRecent());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-velvet/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface border-t border-petal/30 rounded-t-3xl shadow-2xl animate-slide-in-right"
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

        <div className="px-3 pb-4 max-h-[60vh] overflow-y-auto">
          {recentStickers.length > 0 && !q && (
            <>
              <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-1.5 mt-1 flex items-center gap-1.5">
                <Clock className="size-3" /> Recent
              </p>
              <div className="grid grid-cols-6 gap-1.5 mb-3">
                {recentStickers.map((s) => (
                  <StickerBtn key={"r-" + s.id} sticker={s} onClick={() => pick(s.id)} />
                ))}
              </div>
              <div className="h-px bg-border/60 mb-3" />
            </>
          )}

          <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-1.5">
            {q ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}` : "All stickers"}
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {filtered.map((s) => (
              <StickerBtn key={s.id} sticker={s} onClick={() => pick(s.id)} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-candle-muted py-8">No stickers match "{q}"</p>
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
