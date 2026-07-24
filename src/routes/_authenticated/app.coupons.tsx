import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Sparkles, Gift, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/coupons")({
  head: () => ({
    meta: [
      { title: "Love Coupons · Pandacine" },
      { name: "description", content: "Send and redeem sweet favors with your partner." },
      { property: "og:title", content: "Love Coupons · Pandacine" },
      { property: "og:description", content: "Send and redeem sweet favors with your partner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CouponsPage,
});

type Coupon = {
  id: string;
  giver_id: string;
  recipient_id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  redeemed_at: string | null;
  redeemed_note: string | null;
  expires_at: string | null;
  created_at: string;
};

const PRESETS = [
  { emoji: "💆", title: "One back rub" },
  { emoji: "🎬", title: "Movie pick tonight" },
  { emoji: "🍳", title: "Breakfast in bed" },
  { emoji: "🎧", title: "Song of your choice on repeat" },
  { emoji: "🧹", title: "One chore, done" },
  { emoji: "😘", title: "Ten kisses, no questions" },
  { emoji: "🍫", title: "Dessert delivery" },
  { emoji: "🤫", title: "One secret revealed" },
];

function CouponsPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [rows, setRows] = useState<Coupon[]>([]);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("💝");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!me) return;
    const { data: r } = await (supabase as any)
      .from("love_coupons")
      .select("*")
      .or(`giver_id.eq.${me.id},recipient_id.eq.${me.id}`)
      .order("created_at", { ascending: false });
    setRows((r ?? []) as Coupon[]);
  }

  useEffect(() => { load(); }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`coupons-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "love_coupons" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id]);

  async function send() {
    if (!me || !partner) return;
    const t = title.trim();
    if (!t) { toast.error("Give it a title"); return; }
    setBusy(true);
    const { error } = await (supabase as any).from("love_coupons").insert({
      giver_id: me.id,
      recipient_id: partner.id,
      title: t.slice(0, 100),
      description: description.trim().slice(0, 500) || null,
      emoji: emoji || "💝",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Sent to ${partner.display_name}`);
    setTitle(""); setDescription(""); setEmoji("💝"); setComposing(false);
  }

  async function redeem(c: Coupon) {
    const note = window.prompt("Say something back? (optional)") ?? "";
    const { error } = await (supabase as any)
      .from("love_coupons")
      .update({ redeemed_at: new Date().toISOString(), redeemed_note: note.slice(0, 300) || null })
      .eq("id", c.id);
    if (error) toast.error(error.message); else toast.success("Redeemed 💝");
  }

  async function revoke(c: Coupon) {
    if (!confirm("Revoke this coupon?")) return;
    const { error } = await (supabase as any).from("love_coupons").delete().eq("id", c.id);
    if (error) toast.error(error.message); else toast.success("Revoked");
  }

  const received = rows.filter((r) => r.recipient_id === me?.id);
  const sent = rows.filter((r) => r.giver_id === me?.id);
  const list = tab === "received" ? received : sent;
  const unredeemedReceived = received.filter((r) => !r.redeemed_at).length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/app" className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle hover:text-petal transition-colors">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Chapter · Love</p>
            <h1 className="text-xl font-serif italic">Love Coupons</h1>
          </div>
          {partner && (
            <button
              onClick={() => setComposing(true)}
              className="h-9 px-4 rounded-full bg-petal text-white text-sm font-medium hover:bg-petal/90 transition-colors flex items-center gap-1.5"
            >
              <Plus className="size-4" /> New
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {!partner ? (
          <div className="text-center py-20 rounded-3xl bg-surface border border-border">
            <Sparkles className="size-8 text-petal mx-auto mb-3" />
            <p className="text-candle mb-1">Pair with your partner</p>
            <p className="text-sm text-candle-muted mb-4">Love Coupons are for two.</p>
            <Link to="/app/partner" className="inline-block h-9 px-4 rounded-full bg-petal text-white text-sm">Pair now</Link>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setTab("received")}
                className={`flex-1 h-11 rounded-2xl border text-sm font-medium transition-colors ${tab === "received" ? "bg-petal/15 border-petal/50 text-candle" : "bg-surface border-border text-candle-muted"}`}
              >
                Received {unredeemedReceived > 0 && <span className="ml-1.5 text-xs bg-petal text-white px-1.5 py-0.5 rounded-full">{unredeemedReceived}</span>}
              </button>
              <button
                onClick={() => setTab("sent")}
                className={`flex-1 h-11 rounded-2xl border text-sm font-medium transition-colors ${tab === "sent" ? "bg-petal/15 border-petal/50 text-candle" : "bg-surface border-border text-candle-muted"}`}
              >
                Sent
              </button>
            </div>

            {list.length === 0 ? (
              <div className="text-center py-16 rounded-3xl bg-surface border border-border">
                <Gift className="size-8 text-petal mx-auto mb-3" />
                <p className="text-candle-muted text-sm">
                  {tab === "received" ? "No coupons yet — ask for one 💝" : "Send one to get started"}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {list.map((c) => (
                  <CouponCard
                    key={c.id}
                    c={c}
                    mine={tab === "sent"}
                    onRedeem={() => redeem(c)}
                    onRevoke={() => revoke(c)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {composing && partner && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4" onClick={() => setComposing(false)}>
          <div className="w-full max-w-md bg-surface border border-petal/30 rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted mb-1">Compose</p>
            <h2 className="text-2xl font-serif italic mb-4">A coupon for {partner.display_name}</h2>

            <label className="text-xs text-candle-muted">Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
              className="w-16 text-center text-2xl mt-1 mb-3 h-12 rounded-xl bg-surface-elevated border border-border"
            />

            <label className="text-xs text-candle-muted">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="One back rub…"
              maxLength={100}
              className="w-full mt-1 mb-3 h-11 px-4 rounded-xl bg-surface-elevated border border-border text-candle placeholder:text-candle-muted"
            />

            <label className="text-xs text-candle-muted">Note (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Redeemable anytime this week…"
              maxLength={500}
              rows={3}
              className="w-full mt-1 mb-4 p-3 rounded-xl bg-surface-elevated border border-border text-candle placeholder:text-candle-muted text-sm resize-none"
            />

            <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-2">Quick picks</p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {PRESETS.map((p) => (
                <button
                  key={p.title}
                  onClick={() => { setEmoji(p.emoji); setTitle(p.title); }}
                  className="text-xs px-3 py-1.5 rounded-full bg-surface-elevated border border-border hover:border-petal/50 text-candle"
                >
                  {p.emoji} {p.title}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setComposing(false)} className="flex-1 h-11 rounded-full bg-surface-elevated border border-border text-candle">
                Cancel
              </button>
              <button onClick={send} disabled={busy} className="flex-1 h-11 rounded-full bg-petal text-white font-medium disabled:opacity-60">
                {busy ? "Sending…" : "Send 💝"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CouponCard({ c, mine, onRedeem, onRevoke }: { c: Coupon; mine: boolean; onRedeem: () => void; onRevoke: () => void }) {
  const redeemed = !!c.redeemed_at;
  return (
    <div className={`relative rounded-3xl border p-5 overflow-hidden ${redeemed ? "bg-surface/60 border-border/50" : "bg-gradient-to-br from-petal/10 via-surface to-surface border-petal/40"}`}>
      {/* Ticket notches */}
      <div className="absolute -left-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-background border border-border" />
      <div className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-background border border-border" />

      <div className="flex items-start gap-4">
        <div className={`size-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl ${redeemed ? "bg-surface-elevated" : "bg-petal/20"}`}>
          {c.emoji || "💝"}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-serif text-lg leading-snug ${redeemed ? "text-candle-muted line-through" : "text-candle"}`}>
            {c.title}
          </h3>
          {c.description && (
            <p className="text-sm text-candle-muted mt-1 leading-relaxed">{c.description}</p>
          )}
          {redeemed && c.redeemed_note && (
            <p className="text-xs text-petal mt-2 italic">"{c.redeemed_note}"</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            {redeemed ? (
              <span className="text-[10px] uppercase tracking-[0.25em] text-candle-muted flex items-center gap-1">
                <Check className="size-3" /> Redeemed {new Date(c.redeemed_at!).toLocaleDateString()}
              </span>
            ) : mine ? (
              <button onClick={onRevoke} className="text-xs text-candle-muted hover:text-petal flex items-center gap-1">
                <Trash2 className="size-3" /> Revoke
              </button>
            ) : (
              <button onClick={onRedeem} className="h-8 px-4 rounded-full bg-petal text-white text-xs font-medium hover:bg-petal/90">
                Redeem 💝
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
