import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Lock, Plus, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Petals } from "@/components/Petals";

export const Route = createFileRoute("/_authenticated/app/anniversary")({
  component: Anniversary,
});

type Capsule = {
  id: string;
  sender_id: string;
  recipient_id: string;
  title: string | null;
  content: string;
  unlock_at: string;
  created_at: string;
};

function Anniversary() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [stats, setStats] = useState({ messages: 0 });

  useEffect(() => {
    if (!me) return;
    (async () => {
      const { data: caps } = await supabase
        .from("time_capsules")
        .select("*")
        .order("unlock_at", { ascending: true });
      setCapsules((caps as Capsule[]) ?? []);

      if (partner) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .or(
            `and(sender_id.eq.${me.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${me.id})`
          );
        setStats({ messages: count ?? 0 });
      }
    })();
  }, [me?.id, partner?.id]);

  const accent = me?.favorite_color ?? "#f87171";
  const emoji = me?.favorite_emoji ?? "🌸";
  const nickname = me?.partner_nickname || partner?.display_name || "your panda";

  const anniversary = useMemo(() => parseAnniversary(me?.anniversary_date), [me?.anniversary_date]);
  const daysTogether = useMemo(() => {
    if (!me?.paired_at && !me?.anniversary_date) return 0;
    const start = new Date(me?.anniversary_date ?? me!.paired_at!);
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  }, [me?.paired_at, me?.anniversary_date]);

  async function sendCapsule() {
    if (!me || !partner) return;
    if (!content.trim() || !unlockAt) {
      toast.error("Write a message and pick a date");
      return;
    }
    const { error } = await supabase.from("time_capsules").insert({
      sender_id: me.id,
      recipient_id: partner.id,
      title: title || null,
      content,
      unlock_at: new Date(unlockAt).toISOString(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Time capsule sealed 🕰️");
    setTitle("");
    setContent("");
    setUnlockAt("");
    setShowCompose(false);
    const { data: caps } = await supabase.from("time_capsules").select("*").order("unlock_at");
    setCapsules((caps as Capsule[]) ?? []);
  }

  if (!me) return <div className="pt-10 px-5 text-candle-muted">Loading…</div>;

  return (
    <div className="relative pt-10 px-5 min-h-screen" style={{ ["--accent" as any]: accent }}>
      <Petals count={10} />

      <header className="relative z-10 flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>Just for us</p>
          <h1 className="font-serif text-2xl italic">Anniversary mode</h1>
        </div>
      </header>

      {!partner ? (
        <div className="relative z-10 p-5 rounded-3xl border border-petal/30 bg-petal-soft">
          <p className="text-sm">Pair with your partner first to unlock Anniversary Mode.</p>
          <Link to="/app/invite" className="text-petal underline text-sm">Invite them →</Link>
        </div>
      ) : (
        <>
          <div
            className="relative z-10 mb-5 p-6 rounded-3xl border overflow-hidden text-center"
            style={{
              borderColor: `color-mix(in oklab, ${accent} 35%, transparent)`,
              background: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${accent} 22%, transparent) 0%, transparent 70%), var(--surface)`,
            }}
          >
            <div className="text-5xl mb-2">{emoji}</div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>
              You and {nickname}
            </p>
            <p className="font-serif text-5xl italic mt-1" style={{ color: "var(--candle)" }}>
              {daysTogether}
            </p>
            <p className="text-sm text-candle-muted -mt-1">days together</p>
            {anniversary && (
              <p className="text-xs text-candle-muted mt-3">
                Next milestone in <span style={{ color: accent }}>{anniversary.daysUntilNext}</span> days
                {" · "}
                {anniversary.nextLabel}
              </p>
            )}
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3 mb-6">
            <Stat label="Messages" value={String(stats.messages)} />
            <Stat label="Days" value={String(daysTogether)} />
            <Stat label="Emoji" value={emoji} />
          </div>

          <section className="relative z-10 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>For your future selves</p>
                <h2 className="font-serif text-xl italic">Time capsules</h2>
              </div>
              <button
                onClick={() => setShowCompose((s) => !s)}
                className="size-10 rounded-full flex items-center justify-center text-velvet"
                style={{ background: accent }}
              >
                <Plus className="size-5" />
              </button>
            </div>

            {showCompose && (
              <div className="p-4 mb-3 rounded-2xl border border-border bg-surface space-y-3 animate-fade-in">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full bg-velvet border border-border rounded-xl px-3 py-2.5 text-sm"
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Dear ${nickname}, on our next anniversary…`}
                  rows={4}
                  className="w-full bg-velvet border border-border rounded-xl px-3 py-2.5 text-sm resize-none"
                />
                <input
                  type="date"
                  value={unlockAt}
                  onChange={(e) => setUnlockAt(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  className="w-full bg-velvet border border-border rounded-xl px-3 py-2.5 text-sm"
                />
                <button
                  onClick={sendCapsule}
                  className="w-full py-3 rounded-xl text-velvet text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: accent }}
                >
                  <Send className="size-4" /> Seal capsule
                </button>
              </div>
            )}

            <div className="space-y-2">
              {capsules.length === 0 && (
                <p className="text-sm text-candle-muted">No capsules yet. Write one for the future.</p>
              )}
              {capsules.map((c) => {
                const unlocked = new Date(c.unlock_at) <= new Date();
                const mine = c.sender_id === me.id;
                return (
                  <div key={c.id} className="p-4 rounded-2xl border border-border bg-surface">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>
                        {mine ? "From you" : `From ${nickname}`}
                      </p>
                      <p className="text-[10px] text-candle-muted">
                        {unlocked ? "Unlocked" : `Unlocks ${new Date(c.unlock_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    {c.title && <p className="font-serif italic text-base mb-1">{c.title}</p>}
                    {unlocked || mine ? (
                      <p className="text-sm text-candle whitespace-pre-wrap">{c.content}</p>
                    ) : (
                      <p className="text-sm text-candle-muted flex items-center gap-2">
                        <Lock className="size-4" /> Sealed until {new Date(c.unlock_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="relative z-10 p-5 rounded-3xl border border-border bg-surface mb-4 flex items-start gap-3">
            <Sparkles className="size-5 mt-0.5" style={{ color: accent }} />
            <p className="text-sm text-candle-muted">
              Set your favorite color and emoji in your profile — they re-tint this whole page.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-surface border border-border rounded-2xl text-center">
      <p className="font-serif text-xl italic">{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-candle-muted mt-0.5">{label}</p>
    </div>
  );
}

function parseAnniversary(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  const daysUntilNext = Math.ceil((next.getTime() - now.getTime()) / 86400000);
  const years = next.getFullYear() - d.getFullYear();
  return { daysUntilNext, nextLabel: `year ${years}` };
}
