import { useMemo, useState } from "react";
import { X, Send, Search, Users, Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFriendships } from "@/hooks/useFriends";
import { useGroups } from "@/hooks/useGroups";
import { useProfile } from "@/hooks/useProfile";
import { UserAvatar } from "@/components/UserAvatar";
import type { MessageRow } from "@/lib/chat";
import { sfxSend } from "@/lib/sfx";

// Types that can be forwarded (skip presence-only, whispers, calls, punishments, etc.)
const FORWARDABLE = new Set([
  "text",
  "image",
  "video",
  "voice",
  "file",
  "sticker",
]);

export function canForward(m: Pick<MessageRow, "type">) {
  return FORWARDABLE.has(m.type);
}

type Dest =
  | { kind: "dm"; id: string; name: string; avatar_url: string | null; isPartner?: boolean }
  | { kind: "group"; id: string; name: string; avatar_url: string | null };

export function ForwardDialog({
  message,
  open,
  onClose,
}: {
  message: MessageRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: profileData } = useProfile();
  const { data: friendsData } = useFriendships();
  const { data: groupsData } = useGroups();

  const meId = profileData?.profile?.id ?? null;
  const partner = profileData?.partner ?? null;

  const [selected, setSelected] = useState<Record<string, Dest>>({});
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const destinations = useMemo<Dest[]>(() => {
    const list: Dest[] = [];
    if (partner) {
      list.push({
        kind: "dm",
        id: partner.id,
        name: partner.display_name,
        avatar_url: partner.avatar_url ?? null,
        isPartner: true,
      });
    }
    const acceptedIds = new Set<string>();
    (friendsData?.friendships ?? []).forEach((f) => {
      if (f.status !== "accepted") return;
      const otherId = f.requester_id === meId ? f.addressee_id : f.requester_id;
      if (otherId === partner?.id) return; // already listed above
      acceptedIds.add(otherId);
    });
    acceptedIds.forEach((id) => {
      const p = friendsData?.profiles?.[id];
      if (!p) return;
      list.push({ kind: "dm", id, name: p.display_name, avatar_url: p.avatar_url });
    });
    (groupsData ?? []).forEach((g) => {
      list.push({ kind: "group", id: g.group.id, name: g.group.name, avatar_url: g.group.avatar_url });
    });
    return list;
  }, [partner, friendsData, groupsData, meId]);

  const filtered = query.trim()
    ? destinations.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
    : destinations;

  if (!open || !message) return null;

  const selectedList = Object.values(selected);

  function toggle(d: Dest) {
    const key = `${d.kind}:${d.id}`;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = d;
      return next;
    });
  }

  async function forward() {
    if (!meId || !message || sending) return;
    if (selectedList.length === 0) return;
    setSending(true);
    try {
      const trimmedNote = note.trim();
      // Build the base insert payload preserving media & metadata.
      const baseMeta = (message.media_meta ?? null) as Record<string, unknown> | null;
      const meta: Record<string, unknown> = {
        ...(baseMeta ?? {}),
        forwarded_from: message.sender_id,
        forwarded_at: new Date().toISOString(),
      };
      const rows = selectedList.map((d) => ({
        sender_id: meId,
        receiver_id: d.kind === "dm" ? d.id : null,
        group_id: d.kind === "group" ? d.id : null,
        type: message.type,
        content: message.content,
        media_url: message.media_url,
        media_meta: meta as never,
        reply_to_id: null,
      }));
      const { error } = await supabase.from("messages").insert(rows);
      if (error) throw error;

      // Optional note as a follow-up text message
      if (trimmedNote) {
        const noteRows = selectedList.map((d) => ({
          sender_id: meId,
          receiver_id: d.kind === "dm" ? d.id : null,
          group_id: d.kind === "group" ? d.id : null,
          type: "text",
          content: trimmedNote,
          media_url: null,
          media_meta: null as never,
          reply_to_id: null,
        }));
        await supabase.from("messages").insert(noteRows);
      }

      sfxSend();
      toast.success(
        selectedList.length === 1
          ? `Forwarded to ${selectedList[0].name}`
          : `Forwarded to ${selectedList.length} chats`,
      );
      setSelected({});
      setNote("");
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't forward";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  const preview = messagePreview(message);

  return (
    <div className="fixed inset-0 z-[120] bg-velvet/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <p className="font-serif italic text-lg">Forward</p>
          <button onClick={onClose} className="text-candle-muted"><X className="size-5" /></button>
        </div>

        {/* Preview */}
        <div className="mx-4 mb-2 rounded-2xl border border-petal/30 bg-petal-soft/20 px-3 py-2 text-xs">
          <p className="text-[10px] uppercase tracking-widest text-petal mb-0.5">Forwarding</p>
          <p className="text-candle truncate">{preview}</p>
        </div>

        {/* Search */}
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-full bg-velvet border border-border px-3 py-1.5">
          <Search className="size-3.5 text-candle-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="flex-1 bg-transparent text-sm text-candle outline-none"
          />
        </div>

        {/* Destination list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-candle-muted py-8 italic">No chats found</p>
          ) : (
            filtered.map((d) => {
              const key = `${d.kind}:${d.id}`;
              const isSelected = !!selected[key];
              return (
                <button
                  key={key}
                  onClick={() => toggle(d)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl transition ${
                    isSelected ? "bg-petal-soft/40 border border-petal/40" : "hover:bg-velvet/40 border border-transparent"
                  }`}
                >
                  <div className="relative">
                    {d.kind === "group" ? (
                      <div className="size-10 rounded-full bg-petal-soft flex items-center justify-center text-lg border border-petal/30">
                        {d.avatar_url || "💜"}
                      </div>
                    ) : (
                      <UserAvatar src={d.avatar_url} name={d.name} className="size-10" ringed={d.isPartner} />
                    )}
                    <div className={`absolute -bottom-0.5 -right-0.5 size-4 rounded-full flex items-center justify-center ${
                      isSelected ? "bg-petal text-velvet" : "bg-surface border border-border text-transparent"
                    }`}>
                      {isSelected ? "✓" : ""}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-candle truncate flex items-center gap-1">
                      {d.name}
                      {d.isPartner && <Heart className="size-3 text-petal fill-petal" />}
                    </p>
                    <p className="text-[10px] text-candle-muted flex items-center gap-1">
                      {d.kind === "group" ? <><Users className="size-2.5" /> Group</> : "Direct message"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Composer + send */}
        {selectedList.length > 0 && (
          <div className="border-t border-border px-3 py-3 space-y-2 bg-surface/70">
            <div className="flex flex-wrap gap-1">
              {selectedList.map((d) => (
                <span
                  key={`${d.kind}:${d.id}`}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-petal-soft/60 border border-petal/40 text-candle"
                >
                  {d.kind === "group" ? "#" : "@"}{d.name}
                </span>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)…"
                className="flex-1 bg-velvet border border-border rounded-full px-3 py-2 text-sm text-candle"
              />
              <button
                onClick={forward}
                disabled={sending}
                className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center shrink-0 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function messagePreview(m: MessageRow) {
  switch (m.type) {
    case "image": return "📷 Photo";
    case "video": return "🎬 Video";
    case "voice": return "🎙 Voice note";
    case "file":  return `📎 ${m.content || "File"}`;
    case "sticker": return "🎨 Sticker";
    default: return m.content || "Message";
  }
}
