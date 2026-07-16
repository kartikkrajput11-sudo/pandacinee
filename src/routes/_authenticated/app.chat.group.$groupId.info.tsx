import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, type ReactNode } from "react";
import { ArrowLeft, Users, Palette, Image as ImageIcon, Search, BellOff, Bell, Crown, UserMinus, UserPlus, LogOut, Check, Pin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useGroup, useLeaveGroup } from "@/hooks/useGroups";
import {
  useUpdateGroup,
  useSetMemberRole,
  useRemoveMember,
  useAddMembers,
  isGroupMuted,
  setGroupMuted,
  GROUP_THEMES,
  type GroupTheme,
} from "@/hooks/useGroupAdmin";
import { useFriendships, type FriendProfile } from "@/hooks/useFriends";
import { signMedia } from "@/lib/chat";
import type { MessageRow } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/app/chat/group/$groupId/info")({
  component: GroupInfo,
});

type Tab = "info" | "members" | "media" | "theme";

const EMOJI_CHOICES = ["💜", "💫", "🌸", "🌙", "🔥", "🌿", "🍓", "☕", "🎧", "🫧", "✨", "🐼"];

function GroupInfo() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const { data: groupData, isLoading } = useGroup(groupId);

  const [tab, setTab] = useState<Tab>("info");

  const isAdmin = useMemo(() => {
    if (!me || !groupData) return false;
    return groupData.members.some((m) => m.user_id === me.id && m.role === "admin");
  }, [me, groupData]);

  if (isLoading || !me) return <div className="p-8 text-center text-candle-muted">Loading…</div>;
  if (!groupData) {
    return (
      <div className="p-6">
        <Link to="/app/chat" className="text-petal text-sm">← Back</Link>
        <p className="mt-6 text-candle-muted">Group not found.</p>
      </div>
    );
  }

  const { group } = groupData;

  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-10 bg-velvet border-b border-border px-4 pt-6 pb-3">
        <div className="flex items-center gap-3">
          <Link to="/app/chat/group/$groupId" params={{ groupId }} className="text-candle-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="font-serif italic text-xl leading-tight">Group settings</h1>
            <p className="text-[11px] text-candle-muted">{group.name}</p>
          </div>
        </div>
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {(
            [
              { id: "info", label: "Info", icon: <Users className="size-3.5" /> },
              { id: "members", label: "Members", icon: <Crown className="size-3.5" /> },
              { id: "media", label: "Media", icon: <ImageIcon className="size-3.5" /> },
              { id: "theme", label: "Theme", icon: <Palette className="size-3.5" /> },
            ] as { id: Tab; label: string; icon: JSX.Element }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                tab === t.id
                  ? "bg-petal text-velvet border-petal"
                  : "bg-surface border-border text-candle-muted"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "info" && (
          <InfoTab groupId={groupId} isAdmin={isAdmin} name={group.name} avatar={group.avatar_url} onLeave={() => navigate({ to: "/app/chat" })} />
        )}
        {tab === "members" && (
          <MembersTab groupId={groupId} isAdmin={isAdmin} meId={me.id} members={groupData.members} />
        )}
        {tab === "media" && <MediaTab groupId={groupId} />}
        {tab === "theme" && (
          <ThemeTab groupId={groupId} isAdmin={isAdmin} current={(group as { theme?: string }).theme as GroupTheme | undefined} />
        )}
      </div>
    </div>
  );
}

/* ─── Info tab ────────────────────────────────────────────────────────── */

function InfoTab({
  groupId,
  isAdmin,
  name,
  avatar,
  onLeave,
}: {
  groupId: string;
  isAdmin: boolean;
  name: string;
  avatar: string | null;
  onLeave: () => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftAvatar, setDraftAvatar] = useState(avatar ?? "💜");
  const update = useUpdateGroup();
  const leave = useLeaveGroup();
  const [muted, setMuted] = useState(() => isGroupMuted(groupId));
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    setDraftName(name);
    setDraftAvatar(avatar ?? "💜");
  }, [name, avatar]);

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <section className="bg-surface border border-border rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-3">Identity</p>
        <div className="flex items-start gap-3">
          <div className="size-16 rounded-2xl bg-petal-soft border border-petal/30 flex items-center justify-center text-3xl">
            {draftAvatar}
          </div>
          <div className="flex-1">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              disabled={!isAdmin}
              className="w-full bg-transparent border-b border-border focus:border-petal outline-none py-1 font-serif italic text-lg disabled:opacity-70"
            />
            <p className="text-[10px] text-candle-muted mt-1">Group name</p>
          </div>
        </div>

        {isAdmin && (
          <>
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Group emoji</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_CHOICES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setDraftAvatar(e)}
                    className={`size-10 rounded-xl border text-xl transition-transform active:scale-95 ${
                      draftAvatar === e ? "bg-petal-soft border-petal" : "bg-velvet border-border"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await update.mutateAsync({ groupId, name: draftName, avatar_url: draftAvatar });
                  toast.success("Saved");
                } catch (e) {
                  toast.error((e as Error).message ?? "Could not save");
                }
              }}
              disabled={update.isPending || (draftName === name && draftAvatar === (avatar ?? "💜"))}
              className="mt-4 w-full py-2.5 rounded-xl bg-petal text-velvet font-medium disabled:opacity-50"
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </>
        )}
      </section>

      <section className="bg-surface border border-border rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-3">Preferences</p>

        <button
          onClick={() => {
            const next = !muted;
            setGroupMuted(groupId, next);
            setMuted(next);
            toast.success(next ? "Notifications muted" : "Notifications on");
          }}
          className="w-full flex items-center justify-between py-2"
        >
          <span className="flex items-center gap-2 text-sm">
            {muted ? <BellOff className="size-4 text-candle-muted" /> : <Bell className="size-4 text-petal" />}
            Mute notifications
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${muted ? "bg-petal/20 text-petal" : "bg-surface border border-border text-candle-muted"}`}>
            {muted ? "Muted" : "On"}
          </span>
        </button>

        <button
          onClick={() => setSearchOpen((s) => !s)}
          className="w-full flex items-center justify-between py-2 border-t border-border/60 mt-1 pt-3"
        >
          <span className="flex items-center gap-2 text-sm">
            <Search className="size-4 text-candle-muted" />
            Search in this group
          </span>
        </button>
        {searchOpen && (
          <GroupSearch groupId={groupId} q={q} setQ={setQ} />
        )}
      </section>

      <button
        onClick={async () => {
          if (!confirm("Leave this group?")) return;
          try {
            await leave.mutateAsync(groupId);
            toast.success("Left group");
            onLeave();
          } catch (e) {
            toast.error((e as Error).message ?? "Could not leave");
          }
        }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-surface border border-rose-400/30 text-rose-300"
      >
        <LogOut className="size-4" />
        Leave group
      </button>
    </div>
  );
}

/* ─── Group search ─────────────────────────────────────────────────────── */

function GroupSearch({ groupId, q, setQ }: { groupId: string; q: string; setQ: (v: string) => void }) {
  const [results, setResults] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("group_id", groupId)
        .ilike("content", `%${term}%`)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!cancelled) {
        setResults((data ?? []) as unknown as MessageRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, groupId]);

  return (
    <div className="mt-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search messages…"
        className="w-full bg-velvet border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-petal"
      />
      <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
        {loading && <p className="text-xs text-candle-muted">Searching…</p>}
        {!loading && q.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs text-candle-muted">No matches.</p>
        )}
        {results.map((m) => (
          <div key={m.id} className="text-xs bg-velvet border border-border rounded-lg px-3 py-2">
            <p className="text-candle line-clamp-2">{m.content}</p>
            <p className="text-[10px] text-candle-muted mt-0.5">{new Date(m.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Members tab ─────────────────────────────────────────────────────── */

function MembersTab({
  groupId,
  isAdmin,
  meId,
  members,
}: {
  groupId: string;
  isAdmin: boolean;
  meId: string;
  members: NonNullable<ReturnType<typeof useGroup>["data"]>["members"];
}) {
  const setRole = useSetMemberRole();
  const removeM = useRemoveMember();
  const addM = useAddMembers();
  const { data: friendsData } = useFriendships();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const currentIds = new Set(members.map((m) => m.user_id));
  const addable: FriendProfile[] = useMemo(() => {
    if (!friendsData) return [];
    const friendIds = friendsData.friendships
      .filter((f) => f.status === "accepted")
      .map((f) => (f.requester_id === friendsData.me ? f.addressee_id : f.requester_id));
    return friendIds
      .filter((id) => !currentIds.has(id))
      .map((id) => friendsData.profiles[id])
      .filter((p): p is FriendProfile => !!p);
  }, [friendsData, members]);

  return (
    <div className="max-w-lg mx-auto space-y-3">
      {isAdmin && (
        <button
          onClick={() => setPicking((p) => !p)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-petal text-velvet font-medium"
        >
          <UserPlus className="size-4" />
          {picking ? "Cancel" : "Add members"}
        </button>
      )}

      {picking && (
        <div className="bg-surface border border-border rounded-2xl p-3 space-y-2">
          {addable.length === 0 && (
            <p className="text-xs text-candle-muted text-center py-4">No friends left to add.</p>
          )}
          {addable.map((p) => {
            const on = picked.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => {
                  setPicked((s) => {
                    const n = new Set(s);
                    if (on) n.delete(p.id);
                    else n.add(p.id);
                    return n;
                  });
                }}
                className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-colors ${
                  on ? "bg-petal-soft border-petal" : "bg-velvet border-border"
                }`}
              >
                <div className="size-8 rounded-full bg-petal-soft overflow-hidden flex items-center justify-center text-sm">
                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="size-full object-cover" /> : (p.display_name?.[0] ?? "?")}
                </div>
                <span className="flex-1 text-left text-sm">{p.display_name}</span>
                {on && <Check className="size-4 text-petal" />}
              </button>
            );
          })}
          {picked.size > 0 && (
            <button
              onClick={async () => {
                try {
                  await addM.mutateAsync({ groupId, userIds: Array.from(picked) });
                  toast.success(`Added ${picked.size} member${picked.size > 1 ? "s" : ""}`);
                  setPicked(new Set());
                  setPicking(false);
                } catch (e) {
                  toast.error((e as Error).message ?? "Could not add");
                }
              }}
              className="w-full py-2 rounded-xl bg-petal text-velvet text-sm font-medium"
            >
              Add {picked.size} to group
            </button>
          )}
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {members.map((m, i) => {
          const isSelf = m.user_id === meId;
          const canManage = isAdmin && !isSelf;
          return (
            <div
              key={m.user_id}
              className={`flex items-center gap-3 p-3 ${i > 0 ? "border-t border-border/60" : ""}`}
            >
              <div className="size-10 rounded-full bg-petal-soft overflow-hidden flex items-center justify-center">
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-sm font-serif italic text-petal">
                    {m.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {m.profile?.display_name ?? "Unknown"} {isSelf && <span className="text-candle-muted">(you)</span>}
                </p>
                <p className="text-[10px] text-candle-muted flex items-center gap-1">
                  {m.role === "admin" ? (
                    <>
                      <Crown className="size-3 text-amber-300" /> Admin
                    </>
                  ) : (
                    "Member"
                  )}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      try {
                        await setRole.mutateAsync({
                          groupId,
                          userId: m.user_id,
                          role: m.role === "admin" ? "member" : "admin",
                        });
                        toast.success(m.role === "admin" ? "Demoted" : "Promoted");
                      } catch (e) {
                        toast.error((e as Error).message ?? "Failed");
                      }
                    }}
                    className={`size-8 rounded-lg flex items-center justify-center border ${
                      m.role === "admin"
                        ? "bg-amber-200/20 border-amber-300/40 text-amber-200"
                        : "bg-velvet border-border text-candle-muted"
                    }`}
                    aria-label="Toggle admin"
                  >
                    <Crown className="size-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove ${m.profile?.display_name ?? "member"}?`)) return;
                      try {
                        await removeM.mutateAsync({ groupId, userId: m.user_id });
                        toast.success("Removed");
                      } catch (e) {
                        toast.error((e as Error).message ?? "Failed");
                      }
                    }}
                    className="size-8 rounded-lg flex items-center justify-center bg-velvet border border-rose-400/30 text-rose-300"
                    aria-label="Remove"
                  >
                    <UserMinus className="size-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Media tab ────────────────────────────────────────────────────────── */

function MediaTab({ groupId }: { groupId: string }) {
  const [sub, setSub] = useState<"media" | "files" | "pinned">("media");
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase
        .from("messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(120);
      if (sub === "media") q = q.in("type", ["image", "video"]);
      else if (sub === "files") q = q.eq("type", "file");
      else q = q.eq("pinned", true);
      const { data } = await q;
      if (!cancelled) {
        setRows((data ?? []) as unknown as MessageRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, sub]);

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex gap-1 mb-3">
        {(
          [
            { id: "media", label: "Media", icon: <ImageIcon className="size-3.5" /> },
            { id: "files", label: "Files", icon: <ImageIcon className="size-3.5" /> },
            { id: "pinned", label: "Pinned", icon: <Pin className="size-3.5" /> },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex-1 py-1.5 rounded-full text-xs border flex items-center justify-center gap-1 ${
              sub === t.id ? "bg-petal text-velvet border-petal" : "bg-surface border-border text-candle-muted"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-xs text-candle-muted py-8">Loading…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-center text-xs text-candle-muted py-10">Nothing here yet.</p>
      )}

      {sub === "media" && (
        <div className="grid grid-cols-3 gap-1.5">
          {rows.map((m) => (
            <MediaThumb key={m.id} row={m} />
          ))}
        </div>
      )}

      {sub !== "media" && (
        <div className="space-y-1.5">
          {rows.map((m) => (
            <div key={m.id} className="bg-surface border border-border rounded-xl px-3 py-2">
              <p className="text-sm text-candle line-clamp-2">{m.content || "(no text)"}</p>
              <p className="text-[10px] text-candle-muted mt-1">{new Date(m.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaThumb({ row }: { row: MessageRow }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!row.media_url) return;
    signMedia(row.media_url).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [row.media_url]);
  return (
    <div className="aspect-square rounded-lg bg-surface border border-border overflow-hidden">
      {url && row.type === "image" && <img src={url} alt="" className="size-full object-cover" />}
      {url && row.type === "video" && (
        <video src={url} className="size-full object-cover" muted playsInline />
      )}
    </div>
  );
}

/* ─── Theme tab ────────────────────────────────────────────────────────── */

function ThemeTab({
  groupId,
  isAdmin,
  current,
}: {
  groupId: string;
  isAdmin: boolean;
  current: GroupTheme | undefined;
}) {
  const update = useUpdateGroup();
  const active = (current ?? "aurora") as GroupTheme;

  return (
    <div className="max-w-lg mx-auto space-y-3">
      {!isAdmin && (
        <p className="text-xs text-candle-muted text-center bg-surface border border-border rounded-xl p-3">
          Only admins can change the theme.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {GROUP_THEMES.map((t) => (
          <button
            key={t.id}
            disabled={!isAdmin || update.isPending}
            onClick={async () => {
              try {
                await update.mutateAsync({ groupId, theme: t.id });
                toast.success(`Theme: ${t.label}`);
              } catch (e) {
                toast.error((e as Error).message ?? "Failed");
              }
            }}
            className={`relative aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all ${
              active === t.id ? "border-petal scale-[1.02]" : "border-border"
            } disabled:opacity-60`}
            style={{
              background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]}, ${t.swatch[2]})`,
            }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="text-3xl">{t.emoji}</span>
              <span className="text-xs font-medium text-white drop-shadow">{t.label}</span>
            </div>
            {active === t.id && (
              <span className="absolute top-2 right-2 size-6 rounded-full bg-petal text-velvet flex items-center justify-center">
                <Check className="size-3.5" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
