import { useEffect, useState } from "react";
import { X, Plus, Trash2, Film, CalendarDays, Smile, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { newOptionId, type PollKind, type PollMeta, type PollOption } from "@/lib/poll";
import { toast } from "sonner";

const KIND_META: Record<PollKind, { label: string; icon: typeof Type }> = {
  text: { label: "Text", icon: Type },
  movie: { label: "Movie", icon: Film },
  date: { label: "Date", icon: CalendarDays },
  emoji: { label: "Emoji", icon: Smile },
};

type WatchlistRow = { id: string; title: string; poster_url: string | null; media_type: string };

export function PollComposer({
  open,
  onClose,
  onCreate,
  meId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (meta: PollMeta) => Promise<void> | void;
  meId: string | null;
}) {
  const [kind, setKind] = useState<PollKind>("text");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<PollOption[]>([
    { id: newOptionId(), label: "" },
    { id: newOptionId(), label: "" },
  ]);
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind("text");
    setQuestion("");
    setOptions([
      { id: newOptionId(), label: "" },
      { id: newOptionId(), label: "" },
    ]);
  }, [open]);

  useEffect(() => {
    if (!open || kind !== "movie" || !meId) return;
    void supabase
      .from("watchlist_items")
      .select("id,title,poster_url,media_type")
      .eq("owner_id", meId)
      .eq("watched", false)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setWatchlist((data ?? []) as WatchlistRow[]));
  }, [open, kind, meId]);

  if (!open) return null;

  function addOption() {
    setOptions((o) => (o.length >= 6 ? o : [...o, { id: newOptionId(), label: "" }]));
  }
  function removeOption(id: string) {
    setOptions((o) => (o.length <= 2 ? o : o.filter((x) => x.id !== id)));
  }
  function setLabel(id: string, label: string) {
    setOptions((o) => o.map((x) => (x.id === id ? { ...x, label } : x)));
  }

  function pickMovie(w: WatchlistRow) {
    setOptions((o) => {
      if (o.some((x) => x.meta?.watchlist_id === w.id)) return o;
      const opt: PollOption = {
        id: newOptionId(),
        label: w.title,
        meta: { watchlist_id: w.id, poster_url: w.poster_url, media_type: w.media_type },
      };
      // Fill an empty slot first
      const emptyIdx = o.findIndex((x) => !x.label.trim());
      if (emptyIdx >= 0) return o.map((x, i) => (i === emptyIdx ? opt : x));
      if (o.length >= 6) return o;
      return [...o, opt];
    });
  }

  async function submit() {
    const q = question.trim();
    if (!q) { toast.error("Add a question"); return; }
    const opts = options.map((o) => ({ ...o, label: o.label.trim() })).filter((o) => o.label);
    if (opts.length < 2) { toast.error("Need at least 2 options"); return; }
    setSubmitting(true);
    try {
      await onCreate({ question: q, kind, options: opts, multi: false });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't create poll";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="font-serif italic text-lg">New poll</p>
          <button onClick={onClose} className="text-candle-muted"><X className="size-5" /></button>
        </div>

        {/* Kind picker */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {(Object.keys(KIND_META) as PollKind[]).map((k) => {
            const M = KIND_META[k];
            const active = kind === k;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] transition ${
                  active ? "bg-primary/10 border-primary/50 text-foreground" : "bg-background/50 border-border text-muted-foreground"
                }`}

              >
                <M.icon className="size-4" />
                {M.label}
              </button>
            );
          })}
        </div>

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={kind === "date" ? "When should we…?" : kind === "movie" ? "What are we watching?" : "Ask the circle…"}
          maxLength={140}
          className="w-full bg-velvet border border-border rounded-xl px-3 py-2.5 text-sm text-candle mb-3"
        />

        {/* Options */}
        <div className="space-y-2 mb-3">
          {options.map((o, i) => {
            const posterUrl = (o.meta?.poster_url as string | null) ?? null;
            return (
              <div key={o.id} className="flex items-center gap-2">
                <span className="text-[10px] text-candle-muted w-4">{i + 1}</span>
                {posterUrl && <img src={posterUrl} alt="" className="size-8 rounded object-cover" />}
                {kind === "date" ? (
                  <input
                    type="date"
                    value={(o.meta?.date as string | undefined) ?? ""}
                    onChange={(e) => {
                      const d = e.target.value;
                      setOptions((os) =>
                        os.map((x) =>
                          x.id === o.id
                            ? { ...x, label: d ? new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "", meta: { date: d } }
                            : x,
                        ),
                      );
                    }}
                    className="flex-1 bg-velvet border border-border rounded-lg px-3 py-2 text-sm text-candle"
                  />
                ) : kind === "emoji" ? (
                  <input
                    value={o.label}
                    onChange={(e) => setLabel(o.id, e.target.value.slice(0, 4))}
                    placeholder="🐼"
                    className="flex-1 bg-velvet border border-border rounded-lg px-3 py-2 text-2xl text-candle text-center"
                  />
                ) : (
                  <input
                    value={o.label}
                    onChange={(e) => setLabel(o.id, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={80}
                    className="flex-1 bg-velvet border border-border rounded-lg px-3 py-2 text-sm text-candle"
                  />
                )}
                {options.length > 2 && (
                  <button onClick={() => removeOption(o.id)} className="text-candle-muted p-1">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
          {options.length < 6 && (
            <button
              onClick={addOption}
              className="w-full py-2 rounded-lg border border-dashed border-border text-xs text-candle-muted flex items-center justify-center gap-1"
            >
              <Plus className="size-3.5" /> Add option
            </button>
          )}
        </div>

        {/* Watchlist picker for movie polls */}
        {kind === "movie" && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-1.5">From your watchlist</p>
            {watchlist.length === 0 ? (
              <p className="text-xs text-candle-muted italic">Nothing on your watchlist yet.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {watchlist.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => pickMovie(w)}
                    className="shrink-0 w-20 text-left"
                  >
                    <div className="w-20 h-28 rounded-lg overflow-hidden bg-velvet border border-border">
                      {w.poster_url ? (
                        <img src={w.poster_url} alt={w.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-candle-muted">?</div>
                      )}
                    </div>
                    <p className="text-[10px] mt-1 line-clamp-2 text-candle-muted">{w.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-2.5 rounded-xl bg-petal text-velvet font-medium text-sm disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Post poll"}
        </button>
      </div>
    </div>
  );
}
