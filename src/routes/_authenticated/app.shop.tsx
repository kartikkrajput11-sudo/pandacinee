import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Coins, Check, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { ACHIEVEMENT_TAGS } from "@/lib/achievements";
import { purchaseTag } from "@/lib/achievements.functions";

export const Route = createFileRoute("/_authenticated/app/shop")({
  component: ShopRoute,
});

type Filter = "all" | "owned" | "affordable" | "locked";

function ShopRoute() {
  const { data, refetch } = useProfile();
  const me = data?.profile as any;
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const buy = useServerFn(purchaseTag);

  async function loadOwned() {
    if (!me?.id) return;
    const { data: rows } = await (supabase as any)
      .from("profile_achievements")
      .select("tag_key")
      .eq("user_id", me.id);
    setOwned(new Set(((rows ?? []) as any[]).map((r) => r.tag_key)));
  }
  useEffect(() => {
    loadOwned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  async function purchase(key: string) {
    setBusy(key);
    try {
      await buy({ data: { tagKey: key } });
      toast.success("Tag unlocked ✨");
      await Promise.all([loadOwned(), refetch?.()]);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't purchase");
    } finally {
      setBusy(null);
    }
  }

  const coins = me?.coins ?? 0;

  const displayed = useMemo(() => {
    return ACHIEVEMENT_TAGS.filter((t) => {
      if (filter === "owned") return owned.has(t.key);
      if (filter === "affordable") return !owned.has(t.key) && coins >= t.cost;
      if (filter === "locked") return !owned.has(t.key) && coins < t.cost;
      return true;
    });
  }, [owned, coins, filter]);

  const nextAffordable = useMemo(() => {
    return ACHIEVEMENT_TAGS
      .filter((t) => !owned.has(t.key))
      .sort((a, b) => a.cost - b.cost)[0];
  }, [owned]);

  const progress = nextAffordable ? Math.min(100, (coins / nextAffordable.cost) * 100) : 100;

  return (
    <div className="pt-10 px-5 pb-24 max-w-md mx-auto relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px]"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 0%, hsl(var(--petal) / 0.18), transparent 70%)",
        }}
      />

      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-6">
        <Link
          to="/app"
          className="size-9 rounded-full grid place-items-center bg-surface/60 border border-border text-candle-muted hover:text-candle transition"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.35em] text-petal">Honors</p>
          <h1 className="font-serif text-2xl italic truncate">Tag Shop</h1>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-petal-soft border border-petal/40">
          <Coins className="size-4 text-petal" />
          <span className="font-semibold text-petal tabular-nums">{coins}</span>
        </div>
      </header>

      {/* Coin balance hero */}
      <div
        className="relative overflow-hidden rounded-[24px] border border-petal/40 p-5 mb-5"
        style={{
          background:
            "linear-gradient(160deg, hsl(var(--petal) / 0.18), hsl(var(--velvet)) 80%)",
          boxShadow:
            "0 30px 60px -30px hsl(var(--petal) / 0.45), inset 0 1px 0 hsl(var(--candle) / 0.06)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted mb-1">
              Purse
            </p>
            <p className="font-serif text-4xl italic text-candle tabular-nums">
              {coins} <span className="text-sm text-candle-muted not-italic">coins</span>
            </p>
          </div>
          <div className="size-14 rounded-full grid place-items-center bg-petal/20 border border-petal/40">
            <Coins className="size-6 text-petal" />
          </div>
        </div>

        {nextAffordable && (
          <>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-1.5">
              <span>Next: {nextAffordable.name}</span>
              <span className="tabular-nums">
                {coins}/{nextAffordable.cost}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-velvet/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-petal to-petal-glow transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
        {!nextAffordable && (
          <p className="text-xs text-petal font-serif italic">Every honor is yours. ✨</p>
        )}
      </div>

      <p className="text-sm text-candle-muted mb-4 leading-relaxed">
        Complete rituals with your partner to earn coins. Spend them on tags that appear as
        honors on your profile.
      </p>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1">
        {([
          { id: "all", label: "All" },
          { id: "affordable", label: "Affordable" },
          { id: "owned", label: `Owned · ${owned.size}` },
          { id: "locked", label: "Locked" },
        ] as { id: Filter; label: string }[]).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-[0.2em] transition ${
              filter === f.id
                ? "bg-petal text-velvet petal-glow"
                : "bg-surface border border-border text-candle-muted hover:text-candle"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {displayed.length === 0 && (
          <p className="text-sm text-candle-muted text-center py-8 font-serif italic">
            No honors in this filter.
          </p>
        )}
        {displayed.map((t) => {
          const isOwned = owned.has(t.key);
          const canAfford = coins >= t.cost;
          return (
            <div
              key={t.key}
              className="p-4 rounded-2xl border border-border bg-surface/70 backdrop-blur flex items-center gap-4 hover:border-petal/40 transition"
              style={{
                boxShadow: isOwned ? `0 0 32px -12px ${t.hue}` : undefined,
                borderColor: isOwned ? `${t.hue}66` : undefined,
              }}
            >
              <div
                className="size-14 rounded-2xl grid place-items-center text-3xl shrink-0"
                style={{
                  background: `radial-gradient(circle, ${t.hue}33, transparent 70%)`,
                  border: `1px solid ${t.hue}55`,
                }}
              >
                {t.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif italic text-lg leading-tight">{t.name}</p>
                <p className="text-xs text-candle-muted mt-0.5 line-clamp-2">{t.blurb}</p>
                <p className="text-[11px] mt-1 flex items-center gap-1 text-petal font-medium tabular-nums">
                  <Coins className="size-3" /> {t.cost}
                </p>
              </div>
              {isOwned ? (
                <div className="text-xs text-petal font-semibold inline-flex items-center gap-1 shrink-0">
                  <Check className="size-4" /> Owned
                </div>
              ) : (
                <button
                  onClick={() => purchase(t.key)}
                  disabled={!canAfford || busy === t.key}
                  className="px-3.5 py-2 rounded-full bg-petal text-velvet text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1 shrink-0 petal-glow disabled:petal-glow-none"
                >
                  {!canAfford ? <Lock className="size-3" /> : <Sparkles className="size-3" />}
                  {busy === t.key ? "…" : canAfford ? "Buy" : "Locked"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
