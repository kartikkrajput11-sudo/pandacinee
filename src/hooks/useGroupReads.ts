import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GroupReadRow = {
  group_id: string;
  user_id: string;
  last_read_at: string;
};

/**
 * Live "seen by" tracker for a group chat.
 * - Fetches all members' last_read_at
 * - Subscribes to realtime changes
 * - Upserts the current user's row whenever there's a newer message
 */
export function useGroupReads(groupId: string | null, meId: string | null, latestMessageAt: string | null) {
  const [reads, setReads] = useState<GroupReadRow[]>([]);
  const lastMarkedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from("group_message_reads" as never)
      .select("group_id,user_id,last_read_at")
      .eq("group_id", groupId);
    setReads(((data ?? []) as unknown) as GroupReadRow[]);
  }, [groupId]);

  useEffect(() => {
    setReads([]);
    lastMarkedRef.current = null;
    if (groupId) void load();
  }, [groupId, load]);

  // Realtime subscription for other members' reads
  useEffect(() => {
    if (!groupId) return;
    const ch = supabase
      .channel(`group-reads-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_message_reads", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as GroupReadRow | null;
          if (!row) return;
          if (payload.eventType === "DELETE") {
            setReads((prev) => prev.filter((r) => r.user_id !== row.user_id));
          } else {
            setReads((prev) => {
              const others = prev.filter((r) => r.user_id !== row.user_id);
              return [...others, row];
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [groupId]);

  // Mark read whenever a newer message arrives while viewing
  useEffect(() => {
    if (!groupId || !meId || !latestMessageAt) return;
    if (lastMarkedRef.current && lastMarkedRef.current >= latestMessageAt) return;
    lastMarkedRef.current = latestMessageAt;
    const iso = new Date().toISOString();
    void supabase
      .from("group_message_reads" as never)
      .upsert(
        { group_id: groupId, user_id: meId, last_read_at: iso } as never,
        { onConflict: "group_id,user_id" } as never,
      )
      .then(({ error }) => {
        if (error) console.warn("group read mark failed", error);
      });
  }, [groupId, meId, latestMessageAt]);

  return { reads };
}

export function seenByForMessage(
  reads: GroupReadRow[],
  messageCreatedAt: string,
  senderId: string,
  meId: string | null,
): string[] {
  const created = Date.parse(messageCreatedAt);
  return reads
    .filter((r) => r.user_id !== senderId && r.user_id !== meId && Date.parse(r.last_read_at) >= created)
    .map((r) => r.user_id);
}
