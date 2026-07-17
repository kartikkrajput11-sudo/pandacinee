import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

function ShopRoute() {
  const { data, refetch } = useProfile();
  const me = data?.profile as any;
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
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

  return (
    <div className="pt-10 px-5 pb-24 max-w-md mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Achievements</p>
          <h1 className="font-serif text-2xl italic">Tag Shop</h1>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-petal-soft border border-petal/30">
          <Coins className="size-4 text-petal" />
          <span className="font-semibold text-petal">{coins}</span>
        </div>
      </header>

      <p className="text-sm text-candle-muted mb-5">
        Complete rituals with your partner to earn coins. Spend them on tags that appear as achievements on your profile.
      </p>

      <div className="space-y-3">
        {ACHIEVEMENT_TAGS.map((t) => {
          const isOwned = owned.has(t.key);
          const canAfford = coins >= t.cost;
          return (
            <div
              key={t.key}
              className="p-4 rounded-2xl border border-border bg-surface flex items-center gap-4"
              style={{ boxShadow: isOwned ? `0 0 24px -8px ${t.hue}` : undefined }}
            >
              <div
                className="size-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{
                  background: `radial-gradient(circle, ${t.hue}33, transparent 70%)`,
                  border: `1px solid ${t.hue}55`,
                }}
              >
                {t.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif italic text-lg leading-tight">{t.name}</p>
                <p className="text-xs text-candle-muted mt-0.5">{t.blurb}</p>
                <p className="text-[11px] mt-1 flex items-center gap-1 text-petal">
                  <Coins className="size-3" /> {t.cost}
                </p>
              </div>
              {isOwned ? (
                <div className="text-xs text-petal font-semibold inline-flex items-center gap-1">
                  <Check className="size-4" /> Owned
                </div>
              ) : (
                <button
                  onClick={() => purchase(t.key)}
                  disabled={!canAfford || busy === t.key}
                  className="px-3 py-2 rounded-xl bg-petal text-velvet text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
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
