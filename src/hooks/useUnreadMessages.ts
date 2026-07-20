import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isGroupMessageUnread } from "@/lib/groupRead";
import { isDmMessageUnread } from "@/lib/dmRead";

export function useUnreadMessages() {
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const groupIdsRef = useRef<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    let cancelled = false;

    const fetchCount = async () => {
      const { data: dmRows } = await supabase
        .from("messages")
        .select("sender_id,created_at,read_at")
        .eq("receiver_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(400);
      if (cancelled) return;
      const dmSenders = new Set(
        (dmRows ?? [])
          .filter((r) => isDmMessageUnread(userId, r.sender_id, r.created_at, r.read_at))
          .map((r) => r.sender_id),
      );

      const { data: myGroups } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", userId);
      if (cancelled) return;
      const groupIds = (myGroups ?? []).map((g) => g.group_id);
      groupIdsRef.current = new Set(groupIds);
      const unreadGroups = new Set<string>();
      if (groupIds.length > 0) {
        const { data: gRows } = await supabase
          .from("messages")
          .select("group_id,created_at")
          .in("group_id", groupIds)
          .neq("sender_id", userId)
          .is("deleted_at", null);
        if (cancelled) return;
        for (const r of gRows ?? []) {
          if (!r.group_id) continue;
          if (isGroupMessageUnread(userId, r.group_id, r.created_at)) {
            unreadGroups.add(r.group_id);
          }
        }
      }
      if (!cancelled) setCount(dmSenders.size + unreadGroups.size);
    };

    const scheduleFetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!cancelled) fetchCount();
      }, 350);
    };

    fetchCount();

    const channel = supabase
      .channel(`unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        () => scheduleFetch(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as { group_id: string | null; sender_id: string };
          if (!row.group_id || row.sender_id === userId) return;
          if (!groupIdsRef.current.has(row.group_id)) return;
          scheduleFetch();
        },
      )
      .subscribe();

    const onRead = () => scheduleFetch();
    const onFocus = () => scheduleFetch();
    window.addEventListener("group-read-updated", onRead);
    window.addEventListener("dm-read-updated", onRead);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
      window.removeEventListener("group-read-updated", onRead);
      window.removeEventListener("dm-read-updated", onRead);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);

  return count;
}
