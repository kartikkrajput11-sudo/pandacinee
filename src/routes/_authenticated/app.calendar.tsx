import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  OCCASIONS,
  occasionDay,
  daysUntil,
  nextAnnual,
  ordinal,
  parseYmd,
  ymd,
  type OccasionTone,
} from "@/lib/occasions";

export const Route = createFileRoute("/_authenticated/app/calendar")({
  head: () => ({
    meta: [
      { title: "The Calendar · Pandacine" },
      { name: "description", content: "Valentine's week, girlfriend and boyfriend day, birthdays and your anniversary — every date that matters, in one gilded calendar." },
      { property: "og:title", content: "The Calendar · Pandacine" },
      { property: "og:description", content: "Every date that matters to the two of you, in one gilded calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

type Mark = {
  id: string;
  date: Date;
  label: string;
  emoji: string;
  blurb?: string;
  tone: OccasionTone | "partner";
  /** Rows the viewer owns can be removed. */
  removableId?: string;
};

type ImportantDate = {
  id: string;
  owner_id: string;
  title: string;
  kind: string;
  emoji: string | null;
  note: string | null;
  date: string;
  yearly: boolean;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

const TONE_DOT: Record<Mark["tone"], string> = {
  partner: "bg-petal",
  love: "bg-rose-300",
  friend: "bg-sky-300",
  festive: "bg-amber-300",
};

function CalendarPage() {
  const qc = useQueryClient();
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [adding, setAdding] = useState(false);

  const { data: saved = [] } = useQuery({
    queryKey: ["important-dates", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("important_dates")
        .select("id, owner_id, title, kind, emoji, note, date, yearly")
        .order("date");
      if (error) throw error;
      return (rows ?? []) as ImportantDate[];
    },
  });

  const year = cursor.getFullYear();

  const marks = useMemo(() => {
    const list: Mark[] = [];

    for (const o of OCCASIONS) {
      for (const y of [year - 1, year, year + 1]) {
        list.push({
          id: `${o.key}-${y}`,
          date: new Date(y, o.month - 1, occasionDay(o, y)),
          label: o.label,
          emoji: o.emoji,
          blurb: o.blurb,
          tone: o.tone,
        });
      }
    }

    // Anniversary — yearly, plus the monthiversary in the viewed month.
    if (me?.anniversary_date && partner) {
      const start = parseYmd(me.anniversary_date);
      for (const y of [year - 1, year, year + 1]) {
        const d = new Date(y, start.getMonth(), start.getDate());
        const years = y - start.getFullYear();
        if (years <= 0) continue;
        list.push({
          id: `anniv-${y}`,
          date: d,
          label: `${ordinal(years)} anniversary`,
          emoji: "💞",
          blurb: `${years} year${years > 1 ? "s" : ""} with ${partner.display_name}.`,
          tone: "partner",
        });
      }
      const monthly = new Date(year, cursor.getMonth(), start.getDate());
      if (monthly.getMonth() === cursor.getMonth() && monthly > start) {
        const months =
          (monthly.getFullYear() - start.getFullYear()) * 12 + (monthly.getMonth() - start.getMonth());
        if (months > 0 && monthly.getDate() !== start.getDate() + 0 ? true : true) {
          if (monthly.getMonth() !== start.getMonth() || monthly.getFullYear() !== start.getFullYear()) {
            list.push({
              id: `monthiv-${ymd(monthly)}`,
              date: monthly,
              label: `${months} month${months > 1 ? "s" : ""} together`,
              emoji: "🌙",
              blurb: "Monthiversary — the app dresses up for it.",
              tone: "partner",
            });
          }
        }
      }
    }

    const birthdays: Array<{ who: string; value: string | null | undefined; mine: boolean }> = [
      { who: partner?.display_name ?? "Partner", value: (partner as { birthday?: string | null } | null)?.birthday, mine: false },
      { who: "You", value: (me as { birthday?: string | null } | null)?.birthday, mine: true },
    ];
    for (const b of birthdays) {
      if (!b.value) continue;
      const d = parseYmd(b.value);
      for (const y of [year - 1, year, year + 1]) {
        list.push({
          id: `bday-${b.who}-${y}`,
          date: new Date(y, d.getMonth(), d.getDate()),
          label: b.mine ? "Your birthday" : `${b.who}'s birthday`,
          emoji: "🎂",
          blurb: b.mine ? "Expect to be spoiled." : "Plan something they'll remember.",
          tone: b.mine ? "festive" : "partner",
        });
      }
    }

    for (const row of saved) {
      const d = parseYmd(row.date);
      const years = row.yearly ? [year - 1, year, year + 1] : [d.getFullYear()];
      for (const y of years) {
        list.push({
          id: `${row.id}-${y}`,
          date: new Date(y, d.getMonth(), d.getDate()),
          label: row.title,
          emoji: row.emoji || (row.kind === "birthday" ? "🎂" : "✨"),
          blurb: row.note ?? (row.owner_id === me?.id ? undefined : `Saved by ${partner?.display_name ?? "your partner"}`),
          tone: row.kind === "birthday" ? "friend" : row.owner_id === me?.id ? "love" : "partner",
          removableId: row.owner_id === me?.id ? row.id : undefined,
        });
      }
    }

    return list;
  }, [year, cursor, me, partner, saved]);

  const byDay = useMemo(() => {
    const map = new Map<string, Mark[]>();
    for (const m of marks) {
      const key = ymd(m.date);
      const arr = map.get(key);
      if (arr) arr.push(m);
      else map.set(key, [m]);
    }
    return map;
  }, [marks]);

  const upcoming = useMemo(
    () =>
      marks
        .filter((m) => daysUntil(m.date, today) >= 0 && daysUntil(m.date, today) <= 120)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 6),
    [marks, today],
  );

  const grid = useMemo(() => {
    const first = new Date(year, cursor.getMonth(), 1);
    const lead = first.getDay();
    const days = new Date(year, cursor.getMonth() + 1, 0).getDate();
    const cells: Array<Date | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) cells.push(new Date(year, cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, cursor]);

  const selectedMarks = byDay.get(ymd(selected)) ?? [];

  async function removeDate(id: string) {
    const { error } = await supabase.from("important_dates").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't remove that date");
      return;
    }
    qc.invalidateQueries({ queryKey: ["important-dates", me?.id] });
    toast.success("Removed");
  }

  return (
    <div className="min-h-dvh bg-velvet text-candle">
      {/* Ambient bloom */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[46vh] opacity-70"
        style={{ background: "var(--gradient-velvet)" }}
      />

      <div className="relative mx-auto w-full max-w-5xl px-4 pb-24 pt-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              to="/app"
              className="mt-1 grid size-9 place-items-center rounded-full border border-border/60 bg-surface-elevated/60 backdrop-blur transition hover:border-petal/50"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-[0.36em] text-candle-muted">Pandacine</p>
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl">The Calendar</h1>
            </div>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="mt-1 flex items-center gap-1.5 rounded-full border border-petal/40 bg-petal/10 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.2em] text-petal transition hover:bg-petal/20"
          >
            <Plus className="size-3.5" /> Date
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Month */}
          <section className="rounded-3xl border border-border/60 bg-surface-elevated/40 p-5 backdrop-blur-xl shadow-[var(--shadow-velvet)]">
            <div className="mb-5 flex items-center justify-between">
              <button
                onClick={() => setCursor(new Date(year, cursor.getMonth() - 1, 1))}
                className="grid size-8 place-items-center rounded-full border border-border/50 transition hover:border-petal/50"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => {
                  setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelected(today);
                }}
                className="text-center"
              >
                <span className="block font-serif text-xl">{MONTHS[cursor.getMonth()]}</span>
                <span className="block text-[10px] uppercase tracking-[0.3em] text-candle-muted">{year}</span>
              </button>
              <button
                onClick={() => setCursor(new Date(year, cursor.getMonth() + 1, 1))}
                className="grid size-8 place-items-center rounded-full border border-border/50 transition hover:border-petal/50"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 text-center text-[10px] uppercase tracking-[0.2em] text-candle-muted">
              {WEEK.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) => {
                if (!d) return <span key={i} />;
                const key = ymd(d);
                const dayMarks = byDay.get(key) ?? [];
                const isToday = key === ymd(today);
                const isSelected = key === ymd(selected);
                const hasPartner = dayMarks.some((m) => m.tone === "partner");
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(d)}
                    className={`relative aspect-square rounded-2xl border text-sm transition ${
                      isSelected
                        ? "border-petal bg-petal/20 text-candle"
                        : hasPartner
                          ? "border-petal/45 bg-petal/10 text-candle shadow-[0_0_20px_-8px_var(--petal)]"
                          : dayMarks.length
                            ? "border-border/60 bg-surface-elevated/60"
                            : "border-transparent hover:border-border/60"
                    }`}
                  >
                    <span className={`${isToday ? "font-semibold text-petal" : ""}`}>{d.getDate()}</span>
                    {isToday && !isSelected && (
                      <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-px w-4 bg-petal" />
                    )}
                    {dayMarks.length > 0 && (
                      <span className="absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-0.5">
                        {dayMarks.slice(0, 3).map((m) => (
                          <span key={m.id} className={`size-1 rounded-full ${TONE_DOT[m.tone]}`} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border/40 pt-4 text-[10px] uppercase tracking-[0.18em] text-candle-muted">
              <Legend dot="bg-petal" label={partner ? partner.display_name : "Partner"} />
              <Legend dot="bg-rose-300" label="Love" />
              <Legend dot="bg-sky-300" label="Friends" />
              <Legend dot="bg-amber-300" label="Festive" />
            </div>
          </section>

          {/* Detail + upcoming */}
          <div className="space-y-6">
            <section className="rounded-3xl border border-border/60 bg-surface-elevated/40 p-5 backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">
                {selected.toLocaleDateString(undefined, { weekday: "long" })}
              </p>
              <h2 className="font-serif text-2xl">
                {MONTHS[selected.getMonth()]} {selected.getDate()}
              </h2>
              <div className="mt-4 space-y-3">
                {selectedMarks.length === 0 && (
                  <p className="text-sm text-candle-muted">A quiet day. Perfect for making one up.</p>
                )}
                {selectedMarks.map((m) => (
                  <div
                    key={m.id}
                    className={`group flex items-start gap-3 rounded-2xl border p-3 ${
                      m.tone === "partner" ? "border-petal/45 bg-petal/10" : "border-border/50 bg-velvet/40"
                    }`}
                  >
                    <span className="text-lg leading-none">{m.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${m.tone === "partner" ? "text-petal" : "text-candle"}`}>{m.label}</p>
                      {m.blurb && <p className="mt-0.5 text-xs text-candle-muted">{m.blurb}</p>}
                    </div>
                    {m.removableId && (
                      <button
                        onClick={() => removeDate(m.removableId!)}
                        className="opacity-0 transition group-hover:opacity-100"
                        aria-label="Remove date"
                      >
                        <Trash2 className="size-3.5 text-candle-muted hover:text-petal" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-border/60 bg-surface-elevated/40 p-5 backdrop-blur-xl">
              <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-candle-muted">On the horizon</p>
              <ul className="space-y-2.5">
                {upcoming.map((m) => {
                  const n = daysUntil(m.date, today);
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => {
                          setCursor(new Date(m.date.getFullYear(), m.date.getMonth(), 1));
                          setSelected(m.date);
                        }}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className="text-base">{m.emoji}</span>
                        <span className={`flex-1 truncate text-sm ${m.tone === "partner" ? "text-petal" : "text-candle"}`}>
                          {m.label}
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-candle-muted">
                          {n === 0 ? "Today" : n === 1 ? "Tomorrow" : `${n}d`}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {upcoming.length === 0 && <li className="text-sm text-candle-muted">Nothing for a while.</li>}
              </ul>
            </section>
          </div>
        </div>
      </div>

      {adding && me && (
        <AddDateSheet
          defaultDate={ymd(selected)}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            qc.invalidateQueries({ queryKey: ["important-dates", me.id] });
          }}
          ownerId={me.id}
        />
      )}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${dot}`} />
      <span className="truncate max-w-[8rem]">{label}</span>
    </span>
  );
}

function AddDateSheet({
  ownerId,
  defaultDate,
  onClose,
  onSaved,
}: {
  ownerId: string;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [kind, setKind] = useState("birthday");
  const [emoji, setEmoji] = useState("🎂");
  const [saving, setSaving] = useState(false);

  const KINDS = [
    { key: "birthday", label: "Birthday", emoji: "🎂" },
    { key: "anniversary", label: "Anniversary", emoji: "💞" },
    { key: "trip", label: "Trip", emoji: "✈️" },
    { key: "custom", label: "Other", emoji: "✨" },
  ];

  async function save() {
    if (!title.trim()) {
      toast.error("Give the date a name");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("important_dates").insert({
      owner_id: ownerId,
      title: title.trim(),
      date,
      kind,
      emoji,
      yearly: true,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save that date");
      return;
    }
    toast.success("Added to the calendar");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-velvet/70 backdrop-blur-md" />
      <div className="relative w-full max-w-md rounded-t-3xl border border-border/60 bg-surface-elevated/95 p-5 backdrop-blur-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl">A date to remember</h3>
          <button onClick={onClose} aria-label="Close">
            <X className="size-4 text-candle-muted" />
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Whose day is it?"
          className="mb-3 w-full rounded-2xl border border-border/60 bg-velvet/50 px-4 py-3 text-sm outline-none focus:border-petal/60"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-3 w-full rounded-2xl border border-border/60 bg-velvet/50 px-4 py-3 text-sm outline-none focus:border-petal/60"
        />
        <div className="mb-5 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => {
                setKind(k.key);
                setEmoji(k.emoji);
              }}
              className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] transition ${
                kind === k.key ? "border-petal bg-petal/15 text-petal" : "border-border/60 text-candle-muted"
              }`}
            >
              {k.emoji} {k.label}
            </button>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-full bg-petal py-3 text-sm font-medium text-velvet transition disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add to calendar"}
        </button>
      </div>
    </div>
  );
}
