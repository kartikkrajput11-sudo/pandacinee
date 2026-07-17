import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Coins,
  Check,
  Lock,
  Sparkles,
  MessageCircle,
  Palette,
  Wand2,
  Crown,
  Sticker,
  Award,
  Grid3x3,
  Coins as CoinsIcon,
} from "lucide-react";
import { createCoinOrder, verifyCoinPayment } from "@/lib/razorpay.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { ACHIEVEMENT_TAGS } from "@/lib/achievements";
import { purchaseTag } from "@/lib/achievements.functions";
import { invalidateEquippedItems } from "@/hooks/useEquippedItems";


export const Route = createFileRoute("/_authenticated/app/shop")({
  component: ShopRoute,
});

let _rzpPromise: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).Razorpay) return Promise.resolve();
  if (_rzpPromise) return _rzpPromise;
  _rzpPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => {
      _rzpPromise = null;
      reject(new Error("Failed to load Razorpay"));
    };
    document.body.appendChild(s);
  });
  return _rzpPromise;
}

type Category =
  | "coins"
  | "chat_theme"
  | "site_theme"
  | "chat_perk"
  | "profile_flair"
  | "ai_sticker_pack"
  | "chess_board"
  | "chess_pieces"
  | "tag";

const CATS: { key: Category; label: string; icon: any; blurb: string }[] = [
  { key: "coins", label: "Coins", icon: CoinsIcon, blurb: "Top up Panda Coins with UPI, cards, or netbanking" },
  { key: "chat_theme", label: "Chat", icon: MessageCircle, blurb: "Bubble palettes & chat wallpapers" },
  { key: "site_theme", label: "Site", icon: Palette, blurb: "Global accent skins for the whole app" },
  { key: "chat_perk", label: "Perks", icon: Wand2, blurb: "Sticker packs, kisses, and effects" },
  { key: "profile_flair", label: "Flair", icon: Crown, blurb: "Avatar rings & profile highlights" },
  { key: "ai_sticker_pack", label: "AI Packs", icon: Sticker, blurb: "AI-generated sticker sets for chat" },
  { key: "chess_board", label: "Board", icon: Grid3x3, blurb: "Themed chess boards to unlock for your matches" },
  { key: "chess_pieces", label: "Pieces", icon: Sparkles, blurb: "Chess piece skins — swap glyphs on your board" },
  { key: "tag", label: "Tags", icon: Award, blurb: "Achievement tags for your profile" },
];


type CoinBundle = {
  id: string;
  bundle_key: string;
  name: string;
  description: string | null;
  coins: number;
  price_paise: number;
  currency: string;
  bonus_label: string | null;
  sort_order: number;
};

type ShopItem = {
  id: string;
  item_key: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  preview_url: string | null;
  metadata: any;
  sort_order: number;
};

function ShopRoute() {
  const { data, refetch } = useProfile();
  const me = data?.profile as any;
  const isAdmin = me?.is_admin === true;
  const [items, setItems] = useState<ShopItem[]>([]);
  const [bundles, setBundles] = useState<CoinBundle[]>([]);
  const [inventory, setInventory] = useState<Map<string, boolean>>(new Map()); // item_id -> equipped
  const [ownedTags, setOwnedTags] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Category>("coins");
  const [preview, setPreview] = useState<ShopItem | null>(null);
  const buyTag = useServerFn(purchaseTag);
  const createOrder = useServerFn(createCoinOrder);
  const verifyPayment = useServerFn(verifyCoinPayment);

  async function load() {
    if (!me?.id) return;
    const [itemsRes, invRes, tagRes, bundleRes] = await Promise.all([
      (supabase as any).from("shop_items").select("*").eq("active", true).order("sort_order"),
      (supabase as any).from("user_inventory").select("item_id, equipped").eq("user_id", me.id),
      (supabase as any).from("profile_achievements").select("tag_key").eq("user_id", me.id),
      (supabase as any).from("coin_bundles").select("*").eq("active", true).order("sort_order"),
    ]);
    setItems((itemsRes.data ?? []) as ShopItem[]);
    setBundles((bundleRes.data ?? []) as CoinBundle[]);
    const m = new Map<string, boolean>();
    for (const r of (invRes.data ?? []) as any[]) m.set(r.item_id, !!r.equipped);
    setInventory(m);
    setOwnedTags(new Set(((tagRes.data ?? []) as any[]).map((r) => r.tag_key)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const coins = me?.panda_coins ?? 0;
  const legacyCoins = me?.coins ?? 0;

  const filtered = useMemo(() => items.filter((i) => i.category === tab), [items, tab]);

  async function purchase(item: ShopItem) {
    if (coins < item.price) {
      toast.error("Not enough Panda Coins");
      return;
    }
    setBusy(item.id);
    try {
      const { error } = await (supabase as any).rpc("purchase_shop_item", { _item_id: item.id });
      if (error) throw error;
      toast.success(`${item.name} unlocked ✨`);
      await Promise.all([load(), refetch?.()]);
      invalidateEquippedItems();
      setPreview(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't purchase");
    } finally {
      setBusy(null);
    }
  }

  async function toggleEquip(item: ShopItem) {
    setBusy(item.id);
    try {
      const currentlyEquipped = inventory.get(item.id) === true;
      const { error } = await (supabase as any).rpc("toggle_equip_item", {
        _item_id: item.id,
        _equip: !currentlyEquipped,
      });
      if (error) throw error;
      toast.success(currentlyEquipped ? "Unequipped" : "Equipped ✨");
      await load();
      invalidateEquippedItems();

    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't equip");
    } finally {
      setBusy(null);
    }
  }

  async function purchaseTagLegacy(key: string) {
    setBusy(key);
    try {
      await buyTag({ data: { tagKey: key } });
      toast.success("Tag unlocked ✨");
      await Promise.all([load(), refetch?.()]);
      invalidateEquippedItems();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't purchase");
    } finally {
      setBusy(null);
    }
  }

  async function buyBundle(bundle: CoinBundle) {
    if (!me?.id) return;
    setBusy(bundle.id);
    try {
      await loadRazorpayScript();
      const order = await createOrder({ data: { bundleId: bundle.id } });
      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "Pandacine",
          description: `${order.coins} Panda Coins`,
          order_id: order.orderId,
          prefill: {
            name: me?.display_name ?? me?.username ?? "",
          },
          theme: { color: "#e879a5" },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
          handler: async (resp: any) => {
            try {
              const result = await verifyPayment({
                data: {
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                },
              });
              toast.success(`+${result.coins ?? order.coins} 🐼 Panda Coins`, {
                description: "Payment successful",
              });
              await Promise.all([load(), refetch?.()]);
      invalidateEquippedItems();
              resolve();
            } catch (e: any) {
              toast.error(e?.message ?? "Verification failed");
              reject(e);
            }
          },
        });
        rzp.on("payment.failed", (e: any) => {
          toast.error(e?.error?.description ?? "Payment failed");
          reject(new Error(e?.error?.description ?? "Payment failed"));
        });
        rzp.open();
      });
    } catch (e: any) {
      if (e?.message !== "Payment cancelled") {
        toast.error(e?.message ?? "Couldn't start payment");
      }
    } finally {
      setBusy(null);
    }
  }

  const activeCat = CATS.find((c) => c.key === tab)!;

  return (
    <div className="pt-10 px-5 pb-24 max-w-md mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Panda Bazaar</p>
          <h1 className="font-serif text-2xl italic">Coin Shop</h1>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-petal-soft border border-petal/30">
          <Coins className="size-4 text-petal" />
          <span className="font-semibold text-petal">{coins}</span>
        </div>
      </header>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1 scrollbar-none">
        {CATS.map((c) => {
          const Icon = c.icon;
          const active = tab === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                active
                  ? "bg-petal text-velvet border-petal"
                  : "bg-surface border-border text-candle-muted"
              }`}
            >
              <Icon className="size-3.5" />
              {c.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-candle-muted mb-4 italic">{activeCat.blurb}</p>

      {/* Coin bundles — Razorpay checkout */}
      {tab === "coins" ? (
        <div className="grid grid-cols-2 gap-3">
          {bundles.map((b) => {
            const rupees = (b.price_paise / 100).toFixed(0);
            const isBusy = busy === b.id;
            return (
              <button
                key={b.id}
                onClick={() => buyBundle(b)}
                disabled={isBusy}
                className="text-left rounded-2xl border border-border bg-surface p-4 active:scale-[0.98] transition relative overflow-hidden disabled:opacity-60"
              >
                {b.bonus_label && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-petal text-velvet text-[10px] font-bold">
                    {b.bonus_label}
                  </span>
                )}
                <div className="text-3xl mb-2">🐼</div>
                <p className="font-serif italic text-base leading-tight">{b.name}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-petal font-bold text-lg">
                  <Coins className="size-4" /> {b.coins.toLocaleString()}
                </p>
                {b.description && (
                  <p className="text-[11px] text-candle-muted mt-1">{b.description}</p>
                )}
                <div className="mt-3 px-3 py-1.5 rounded-full bg-petal text-velvet text-xs font-bold text-center">
                  {isBusy ? "…" : `₹${rupees}`}
                </div>
              </button>
            );
          })}
          {bundles.length === 0 && (
            <div className="col-span-2 rounded-2xl border border-dashed border-candle/15 bg-velvet/40 px-5 py-10 text-center">
              <p className="text-3xl mb-2">🐼</p>
              <p className="font-serif italic text-candle/80 text-sm">Bundles loading…</p>
            </div>
          )}
          <p className="col-span-2 text-[10px] text-candle-muted/70 text-center mt-2 italic">
            Secure UPI / cards / netbanking via Razorpay. Coins credit instantly.
          </p>
        </div>
      ) : tab === "tag" ? (
        <div className="space-y-3">
          {ACHIEVEMENT_TAGS.map((t) => {
            const isOwned = ownedTags.has(t.key);
            const canAfford = legacyCoins >= t.cost;
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
                    <Coins className="size-3" /> {t.cost} <span className="text-candle-muted/60">legacy</span>
                  </p>
                </div>
                {isOwned ? (
                  <div className="text-xs text-petal font-semibold inline-flex items-center gap-1">
                    <Check className="size-4" /> Owned
                  </div>
                ) : (
                  <button
                    onClick={() => purchaseTagLegacy(t.key)}
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
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((item) => {
            const owned = inventory.has(item.id);
            const equipped = inventory.get(item.id) === true;
            return (
              <ShopCard
                key={item.id}
                item={item}
                owned={owned}
                equipped={equipped}
                canAfford={coins >= item.price}
                busy={busy === item.id}
                onPreview={() => setPreview(item)}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 rounded-2xl border border-dashed border-candle/15 bg-velvet/40 px-5 py-10 text-center">
              <p className="text-3xl mb-2">🎁</p>
              <p className="font-serif italic text-candle/80 text-sm">More treasures coming soon</p>
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-border rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ItemPreview item={preview} />
            <div className="mt-4">
              <p className="font-serif italic text-xl">{preview.name}</p>
              <p className="text-sm text-candle-muted mt-1">{preview.description}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-petal font-semibold">
                <Coins className="size-4" /> {preview.price}
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              {inventory.has(preview.id) ? (
                preview.category === "ai_sticker_pack" ? (
                  <Link
                    to="/app/chat"
                    onClick={() => setPreview(null)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-petal text-velvet font-semibold text-sm inline-flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="size-4" /> Generate in chat
                  </Link>
                ) : (
                  <button
                    onClick={() => toggleEquip(preview)}
                    disabled={busy === preview.id}
                    className="flex-1 px-4 py-3 rounded-2xl bg-petal text-velvet font-semibold text-sm disabled:opacity-50"
                  >
                    {busy === preview.id
                      ? "…"
                      : inventory.get(preview.id)
                        ? "Unequip"
                        : "Equip"}
                  </button>
                )
              ) : (
                <button
                  onClick={() => purchase(preview)}
                  disabled={busy === preview.id || coins < preview.price}
                  className="flex-1 px-4 py-3 rounded-2xl bg-petal text-velvet font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {coins < preview.price ? <Lock className="size-4" /> : <Sparkles className="size-4" />}
                  {busy === preview.id ? "…" : coins < preview.price ? "Not enough" : "Unlock"}
                </button>
              )}
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-3 rounded-2xl bg-velvet border border-border text-candle-muted text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopCard({
  item,
  owned,
  equipped,
  canAfford,
  busy,
  onPreview,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  busy: boolean;
  onPreview: () => void;
}) {
  return (
    <button
      onClick={onPreview}
      disabled={busy}
      className="text-left rounded-2xl border border-border bg-surface overflow-hidden active:scale-[0.98] transition"
    >
      <div className="aspect-square relative">
        <ItemPreview item={item} compact />
        {equipped && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-petal text-velvet text-[10px] font-bold inline-flex items-center gap-1">
            <Check className="size-3" /> Equipped
          </div>
        )}
        {owned && !equipped && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-velvet/80 text-candle text-[10px] font-semibold border border-border">
            Owned
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-serif italic text-sm leading-tight truncate">{item.name}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] text-petal font-semibold">
            <Coins className="size-3" /> {item.price === 0 ? "Free" : item.price}
          </span>
          {!owned && !canAfford && <Lock className="size-3 text-candle-muted" />}
        </div>
      </div>
    </button>
  );
}

function ItemPreview({ item, compact = false }: { item: ShopItem; compact?: boolean }) {
  const meta = item.metadata ?? {};
  if (item.category === "chat_theme") {
    return (
      <div className="w-full h-full flex flex-col justify-end gap-1.5 p-3" style={{ background: chatWallpaper(meta.wallpaper) }}>
        <div className="self-start max-w-[70%] px-2.5 py-1.5 rounded-2xl rounded-bl-sm text-[10px] text-candle" style={{ background: meta.bubble_them ?? "#2b1e2e" }}>
          hi love ✨
        </div>
        <div className="self-end max-w-[70%] px-2.5 py-1.5 rounded-2xl rounded-br-sm text-[10px] text-velvet font-medium" style={{ background: meta.bubble_me ?? "#e879a5" }}>
          missing you
        </div>
      </div>
    );
  }
  if (item.category === "site_theme") {
    return (
      <div className="w-full h-full relative" style={{ background: meta.bg ?? "#1a0f1c" }}>
        <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 30% 20%, ${meta.accent}66, transparent 60%)` }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-12 rounded-full" style={{ background: meta.accent, boxShadow: `0 0 30px ${meta.accent}` }} />
        </div>
      </div>
    );
  }
  if (item.category === "chat_perk") {
    return (
      <div className="w-full h-full bg-gradient-to-br from-velvet to-surface flex items-center justify-center text-5xl">
        {perkEmoji(meta.effect)}
      </div>
    );
  }
  if (item.category === "profile_flair") {
    return (
      <div className="w-full h-full bg-gradient-to-br from-velvet to-surface flex items-center justify-center">
        <div
          className="size-16 rounded-full bg-petal/40 flex items-center justify-center text-2xl"
          style={{
            boxShadow: flairRing(meta.ring),
            outline: meta.badge === "supporter" ? "2px solid gold" : undefined,
          }}
        >
          🐼
        </div>
      </div>
    );
  }
  if (item.category === "ai_sticker_pack") {
    const moods: string[] = Array.isArray(meta.moods) ? meta.moods : [];
    return (
      <div className="w-full h-full bg-gradient-to-br from-petal/20 to-velvet flex flex-col items-center justify-center gap-1 p-2 relative">
        <div className="text-3xl">{meta.kind === "couple" ? "💞" : "🐼"}</div>
        <div className="text-[8px] uppercase tracking-[0.2em] text-petal font-bold">
          {meta.kind === "couple" ? "Couple AI" : "Solo AI"}
        </div>
        {!compact && (
          <div className="flex flex-wrap gap-1 justify-center mt-1 px-2">
            {moods.slice(0, 6).map((m) => (
              <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full bg-velvet/70 border border-petal/30 text-candle/80">
                {String(m).replace("couple-", "").replace("-", " ")}
              </span>
            ))}
          </div>
        )}
        <div className="absolute bottom-1 right-1 text-[8px] text-candle-muted font-semibold inline-flex items-center gap-0.5">
          <Sparkles className="size-2.5" /> AI
        </div>
      </div>
    );
  }
  if (item.category === "chess_board") {
    const light = meta.light ?? "oklch(0.82 0.04 320)";
    const dark = meta.dark ?? "oklch(0.42 0.09 310)";
    const accent = meta.accent ?? "#e879a5";
    const size = compact ? 6 : 8;
    return (
      <div className="w-full h-full bg-gradient-to-br from-velvet to-surface flex items-center justify-center p-3 relative">
        <div
          className="grid rounded-lg overflow-hidden shadow-lg border"
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
            width: compact ? "70%" : "78%",
            aspectRatio: "1 / 1",
            borderColor: `${accent}55`,
            boxShadow: `0 0 24px -8px ${accent}`,
          }}
        >
          {Array.from({ length: size * size }).map((_, i) => {
            const row = Math.floor(i / size);
            const col = i % size;
            const isLight = (row + col) % 2 === 0;
            const showPiece = !compact && ((i === 0) || (i === size + 1) || (i === size * size - 1) || (i === size * size - size - 2));
            return (
              <div key={i} className="flex items-center justify-center" style={{ background: isLight ? light : dark }}>
                {showPiece && (
                  <span className="text-[10px] leading-none" style={{ color: i < size * size / 2 ? "#000" : "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.4)" }}>
                    {i < size * size / 2 ? "♛" : "♕"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {meta.label && (
          <div className="absolute bottom-1 right-2 text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: accent }}>
            {meta.label}
          </div>
        )}
      </div>
    );
  }
  if (item.category === "chess_pieces") {
    const glyphs = meta.glyphs?.w ?? { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" };
    const isEmoji = meta.emoji === true;
    const isGlass = meta.style === "glass";
    const pieces: string[] = ["k", "q", "r", "b", "n", "p"].map((t) => glyphs[t] ?? "?");
    return (
      <div className="w-full h-full bg-gradient-to-br from-velvet to-surface flex flex-col items-center justify-center gap-2 p-3 relative">
        <div className="grid grid-cols-3 gap-1.5 w-[80%]">
          {pieces.map((g, i) => (
            <div key={i} className="aspect-square rounded-lg bg-surface/70 border border-petal/20 flex items-center justify-center relative overflow-hidden">
              {isGlass ? (
                <span
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: "78%",
                    height: "78%",
                    background: "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(220,240,255,0.15))",
                    backdropFilter: "blur(6px) saturate(160%)",
                    border: "1px solid rgba(255,255,255,0.7)",
                    boxShadow: "inset 0 1px 2px rgba(255,255,255,0.9), 0 2px 8px rgba(120,180,255,0.35)",
                  }}
                >
                  <span
                    className="text-xl leading-none"
                    style={{
                      background: "linear-gradient(180deg, #ffffff, #c7ecff 60%, #7fb8ff)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {g}
                  </span>
                </span>
              ) : (
                <span className={`text-2xl leading-none ${isEmoji ? "" : "text-candle"}`} style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                  {g}
                </span>
              )}
            </div>
          ))}
        </div>
        {meta.label && (
          <div className="absolute bottom-1 right-2 text-[9px] uppercase tracking-[0.2em] font-bold text-petal">
            {meta.label}
          </div>
        )}
      </div>
    );
  }
  return <div className="w-full h-full bg-velvet" />;
}

function chatWallpaper(w?: string) {
  switch (w) {
    case "bamboo":
      return "linear-gradient(135deg, #1e2b25, #0f1a13)";
    case "sakura":
      return "linear-gradient(135deg, #3d2a35, #2a1e28)";
    case "neon":
      return "linear-gradient(135deg, #1a1030, #10061c)";
    case "sunset":
      return "linear-gradient(135deg, #3a1f1a, #1f0f0d)";
    case "arctic":
      return "linear-gradient(135deg, #1e2a3a, #0f1620)";
    default:
      return "linear-gradient(135deg, #2b1e2e, #1a0f1c)";
  }
}

function perkEmoji(effect?: string) {
  switch (effect) {
    case "kiss_gold":
      return "💋";
    case "hug_warm":
      return "🤗";
    case "confetti":
      return "🎉";
    case "petal_rain":
      return "🌸";
    case "wax_seal":
      return "💌";
    default:
      return "✨";
  }
}

function flairRing(ring?: string) {
  switch (ring) {
    case "aurora":
      return "0 0 0 3px #7dd3fc, 0 0 20px #c084fc";
    case "gold":
      return "0 0 0 3px gold, 0 0 20px #facc15";
    default:
      return "none";
  }
}
