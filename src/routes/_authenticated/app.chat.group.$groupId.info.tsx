import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Crown, UserPlus, LogOut, BellOff, Bell, X, Check, ShieldOff, UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { useFriendships } from "@/hooks/useFriends";
import { useGroup, useLeaveGroup } from "@/hooks/useGroups";
import {
  useUpdateGroup, useSetMemberRole, useRemoveMember, useAddMembers,
  isGroupMuted, setGroupMuted, GROUP_THEMES, type GroupTheme,
} from "@/hooks/useGroupAdmin";
import { UserAvatar } from "@/components/UserAvatar";

const AVATAR_EMOJIS = ["💜", "🐼", "🌸", "🌙", "🍿", "🎬", "🦋", "🍓", "🌈", "🪐"];

export const Route = createFileRoute("/_authenticated/app/chat/group/$groupId/info")({
  component: GroupInfo,
});

function GroupInfo() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const { data: friendsData } = useFriendships();
  const { data: groupData } = useGroup(groupId);
  const update = useUpdateGroup();
  const setRole = useSetMemberRole();
  const removeMember = useRemoveMember();
  const addMembers = useAddMembers();
  const leave = useLeaveGroup();

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [addingOpen, setAddingOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [muted, setMutedState] = useState<boolean>(() => isGroupMuted(groupId));

  const me = profileData?.profile;
  const group = groupData?.group;
  const members = groupData?.members ?? [];
  const meRole = members.find((m) => m.user_id === me?.id)?.role;
  const isAdmin = meRole === "admin";

  const friendships = friendsData?.friendships ?? [];
  const profilesMap = friendsData?.profiles ?? {};
  const acceptedIds = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => (f.requester_id === me?.id ? f.addressee_id : f.requester_id));
  const memberIds = new Set(members.map((m) => m.user_id));
  const partnerId = me?.partner_id ?? null;
  const candidateIds = [
    ...(partnerId && !memberIds.has(partnerId) ? [partnerId] : []),
    ...acceptedIds.filter((id) => !memberIds.has(id) && id !== partnerId),
  ];

  if (!group) return <div className="p-6 text-candle-muted">Loading…</div>;

  async function saveName() {
    if (!nameDraft.trim()) return;
    try {
      await update.mutateAsync({ groupId, name: nameDraft });
      toast.success("Renamed");
      setRenaming(false);
    } catch (e: any) {
      toast.error(e.message ?? "Rename failed");
    }
  }

  async function pickEmoji(em: string) {
    try {
      await update.mutateAsync({ groupId, avatar_url: em });
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function pickTheme(theme: GroupTheme) {
    try {
      await update.mutateAsync({ groupId, theme });
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function toggleAdmin(userId: string, currentRole: "admin" | "member") {
    try {
      await setRole.mutateAsync({
        groupId,
        userId,
        role: currentRole === "admin" ? "member" : "admin",
      });
    } catch (e: any) {
      toast.error(e.message ?? "Role change failed");
    }
  }

  async function kick(userId: string) {
    if (!confirm("Remove this member?")) return;
    try {
      await removeMember.mutateAsync({ groupId, userId });
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function doAddMembers() {
    if (selected.size === 0) return;
    try {
      await addMembers.mutateAsync({ groupId, userIds: Array.from(selected) });
      toast.success("Added");
      setAddingOpen(false);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function doLeave() {
    if (!confirm("Leave this group?")) return;
    try {
      await leave.mutateAsync(groupId);
      toast.success("Left group");
      navigate({ to: "/app/chat" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  function toggleMute() {
    const next = !muted;
    setGroupMuted(groupId, next);
    setMutedState(next);
    toast.success(next ? "Muted" : "Unmuted");
  }

  return (
    <div className="min-h-[100dvh]" data-group-theme={group.theme}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Link to="/app/chat/group/$groupId" params={{ groupId }} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-serif italic text-xl">Group info</h1>
      </header>

      <div className="p-5 space-y-6">
        {/* Avatar + name */}
        <section className="text-center">
          <div className="size-20 mx-auto rounded-full bg-petal-soft border border-petal/30 flex items-center justify-center text-4xl mb-3">
            {group.avatar_url || "💜"}
          </div>
          {renaming ? (
            <div className="flex gap-2 justify-center items-center">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={40}
                className="bg-surface border border-border rounded-2xl px-4 py-2 text-sm text-candle text-center"
              />
              <button onClick={saveName} className="size-9 rounded-full bg-petal text-velvet flex items-center justify-center">
                <Check className="size-4" />
              </button>
              <button onClick={() => setRenaming(false)} className="size-9 rounded-full bg-surface border border-border text-candle-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              disabled={!isAdmin}
              onClick={() => { setNameDraft(group.name); setRenaming(true); }}
              className="font-serif italic text-2xl text-candle"
            >
              {group.name}
            </button>
          )}
          <p className="text-xs text-candle-muted mt-1">{members.length} members</p>
        </section>

        {/* Emoji picker (admin) */}
        {isAdmin && (
          <section>
            <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Avatar</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => pickEmoji(e)}
                  className={`size-10 rounded-full flex items-center justify-center text-lg shrink-0 transition ${
                    group.avatar_url === e ? "bg-petal text-velvet scale-110" : "bg-surface border border-border"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Theme picker */}
        <section>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {GROUP_THEMES.map((t) => {
              const active = group.theme === t.id;
              return (
                <button
                  key={t.id}
                  disabled={!isAdmin}
                  onClick={() => pickTheme(t.id)}
                  className={`p-3 rounded-2xl border text-left transition ${
                    active ? "border-petal bg-petal-soft/30" : "border-border bg-surface/40"
                  } ${!isAdmin ? "opacity-60" : ""}`}
                >
                  <div className="flex gap-1 mb-1.5">
                    {t.swatch.map((c) => (
                      <span key={c} className="size-3 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-xs font-serif italic">{t.emoji} {t.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Notifications */}
        <section>
          <button
            onClick={toggleMute}
            className="w-full flex items-center gap-3 px-4 py-3 bg-surface/60 border border-border rounded-2xl"
          >
            {muted ? <BellOff className="size-4 text-petal" /> : <Bell className="size-4 text-petal" />}
            <span className="flex-1 text-left text-sm">
              {muted ? "Notifications muted" : "Notifications on"}
            </span>
            <span className="text-xs text-candle-muted">tap to {muted ? "unmute" : "mute"}</span>
          </button>
        </section>

        {/* Members */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">Members · {members.length}</p>
            {isAdmin && candidateIds.length > 0 && (
              <button
                onClick={() => setAddingOpen(true)}
                className="text-xs text-petal flex items-center gap-1"
              >
                <UserPlus className="size-3.5" /> Add
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {members.map((m) => {
              const p = m.profile;
              const isMe = m.user_id === me?.id;
              return (
                <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface/40">
                  <UserAvatar src={p?.avatar_url} name={p?.display_name} className="size-10" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-serif italic text-sm truncate">
                        {p?.display_name ?? "…"} {isMe && <span className="text-[10px] text-candle-muted">(you)</span>}
                      </p>
                      {m.role === "admin" && <Crown className="size-3 text-petal shrink-0" />}
                    </div>
                    <p className="text-[10px] text-candle-muted truncate">@{p?.username ?? "…"}</p>
                  </div>
                  {isAdmin && !isMe && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleAdmin(m.user_id, m.role)}
                        className="size-8 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
                        aria-label={m.role === "admin" ? "Demote" : "Promote"}
                      >
                        {m.role === "admin" ? <ShieldOff className="size-3.5" /> : <Crown className="size-3.5" />}
                      </button>
                      <button
                        onClick={() => kick(m.user_id)}
                        className="size-8 rounded-full bg-surface border border-border flex items-center justify-center text-red-400"
                        aria-label="Remove"
                      >
                        <UserMinus className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Leave */}
        <section>
          <button
            onClick={doLeave}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-surface border border-border text-red-400 text-sm"
          >
            <LogOut className="size-4" /> Leave group
          </button>
        </section>
      </div>

      {/* Add members sheet */}
      {addingOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setAddingOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-velvet border border-border rounded-t-3xl sm:rounded-3xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif italic text-xl">Add members</h2>
              <button onClick={() => setAddingOpen(false)} className="size-9 rounded-full bg-surface border border-border text-candle-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            {candidateIds.length === 0 && <p className="text-sm text-candle-muted py-6 text-center">No friends to add.</p>}
            <div className="space-y-1.5">
              {candidateIds.map((id) => {
                const p = profilesMap[id];
                if (!p) return null;
                const on = selected.has(id);
                return (
                  <button
                    key={id}
                    onClick={() =>
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (n.has(id)) n.delete(id); else n.add(id);
                        return n;
                      })
                    }
                    className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border ${on ? "bg-petal-soft border-petal/40" : "bg-surface/40 border-transparent"}`}
                  >
                    <div className="size-10 rounded-full bg-petal-soft flex items-center justify-center overflow-hidden">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="size-full object-cover" /> : <span className="font-serif italic text-petal">{p.display_name?.[0]?.toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-serif italic text-sm truncate">{p.display_name}</p>
                      <p className="text-[10px] text-candle-muted truncate">@{p.username}</p>
                    </div>
                    <div className={`size-6 rounded-full flex items-center justify-center border ${on ? "bg-petal border-petal text-velvet" : "border-border"}`}>
                      {on && <Check className="size-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={doAddMembers}
              disabled={selected.size === 0 || addMembers.isPending}
              className="w-full mt-4 py-3 bg-petal text-velvet rounded-full font-semibold disabled:opacity-50"
            >
              Add {selected.size > 0 ? `· ${selected.size}` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
