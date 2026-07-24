import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Heart, ThumbsDown, Trash2, Gift, Sparkles, Link as LinkIcon, X, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AvatarImg } from "@/components/AvatarImg";

export const Route = createFileRoute("/_authenticated/app/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist · Pandacine" },
      { name: "description", content: "Vote on the things you both want — a shared wishlist for two." },
      { property: "og:title", content: "Wishlist · Pandacine" },
      { property: "og:description", content: "Vote on the things you both want — a shared wishlist for two." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WishlistPage,
});

type VoteMap = Record<string, 1 | -1>;
type Item = {
  id: string;
  owner_id: string;
  partner_id: string | null;
  title: string;
  note: string | null;
  url: string | null;
  image_url: string | null;
  priority: number;
  claimed_by: string | null;
  got_it: boolean;
  votes: VoteMap;
  created_at: string;
};

function WishlistPage() {
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const partner = profileData?.partner;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | "matched" | "open" | "got">("all");

  useEffect(() => {
    if (!me?.id) return;
    let mounted = true;

    const load = async () => {
      const orIds = partner?.id ? `owner_id.eq.${me.id},owner_id.eq.${partner.id}` : `owner_id.eq.${me.id}`;
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("*")
        .or(orIds)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) toast.error("Couldn't load wishlist");
      setItems((data ?? []) as Item[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("wishlist-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlist_items" },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [me?.id, partner?.id]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter === "got") return i.got_it;
      if (i.got_it && filter !== "all") return false;
      const votes = i.votes ?? {};
      const mineVote = me ? votes[me.id] : undefined;
      const partnerVote = partner ? votes[partner.id] : undefined;
      if (filter === "matched") return mineVote === 1 && partnerVote === 1;
      if (filter === "open") return mineVote === undefined || partnerVote === undefined;
      return true;
    });
  }, [items, filter, me?.id, partner?.id]);

  async function vote(item: Item, value: 1 | -1) {
    if (!me?.id) return;
    const next = { ...(item.votes ?? {}) } as VoteMap;
    if (next[me.id] === value) delete next[me.id];
    else next[me.id] = value;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, votes: next } : i)));
    const { error } = await supabase.from("wishlist_items").update({ votes: next }).eq("id", item.id);
    if (error) toast.error("Couldn't save vote");
  }

  async function toggleGot(item: Item) {
    const next = !item.got_it;
    const { error } = await supabase
      .from("wishlist_items")
      .update({ got_it: next, claimed_by: next ? me?.id ?? null : null })
      .eq("id", item.id);
    if (error) toast.error("Couldn't update");
    else toast.success(next ? "Marked as got 💝" : "Back on the list");
  }

  async function removeItem(item: Item) {
    if (item.owner_id !== me?.id) return toast.error("Only the owner can remove this");
    if (!confirm(`Remove "${item.title}"?`)) return;
    const { error } = await supabase.from("wishlist_items").delete().eq("id", item.id);
    if (error) toast.error("Couldn't delete");
  }

  return (
    <div className="relative min-h-screen px-5 pt-10 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 aurora-bg" />

      <div className="flex items-center justify-between mb-6">
        <Link to="/app" className="inline-flex items-center gap-2 text-sm text-candle-muted hover:text-candle transition">
          <ArrowLeft className="size-4" /> Home
        </Link>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-petal text-velvet text-xs font-medium uppercase tracking-[0.24em] hover:brightness-110 transition"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[10px] uppercase tracking-[0.32em] text-petal">
          <Gift className="size-3.5" /> Shared wishlist
        </div>
        <h1 className="font-serif text-4xl italic mt-3">Things we love</h1>
        <p className="text-candle-muted text-sm mt-1">
          Add ideas, gifts, dreams. Love it, pass, or celebrate when it comes true.
        </p>
      </header>

      <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-none">
        {(["all", "matched", "open", "got"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.24em] transition whitespace-nowrap ${
              filter === f
                ? "bg-petal text-velvet"
                : "glass text-candle-muted hover:text-candle"
            }`}
          >
            {f === "matched" ? "Both loved" : f === "got" ? "Got it 💝" : f === "open" ? "Awaiting vote" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-candle-muted text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <Sparkles className="size-6 text-petal mx-auto mb-2" />
          <p className="font-serif italic text-lg">Nothing here yet</p>
          <p className="text-candle-muted text-sm mt-1">Add the first idea and see if your panda agrees.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((item) => {
            const votes = item.votes ?? {};
            const mineVote = me ? votes[me.id] : undefined;
            const partnerVote = partner ? votes[partner.id] : undefined;
            const matched = mineVote === 1 && partnerVote === 1;
            return (
              <div
                key={item.id}
                className={`relative glass-strong rounded-3xl p-4 transition ${
                  matched ? "ring-1 ring-petal/60" : ""
                } ${item.got_it ? "opacity-70" : ""}`}
              >
                {matched && !item.got_it && (
                  <div className="absolute -top-2 left-4 px-2.5 py-0.5 rounded-full bg-petal text-velvet text-[9px] uppercase tracking-[0.28em]">
                    ♥ Both loved
                  </div>
                )}
                <div className="flex gap-4">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt=""
                      className="size-20 rounded-2xl object-cover shrink-0 border border-petal/20"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-serif text-lg leading-tight ${item.got_it ? "line-through" : ""}`}>
                        {item.title}
                      </h3>
                      {item.owner_id === me?.id && (
                        <button onClick={() => removeItem(item)} className="text-candle-muted hover:text-rose-400 transition">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    {item.note && <p className="text-sm text-candle-muted mt-1 line-clamp-2">{item.note}</p>}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-petal mt-1 hover:underline"
                      >
                        <LinkIcon className="size-3" /> Open link
                      </a>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={() => vote(item, 1)}
                        disabled={item.got_it}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition ${
                          mineVote === 1
                            ? "bg-petal text-velvet"
                            : "glass text-candle-muted hover:text-petal"
                        }`}
                      >
                        <Heart className="size-3.5" /> Love
                      </button>
                      <button
                        onClick={() => vote(item, -1)}
                        disabled={item.got_it}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition ${
                          mineVote === -1
                            ? "bg-surface text-candle-muted ring-1 ring-candle-muted/40"
                            : "glass text-candle-muted hover:text-candle"
                        }`}
                      >
                        <ThumbsDown className="size-3.5" /> Pass
                      </button>

                      <div className="ml-auto flex items-center gap-1.5">
                        {partner && (
                          <div className="relative">
                            <AvatarImg
                              src={partner.avatar_url}
                              alt={partner.display_name}
                              className="size-7 rounded-full object-cover border border-petal/30"
                            />
                            <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">
                              {partnerVote === 1 ? "❤️" : partnerVote === -1 ? "🙅" : "…"}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => toggleGot(item)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-[0.24em] transition ${
                            item.got_it
                              ? "bg-petal/20 text-petal"
                              : "glass text-candle-muted hover:text-petal"
                          }`}
                        >
                          <Check className="size-3" /> {item.got_it ? "Got" : "Mark got"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && me && (
        <AddWishItem
          meId={me.id}
          partnerId={partner?.id ?? null}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function AddWishItem({ meId, partnerId, onClose }: { meId: string; partnerId: string | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const initialVotes: VoteMap = { [meId]: 1 };
    const { error } = await supabase.from("wishlist_items").insert({
      owner_id: meId,
      partner_id: partnerId,
      title: title.trim(),
      note: note.trim() || null,
      url: url.trim() || null,
      image_url: imageUrl.trim() || null,
      priority: 0,
      votes: initialVotes,
    });
    setSaving(false);
    if (error) return toast.error("Couldn't add");
    toast.success("Added ✨");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 border border-petal/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-2xl italic">Add wish</h2>
          <button onClick={onClose} className="text-candle-muted hover:text-candle">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-surface/60 border border-petal/20 text-sm outline-none focus:border-petal/60"
          />
          <textarea
            placeholder="Why do you want it?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-2xl bg-surface/60 border border-petal/20 text-sm outline-none focus:border-petal/60 resize-none"
          />
          <input
            placeholder="Link (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-surface/60 border border-petal/20 text-sm outline-none focus:border-petal/60"
          />
          <input
            placeholder="Image URL (optional)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-surface/60 border border-petal/20 text-sm outline-none focus:border-petal/60"
          />
        </div>
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="w-full mt-5 py-3 rounded-full bg-petal text-velvet text-xs font-medium uppercase tracking-[0.28em] disabled:opacity-50 hover:brightness-110 transition"
        >
          {saving ? "Saving…" : "Add to wishlist"}
        </button>
      </div>
    </div>
  );
}
