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
      // Direct messages to me
      const { count: dm } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .is("read_at", null);

      // Group messages in groups I'm a member of, not sent by me
      const { data: myGroups } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", userId);
      const groupIds = (myGroups ?? []).map((g) => g.group_id);
      let gm = 0;
      if (groupIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("group_id", groupIds)
          .neq("sender_id", userId)
          .is("read_at", null);
        gm = count ?? 0;
      }
      setCount((dm ?? 0) + gm);
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
