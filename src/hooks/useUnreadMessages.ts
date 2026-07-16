import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages() {
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchCount = async () => {
      // Distinct DM senders with at least one unread message
      const { data: dmRows } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", userId)
        .is("read_at", null)
        .is("deleted_at", null);
      const dmSenders = new Set((dmRows ?? []).map((r) => r.sender_id));

      // Groups with at least one unread message from someone else
      const { data: myGroups } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", userId);
      const groupIds = (myGroups ?? []).map((g) => g.group_id);
      const unreadGroups = new Set<string>();
      if (groupIds.length > 0) {
        const { data: gRows } = await supabase
          .from("messages")
          .select("group_id")
          .in("group_id", groupIds)
          .neq("sender_id", userId)
          .is("read_at", null)
          .is("deleted_at", null);
        for (const r of gRows ?? []) if (r.group_id) unreadGroups.add(r.group_id);
      }
      setCount(dmSenders.size + unreadGroups.size);
    };

    fetchCount();

    const channel = supabase
      .channel(`unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        () => fetchCount(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
