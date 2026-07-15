import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { generateConciergeIdeas } from "@/lib/concierge.functions";

export const Route = createFileRoute("/_authenticated/app/concierge")({
  component: ConciergeRoute,
});

type Suggestion = {
  id: string;
  author_id: string;
  partner_id: string;
  kind: "date" | "gift" | "trip" | "note" | "ritual";
  title: string;
  body: string;
  meta: any;
  saved: boolean;
  dismissed: boolean;
  created_at: string;
};

const KIND_META: Record<Suggestion["kind"], { emoji: string; label: string; accent: string }> = {
  date: { emoji: "🍷", label: "Date", accent: "from-[#c9a84c]/30 to-transparent" },
  gift: { emoji: "🎁", label: "Gift", accent: "from-[#c96b7a]/30 to-transparent" },
  trip: { emoji: "✈️", label: "Trip", accent: "from-[#5cbdb9]/30 to-transparent" },
  note: { emoji: "✍️", label: "Note", accent: "from-[#f0d78c]/30 to-transparent" },
  ritual: { emoji: "🕯️", label: "Ritual", accent: "from-[#0d7a5f]/30 to-transparent" },
};

function ConciergeRoute() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mood, setMood] = useState("");
  const [budget, setBudget] = useState<"cozy" | "modest" | "splurge">("modest");
  const [tab, setTab] = useState<"fresh" | "saved">("fresh");

  async function load() {
    if (!me) return;
    setLoading(true);
    const { data: rows } = await (supabase as any)
      .from("concierge_suggestions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    setItems((rows ?? []) as Suggestion[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("concierge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "concierge_suggestions" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  async function conjure() {
    if (!partner) return;
    setGenerating(true);
    try {
      await generateConciergeIdeas({
        data: {
          partnerId: partner.id,
          mood: mood.trim() || undefined,
          budget,
        },
      });
      toast.success("Five fresh ideas.");
    } catch (err: any) {
      toast.error(err?.message ?? "The concierge is resting.");
    } finally {
      setGenerating(false);
      setShowFilters(false);
    }
  }

  async function toggleSave(s: Suggestion) {
    await (supabase as any).from("concierge_suggestions").update({ saved: !s.saved }).eq("id", s.id);
  }
  async function dismiss(s: Suggestion) {
    await (supabase as any).from("concierge_suggestions").update({ dismissed: true }).eq("id", s.id);
  }

  const visible = items.filter((i) => {
    if (i.dismissed) return false;
    if (tab === "saved") return i.saved;
    return true;
  });

  return (
    <div className="pt-10 px-5 pb-24">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Private concierge</p>
          <h1 className="font-serif text-2xl italic">Ideas, tailored</h1>
        </div>
      </header>

      {!partner && (
        <div className="p-5 mb-5 rounded-3xl border border-petal/30 bg-petal-soft">
          <p className="text-sm text-candle">
            The concierge plans for two. <Link to="/app/invite" className="text-petal underline">Pair with your panda →</Link>
          </p>
        </div>
      )}

      {partner && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTab("fresh")}
              className={`flex-1 py-2 rounded-full text-xs uppercase tracking-widest ${tab === "fresh" ? "bg-petal text-velvet" : "bg-surface text-candle-muted"}`}
            >
              Fresh
            </button>
            <button
              onClick={() => setTab("saved")}
              className={`flex-1 py-2 rounded-full text-xs uppercase tracking-widest ${tab === "saved" ? "bg-petal text-velvet" : "bg-surface text-candle-muted"}`}
            >
              Saved
            </button>
          </div>

          {tab === "fresh" && (
            <button
              onClick={() => setShowFilters((v) => !v)}
              disabled={generating}
              className="w-full mb-4 p-4 rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft via-transparent to-transparent hover:border-petal/60 transition-colors flex items-center gap-3 disabled:opacity-60"
            >
              <div className="size-11 rounded-2xl bg-petal text-velvet flex items-center justify-center petal-glow">
                <Sparkles className="size-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-serif italic text-lg leading-tight">
                  {generating ? "Composing five ideas…" : "Ask the concierge"}
                </p>
                <p className="text-[11px] text-candle-muted mt-0.5">Tuned to your mood and budget.</p>
              </div>
            </button>
          )}

          {showFilters && (
            <div className="mb-4 p-4 rounded-2xl bg-surface border border-border space-y-3 animate-fade-in">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Mood right now</p>
                <input
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="e.g. tired but tender, want to celebrate…"
                  className="w-full bg-velvet border border-border rounded-xl px-3 py-2 text-sm text-candle placeholder:text-candle-muted"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Budget</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["cozy", "modest", "splurge"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBudget(b)}
                      className={`py-2 rounded-xl text-xs capitalize border ${budget === b ? "border-petal bg-petal-soft text-candle" : "border-border text-candle-muted"}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={conjure}
                disabled={generating}
                className="w-full py-3 rounded-2xl bg-petal text-velvet font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Sparkles className="size-4" />
                {generating ? "Composing…" : "Give me five"}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-candle-muted italic">Reading the room…</p>
          ) : visible.length === 0 ? (
            <div className="p-6 rounded-3xl glass-strong text-center">
              <p className="font-serif italic text-lg">
                {tab === "saved" ? "Nothing saved yet." : "No ideas yet."}
              </p>
              <p className="text-sm text-candle-muted mt-1">
                {tab === "saved" ? "Tap the bookmark on any idea to keep it." : "Tap the concierge above to conjure five."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((s) => (
                <SuggestionCard key={s.id} s={s} onToggleSave={toggleSave} onDismiss={dismiss} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SuggestionCard({
  s,
  onToggleSave,
  onDismiss,
}: {
  s: Suggestion;
  onToggleSave: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}) {
  const meta = KIND_META[s.kind];
  return (
    <article className={`relative p-4 rounded-3xl bg-surface border border-border overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent} opacity-40 pointer-events-none`} />
      <div className="relative flex items-start gap-3">
        <div className="size-11 rounded-2xl bg-velvet/50 border border-white/5 flex items-center justify-center text-xl shrink-0">
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] uppercase tracking-[0.25em] text-petal">{meta.label}</span>
            {s.meta?.budget && (
              <span className="text-[9px] uppercase tracking-widest text-candle-muted">· {s.meta.budget}</span>
            )}
          </div>
          <h3 className="font-serif italic text-lg leading-tight text-candle mb-1">{s.title}</h3>
          <p className="text-sm text-candle-muted leading-relaxed">{s.body}</p>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleSave(s)}
            className={`size-8 rounded-xl flex items-center justify-center ${s.saved ? "bg-petal text-velvet" : "bg-velvet/40 text-candle-muted"}`}
            aria-label={s.saved ? "Unsave" : "Save"}
          >
            {s.saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          </button>
          <button
            onClick={() => onDismiss(s)}
            className="size-8 rounded-xl flex items-center justify-center bg-velvet/40 text-candle-muted"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
