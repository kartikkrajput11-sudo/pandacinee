import { useEffect, useState, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AvatarImg } from "@/components/AvatarImg";

type Notice = {
  id: string;
  peerId: string;
  name: string;
  avatar: string | null;
  preview: string;
  kind: "dm" | "group";
  groupId?: string;
};

type PeerInfo = { id: string; display_name: string; username: string; avatar_url: string | null };

function previewFor(type: string, content: string): string {
  switch (type) {
    case "image": return "📷 Photo";
    case "video": return "🎬 Video";
    case "voice": return "🎙️ Voice note";
    case "file": return "📎 File";
    case "sticker": return "🌟 Sticker";
    case "kiss": return "💋 sent a kiss";
    case "hug": return "🫂 sent a hug";
    case "nudge": return "👉 Nudge!";
    case "poll": return "📊 Poll";
    default: return content?.slice(0, 80) || "New message";
  }
}

export default function PartnerMessageNotifier() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const push = (n: Notice) => {
    setNotices((cur) => [...cur, n]);
    setTimeout(() => {
      setNotices((cur) => cur.filter((x) => x.id !== n.id));
    }, 3000);
  };

  useEffect(() => {
    let cancelled = false;
    let meId: string | null = null;
    let friendIds: Set<string> = new Set();
    const peerCache = new Map<string, PeerInfo>();

    const loadPeer = async (id: string): Promise<PeerInfo | null> => {
      if (peerCache.has(id)) return peerCache.get(id)!;
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .eq("id", id)
        .maybeSingle();
      if (data) peerCache.set(id, data as PeerInfo);
      return (data as PeerInfo) ?? null;
    };

    const init = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      meId = u.user.id;

      const { data: fs } = await supabase
        .from("friendships")
        .select("requester_id,addressee_id,status")
        .or(`requester_id.eq.${meId},addressee_id.eq.${meId}`)
        .eq("status", "accepted");
      friendIds = new Set(
        (fs ?? [])
          .map((f) => (f.requester_id === meId ? f.addressee_id : f.requester_id))
          .filter((x): x is string => !!x),
      );

      // DM listener
      const dmChan = supabase
        .channel(`notify-dm-${meId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${meId}`,
          },
          async (payload) => {
            const row = payload.new as {
              id: string;
              sender_id: string;
              content: string;
              type: string;
            };
            if (!row?.sender_id || row.sender_id === meId) return;
            // Skip if user is already viewing that DM
            if (pathRef.current.startsWith(`/app/chat/${row.sender_id}`)) return;
            const peer = await loadPeer(row.sender_id);
            if (!peer) return;
            push({
              id: row.id,
              peerId: row.sender_id,
              name: peer.display_name || peer.username || "Someone",
              avatar: peer.avatar_url,
              preview: previewFor(row.type, row.content),
              kind: "dm",
            });
          },
        )
        .subscribe();

      // Group listener
      const { data: memberships } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", meId);
      const groupIds = ((memberships ?? []) as { group_id: string | null }[])
        .map((m) => m.group_id)
        .filter((x): x is string => !!x);

      const groupChannels: any[] = [];
      for (const gid of groupIds) {
        const ch = supabase
          .channel(`notify-g-${gid}-${meId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `group_id=eq.${gid}`,
            },
            async (payload) => {
              const row = payload.new as {
                id: string;
                sender_id: string;
                content: string;
                type: string;
                group_id: string;
              };
              if (!row?.sender_id || row.sender_id === meId) return;
              if (pathRef.current.startsWith(`/app/chat/group/${row.group_id}`)) return;
              // Only notify for friends/partner senders (avoid random noise)
              if (!friendIds.has(row.sender_id)) return;
              const peer = await loadPeer(row.sender_id);
              if (!peer) return;
              const { data: g } = await supabase
                .from("chat_groups")
                .select("name")
                .eq("id", row.group_id)
                .maybeSingle();
              const gName = (g as { name?: string } | null)?.name ?? "Group";
              push({
                id: row.id,
                peerId: row.sender_id,
                name: `${peer.display_name || peer.username} · ${g?.name ?? "Group"}`,
                avatar: peer.avatar_url,
                preview: previewFor(row.type, row.content),
                kind: "group",
                groupId: row.group_id,
              });
            },
          )
          .subscribe();
        groupChannels.push(ch);
      }

      (init as any)._cleanup = () => {
        supabase.removeChannel(dmChan);
        for (const c of groupChannels) supabase.removeChannel(c);
      };
    };

    init();

    return () => {
      cancelled = true;
      (init as any)._cleanup?.();
    };
  }, []);

  const openNotice = (n: Notice) => {
    if (n.kind === "group" && n.groupId) {
      navigate({ to: "/app/chat/group/$groupId", params: { groupId: n.groupId } });
    } else {
      navigate({ to: "/app/chat/$peerId", params: { peerId: n.peerId } });
    }
    setNotices((cur) => cur.filter((x) => x.id !== n.id));
  };

  if (notices.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2">
      {notices.map((n) => (
        <button
          key={n.id}
          onClick={() => openNotice(n)}
          className="pointer-events-auto group flex items-center gap-3 rounded-2xl border border-petal/30 bg-[var(--surface-elevated)]/95 px-3 py-2.5 text-left shadow-[0_10px_40px_-10px_rgba(230,180,120,0.35)] backdrop-blur-md animate-in slide-in-from-right-4 fade-in duration-300"
          style={{ animation: "slideInRight 0.35s ease-out" }}
        >
          <AvatarImg
            src={n.avatar}
            alt={n.name}
            className="h-10 w-10 shrink-0 rounded-full border border-petal/40 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-petal">
                New message
              </span>
            </div>
            <div className="truncate text-sm font-medium text-candle">{n.name}</div>
            <div className="truncate text-xs text-candle-muted">{n.preview}</div>
          </div>
        </button>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
