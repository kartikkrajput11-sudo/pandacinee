import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil, parseYmd, ymd } from "@/lib/occasions";

/** Milestone options a couple can immortalise. Stored as important_dates.kind = `first:<key>`. */
export const FIRST_MILESTONES = [
  { key: "met", label: "The day we met", emoji: "✨", hint: "Where it all began" },
  { key: "talk", label: "Our first conversation", emoji: "💬", hint: "The first real talk" },
  { key: "date", label: "Our first date", emoji: "🌹", hint: "Nervous and glowing" },
  { key: "kiss", label: "Our first kiss", emoji: "💋", hint: "Time stopped" },
  { key: "official", label: "The day we made it official", emoji: "💞", hint: "Yes." },
  { key: "iloveyou", label: "First 'I love you'", emoji: "🕯️", hint: "Said out loud" },
  { key: "trip", label: "Our first trip", emoji: "✈️", hint: "Away together" },
  { key: "movie", label: "Our first movie night", emoji: "🎬", hint: "Screen glow, two hearts" },
] as const;

/** How-we-met flavours, offered when the milestone is `met`. */
export const MEET_STORIES = [
  "Online",
  "Through friends",
  "At school",
  "At work",
  "While travelling",
  "In a café",
  "At a party",
  "Pure coincidence",
] as const;

type Row = {
  id: string;
  owner_id: string;
  title: string;
  kind: string;
  emoji: string | null;
  note: string | null;
  date: string;
  yearly: boolean;
};

type Draft = {
  key: string;
  label: string;
  emoji: string;
  date: string;
  place: string;
  how: string;
  story: string;
};

function milestoneOf(kind: string) {
  const key = kind.startsWith("first:") ? kind.slice(6) : "";
  return FIRST_MILESTONES.find((m) => m.key === key) ?? null;
}

/** note payload: "place | how | story" — keeps everything in one text column. */
function encodeNote(place: string, how: string, story: string) {
  return [place.trim(), how.trim(), story.trim()].join(" | ");
}
function decodeNote(note: string | null) {
  const [place = "", how = "", ...rest] = (note ?? "").split(" | ");
  return { place, how, story: rest.join(" | ") };
}

export function FirstChapterCard({ ownerId, partnerName }: { ownerId: string; partnerName?: string | null }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["first-chapter", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("important_dates")
        .select("id, owner_id, title, kind, emoji, note, date, yearly")
        .like("kind", "first:%")
        .order("date");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const ordered = useMemo(() => {
    const rank = new Map<string, number>(FIRST_MILESTONES.map((m, i) => [m.key as string, i]));
    return [...rows].sort(
      (a, b) => (rank.get(a.kind.slice(6)) ?? 99) - (rank.get(b.kind.slice(6)) ?? 99),
    );
  }, [rows]);

  const taken = new Set(ordered.map((r) => r.kind.slice(6)));
  const available = FIRST_MILESTONES.filter((m) => !taken.has(m.key));

  async function save() {
    if (!draft) return;
    if (!draft.date) {
      toast.error("Pick the day it happened");
      return;
    }
    const payload = {
      owner_id: ownerId,
      kind: `first:${draft.key}`,
      title: draft.label,
      emoji: draft.emoji,
      date: draft.date,
      note: encodeNote(draft.place, draft.how, draft.story),
      yearly: true,
    };
    const existing = ordered.find((r) => r.kind === `first:${draft.key}` && r.owner_id === ownerId);
    const { error } = existing
      ? await supabase.from("important_dates").update(payload).eq("id", existing.id)
      : await supabase.from("important_dates").insert(payload);
    if (error) {
      toast.error("Couldn't save that memory");
      return;
    }
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["first-chapter", ownerId] });
    qc.invalidateQueries({ queryKey: ["important-dates", ownerId] });
    toast.success("Written into your first chapter");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("important_dates").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't remove that");
      return;
    }
    qc.invalidateQueries({ queryKey: ["first-chapter", ownerId] });
    qc.invalidateQueries({ queryKey: ["important-dates", ownerId] });
  }

  return (
    <section className="rounded-3xl border border-petal/30 bg-[linear-gradient(160deg,var(--petal-soft),transparent_65%)] p-5 backdrop-blur-xl shadow-[var(--shadow-velvet)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-petal">
            <Sparkles className="size-3" /> First chapter
          </p>
          <h2 className="font-serif text-2xl leading-tight">The day we met</h2>
          <p className="mt-1 text-xs text-candle-muted">
            {partnerName ? `Every first with ${partnerName}, kept forever.` : "Every first, kept forever."}
          </p>
        </div>
        {available.length > 0 && (
          <button
            onClick={() => setPicking(true)}
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full border border-petal/40 bg-petal/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-petal transition hover:bg-petal/20"
          >
            <Plus className="size-3.5" /> First
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-candle-muted">Opening the album…</p>
      ) : ordered.length === 0 ? (
        <button
          onClick={() => setPicking(true)}
          className="w-full rounded-2xl border border-dashed border-petal/40 bg-velvet/30 px-4 py-6 text-sm text-candle-muted transition hover:border-petal/70 hover:text-candle"
        >
          Add the day you met — then the firsts that followed.
        </button>
      ) : (
        <ol className="relative space-y-3 pl-5">
          <span aria-hidden className="absolute left-1.5 top-2 bottom-2 w-px bg-petal/30" />
          {ordered.map((r) => {
            const m = milestoneOf(r.kind);
            const d = parseYmd(r.date);
            const { place, how, story } = decodeNote(r.note);
            const yrs = Math.floor(daysUntil(new Date(), d) / -365.25);
            return (
              <li key={r.id} className="group relative">
                <span
                  aria-hidden
                  className="absolute -left-[1.05rem] top-3 size-2 rounded-full bg-petal shadow-[0_0_12px_var(--petal)]"
                />
                <div className="rounded-2xl border border-border/50 bg-velvet/40 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg leading-none">{r.emoji || m?.emoji || "✨"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-candle">{r.title}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-petal">
                        {d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                        {yrs >= 1 ? ` · ${yrs} yr${yrs > 1 ? "s" : ""} ago` : ""}
                      </p>
                      {(place || how) && (
                        <p className="mt-1 text-xs text-candle-muted">
                          {[how, place].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {story && <p className="mt-1 text-xs italic text-candle-muted">“{story}”</p>}
                    </div>
                    {r.owner_id === ownerId && (
                      <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          aria-label="Edit"
                          onClick={() =>
                            setDraft({
                              key: r.kind.slice(6),
                              label: r.title,
                              emoji: r.emoji || m?.emoji || "✨",
                              date: r.date,
                              place,
                              how,
                              story,
                            })
                          }
                        >
                          <Pencil className="size-3.5 text-candle-muted hover:text-petal" />
                        </button>
                        <button aria-label="Remove" onClick={() => remove(r.id)}>
                          <Trash2 className="size-3.5 text-candle-muted hover:text-petal" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {picking && (
        <Sheet title="Which first?" onClose={() => setPicking(false)}>
          <div className="grid gap-2">
            {available.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setPicking(false);
                  setDraft({
                    key: m.key,
                    label: m.label,
                    emoji: m.emoji,
                    date: ymd(new Date()),
                    place: "",
                    how: "",
                    story: "",
                  });
                }}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-velvet/40 px-4 py-3 text-left transition hover:border-petal/60"
              >
                <span className="text-lg">{m.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-candle">{m.label}</span>
                  <span className="block text-[11px] text-candle-muted">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {draft && (
        <Sheet title={draft.label} onClose={() => setDraft(null)}>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-candle-muted">The day</label>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="mb-3 w-full rounded-2xl border border-border/60 bg-velvet/50 px-4 py-3 text-sm outline-none focus:border-petal/60"
          />

          <label className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-candle-muted">The place</label>
          <input
            value={draft.place}
            onChange={(e) => setDraft({ ...draft, place: e.target.value })}
            placeholder="A rooftop, a chat window, a rainy street…"
            className="mb-3 w-full rounded-2xl border border-border/60 bg-velvet/50 px-4 py-3 text-sm outline-none focus:border-petal/60"
          />

          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-candle-muted">How it happened</label>
          <div className="mb-3 flex flex-wrap gap-2">
            {MEET_STORIES.map((s) => (
              <button
                key={s}
                onClick={() => setDraft({ ...draft, how: draft.how === s ? "" : s })}
                className={`rounded-full border px-3 py-1.5 text-[11px] tracking-wide transition ${
                  draft.how === s ? "border-petal bg-petal/15 text-petal" : "border-border/60 text-candle-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-candle-muted">The story</label>
          <textarea
            value={draft.story}
            onChange={(e) => setDraft({ ...draft, story: e.target.value })}
            rows={3}
            placeholder="What you remember most…"
            className="mb-4 w-full resize-none rounded-2xl border border-border/60 bg-velvet/50 px-4 py-3 text-sm outline-none focus:border-petal/60"
          />

          <button
            onClick={save}
            className="w-full rounded-full bg-petal py-3 text-sm font-medium text-velvet transition hover:opacity-90"
          >
            Keep this forever
          </button>
        </Sheet>
      )}
    </section>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-velvet/70 backdrop-blur-md" />
      <div className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border/60 bg-surface-elevated/95 p-5 backdrop-blur-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl">{title}</h3>
          <button onClick={onClose} aria-label="Close">
            <X className="size-4 text-candle-muted" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
