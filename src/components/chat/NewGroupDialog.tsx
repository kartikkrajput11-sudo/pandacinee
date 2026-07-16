import { useState } from "react";
import { X, Heart, Check } from "lucide-react";
import { toast } from "sonner";
import { useFriendships, type FriendProfile } from "@/hooks/useFriends";
import { useCreateGroup } from "@/hooks/useGroups";
import { useProfile } from "@/hooks/useProfile";
import { AvatarImg } from "@/components/AvatarImg";

const AVATAR_EMOJIS = ["💜", "🐼", "🌸", "🌙", "🍿", "🎬", "🦋", "🍓", "🌈", "🪐"];

export function NewGroupDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { data: profileData } = useProfile();
  const { data: friendsData } = useFriendships();
  const create = useCreateGroup();
  const me = profileData?.profile;
  const partnerId = me?.partner_id ?? null;

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💜");
  const [selected, setSelected] = useState<Set<string>>(new Set(partnerId ? [partnerId] : []));

  const friendships = friendsData?.friendships ?? [];
  const profiles = friendsData?.profiles ?? {};
  const acceptedIds = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => (f.requester_id === me?.id ? f.addressee_id : f.requester_id));

  const rows: (FriendProfile & { isPartner: boolean })[] = [];
  if (partnerId && profiles[partnerId]) rows.push({ ...profiles[partnerId], isPartner: true });
  acceptedIds.forEach((id) => {
    if (id !== partnerId && profiles[id]) rows.push({ ...profiles[id], isPartner: false });
  });

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!name.trim()) return toast.error("Give your group a name");
    if (selected.size === 0) return toast.error("Add at least one friend");
    try {
      const g = await create.mutateAsync({
        name: name.trim(),
        memberIds: Array.from(selected),
        avatar_url: emoji,
      });
      toast.success("Group created");
      onCreated?.(g.id);
      onClose();
      setName("");
      setSelected(new Set(partnerId ? [partnerId] : []));
    } catch (e: any) {
      toast.error(e.message ?? "Could not create group");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-velvet border border-border rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-petal">Group</p>
            <h2 className="font-serif italic text-2xl">New circle</h2>
          </div>
          <button onClick={onClose} className="size-9 rounded-full bg-surface border border-border text-candle-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-3 items-center mb-4">
          <div className="size-14 rounded-full bg-petal-soft border border-petal/30 flex items-center justify-center text-2xl">
            {emoji}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={40}
            className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 text-sm text-candle"
          />
        </div>

        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {AVATAR_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`size-9 rounded-full flex items-center justify-center text-lg shrink-0 transition ${
                emoji === e ? "bg-petal text-velvet scale-110" : "bg-surface border border-border"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <h3 className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">
          Members · {selected.size}
        </h3>

        {rows.length === 0 && (
          <p className="text-sm text-candle-muted py-4 text-center">
            Add friends first to invite them.
          </p>
        )}

        <div className="space-y-1.5">
          {rows.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition border ${
                  on
                    ? p.isPartner
                      ? "bg-petal-soft border-petal/40"
                      : "bg-surface border-petal/30"
                    : "bg-surface/40 border-transparent hover:bg-surface"
                }`}
              >
                <div className={`relative size-10 rounded-full bg-petal-soft flex items-center justify-center overflow-hidden ${p.isPartner ? "ring-2 ring-petal petal-glow" : ""}`}>
                  {p.avatar_url ? (
                    <AvatarImg src={p.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="font-serif italic text-petal">{p.display_name?.[0]?.toUpperCase()}</span>
                  )}
                  {p.isPartner && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-petal text-velvet flex items-center justify-center">
                      <Heart className="size-2 fill-current" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className={`font-serif italic text-base truncate ${p.isPartner ? "text-petal" : ""}`}>
                    {p.display_name}
                    {p.isPartner && <span className="ml-1.5 text-[9px] uppercase tracking-widest text-petal">partner</span>}
                  </p>
                  <p className="text-xs text-candle-muted truncate">@{p.username}</p>
                </div>
                <div className={`size-6 rounded-full flex items-center justify-center border ${on ? "bg-petal border-petal text-velvet" : "border-border"}`}>
                  {on && <Check className="size-3.5" />}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={submit}
          disabled={create.isPending}
          className="w-full mt-5 py-3.5 bg-petal text-velvet rounded-full font-semibold disabled:opacity-50"
        >
          {create.isPending ? "Creating…" : "Create group"}
        </button>
      </div>
    </div>
  );
}
