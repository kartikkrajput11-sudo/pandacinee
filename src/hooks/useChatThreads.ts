import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ThreadRow = {
  peer: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    mood: string | null;
    mood_emoji: string | null;
  };
  isPartner: boolean;
  last: {
    content: string;
    type: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread: number;
};

export function useChatThreads() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async (): Promise<ThreadRow[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const me = u.user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("partner_id")
        .eq("id", me)
        .maybeSingle();
      const partnerId = profile?.partner_id ?? null;

      const { data: fs } = await supabase
        .from("friendships")
        .select("requester_id,addressee_id,status")
        .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
        .eq("status", "accepted");
      const friendIds = (fs ?? [])
        .map((f) => (f.requester_id === me ? f.addressee_id : f.requester_id))
        .filter((id): id is string => !!id);

      const peerIds = Array.from(new Set([partnerId, ...friendIds].filter((x): x is string => !!x)));
      if (peerIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,mood,mood_emoji")
        .in("id", peerIds);
      const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id,receiver_id,content,type,created_at,read_at")
        .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
        .order("created_at", { ascending: false })
        .limit(400);

      return peerIds
        .map((pid): ThreadRow | null => {
          const p = profMap.get(pid);
          if (!p) return null;
          const peerMsgs = (msgs ?? []).filter(
            (m) =>
              (m.sender_id === me && m.receiver_id === pid) ||
              (m.sender_id === pid && m.receiver_id === me),
          );
          const last = peerMsgs[0] ?? null;
          const unread = peerMsgs.filter((m) => m.sender_id === pid && !m.read_at).length;
          return {
            peer: {
              id: p.id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              mood: (p as any).mood ?? null,
              mood_emoji: (p as any).mood_emoji ?? null,
            },
            isPartner: pid === partnerId,
            last: last
              ? {
                  content: last.content,
                  type: last.type,
                  created_at: last.created_at,
                  sender_id: last.sender_id,
                }
              : null,
            unread,
          };
        })
        .filter((x): x is ThreadRow => !!x)
        .sort((a, b) => {
          if (a.isPartner !== b.isPartner) return a.isPartner ? -1 : 1;
          const at = a.last?.created_at ?? "";
          const bt = b.last?.created_at ?? "";
          return bt.localeCompare(at);
        });
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("threads-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-threads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return q;
}
