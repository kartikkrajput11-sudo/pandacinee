import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MessageRow } from "@/lib/chat";
import { sfxSend, sfxReceive, sfxReaction } from "@/lib/sfx";
import { markGroupReadNow, setGroupLastRead } from "@/lib/groupRead";

export type GroupMessage = MessageRow & {
  deleted_at: string | null;
  pinned_at: string | null;
  pinned_by: string | null;
};

export type ReactionRow = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export function useGroupChat(groupId: string | null, meId: string | null) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoaded = useRef(false);
  // Track current message ids in a ref so realtime handlers can filter without
  // being in the channel's useEffect dependency list (prevents resubscribe storms).
  const messageIdsRef = useRef<Set<string>>(new Set());

  const loadMessages = useCallback(async () => {
    if (!groupId) return;
    const { data, error } = await (supabase.rpc as any)("chat_group_messages", {
      _group_id: groupId,
      _before: null,
      _limit: 500,
    });
    if (error) {
      console.error("group messages load failed", error);
      setMessages([]);
      messageIdsRef.current = new Set();
    } else {
      const rows = ((data ?? []) as GroupMessage[])
        .filter((m) => !m.deleted_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      setMessages(rows);
      // Sync the id ref synchronously so reaction realtime events aren't dropped.
      messageIdsRef.current = new Set(rows.map((m) => m.id));
    }
    setLoading(false);
    initialLoaded.current = true;
  }, [groupId]);

  const loadReactions = useCallback(async () => {
    if (!groupId) return;
    const ids = Array.from(messageIdsRef.current);
    if (ids.length === 0) {
      setReactions([]);
      return;
    }
    const { data } = await supabase
      .from("message_reactions")
      .select("id,message_id,user_id,emoji")
      .in("message_id", ids);
    setReactions((data ?? []) as ReactionRow[]);
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    initialLoaded.current = false;
    setMessages([]);
    setReactions([]);
    messageIdsRef.current = new Set();
    if (meId && groupId) markGroupReadNow(meId, groupId);
    void loadMessages();
  }, [loadMessages, meId, groupId]);

  useEffect(() => {
    if (initialLoaded.current) void loadReactions();
    if (meId && groupId && messages.length > 0) {
      const latest = messages[messages.length - 1]?.created_at;
      if (latest) setGroupLastRead(meId, groupId, latest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, groupId, meId]);


  // Realtime
  useEffect(() => {
    if (!groupId) return;
    const ch = supabase
      .channel(`group-msg-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as GroupMessage;
          if (row.deleted_at) return;
          if (meId && row.sender_id !== meId) sfxReceive();
          messageIdsRef.current.add(row.id);
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },

      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as GroupMessage;
          setMessages((prev) => {
            if (row.deleted_at) return prev.filter((m) => m.id !== row.id);
            return prev.map((m) => (m.id === row.id ? row : m));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          // Only refetch if the reaction belongs to a message in this group's loaded set.
          const row: any = (payload as any).new ?? (payload as any).old;
          const mid = row?.message_id;
          if (!mid || !messageIdsRef.current.has(mid)) return;
          void loadReactions();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [groupId, meId, loadReactions]);

  const send = useCallback(
    async (input: {
      content: string;
      type?: string;
      media_url?: string | null;
      media_meta?: Record<string, unknown> | null;
      reply_to_id?: string | null;
    }) => {
      if (!meId || !groupId) throw new Error("Not ready");
      const { error } = await supabase.from("messages").insert({
        sender_id: meId,
        group_id: groupId,
        receiver_id: null,
        content: input.content,
        type: input.type ?? "text",
        media_url: input.media_url ?? null,
        media_meta: (input.media_meta ?? null) as never,
        reply_to_id: input.reply_to_id ?? null,
      });
      if (error) throw error;
      sfxSend();
    },
    [meId, groupId],
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!meId) return;
      const existing = reactions.find(
        (r) => r.message_id === messageId && r.user_id === meId && r.emoji === emoji,
      );
      if (existing) {
        await supabase.from("message_reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("message_reactions").insert({
          message_id: messageId,
          user_id: meId,
          emoji,
        });
        sfxReaction();
      }
      void loadReactions();
    },
    [meId, reactions, loadReactions],
  );

  const pin = useCallback(
    async (messageId: string, pinned: boolean) => {
      if (!meId) return;
      const { error } = await supabase
        .from("messages")
        .update({
          pinned_at: pinned ? new Date().toISOString() : null,
          pinned_by: pinned ? meId : null,
          pinned: pinned,
        })
        .eq("id", messageId);
      if (error) throw error;
    },
    [meId],
  );

  const deleteForEveryone = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) throw error;
  }, []);

  return { messages, reactions, loading, send, toggleReaction, pin, deleteForEveryone };
}
