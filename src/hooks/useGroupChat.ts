import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { expirySeconds, type MessageRow } from "@/lib/chat";

const PAGE_SIZE = 500;

function isLiveMessage(m: MessageRow) {
  return !m.expires_at || new Date(m.expires_at).getTime() > Date.now();
}

function sortMessages(rows: MessageRow[]) {
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function mergeMessages(current: MessageRow[], incoming: MessageRow[]) {
  const byId = new Map<string, MessageRow>();
  for (const row of current) byId.set(row.id, row);
  for (const row of incoming) if (isLiveMessage(row)) byId.set(row.id, row);
  return sortMessages(Array.from(byId.values()));
}

export function useGroupChat(meId: string | null, groupId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<number | null>(null);

  const fetchMessages = useCallback(
    async (before?: string) => {
      if (!meId || !groupId) return { rows: [] as MessageRow[], more: false };
      const { data, error } = await (supabase.rpc as any)("chat_group_messages", {
        _group_id: groupId,
        _before: before ?? null,
        _limit: PAGE_SIZE,
      });
      if (error) throw error;
      const rawRows = (data ?? []) as unknown as MessageRow[];
      return {
        rows: sortMessages(rawRows.filter(isLiveMessage)),
        more: rawRows.length === PAGE_SIZE,
      };
    },
    [groupId, meId],
  );

  useEffect(() => {
    if (!meId || !groupId) {
      setMessages([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const page = await fetchMessages();
        if (!cancelled) {
          setMessages(page.rows);
          setHasMore(page.more);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const ch = supabase.channel(`group:${groupId}`, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });

    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (payload) => {
      const m = payload.new as unknown as MessageRow;
      setMessages((prev) => mergeMessages(prev, [m]));
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (payload) => {
      const m = payload.new as unknown as MessageRow;
      setMessages((prev) => mergeMessages(prev.filter((x) => x.id !== m.id), [m]));
    });
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (payload) => {
      const old = payload.old as { id: string };
      setMessages((prev) => prev.filter((x) => x.id !== old.id));
    });
    ch.on("broadcast", { event: "typing" }, (e) => {
      const p = e.payload as { userId: string; isTyping: boolean };
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (p.isTyping) next[p.userId] = Date.now();
        else delete next[p.userId];
        return next;
      });
    });
    ch.on("presence", { event: "sync" }, () => {
      setOnlineIds(Object.keys(ch.presenceState()));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ online_at: Date.now() });
    });
    channelRef.current = ch;

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [fetchMessages, meId, groupId]);

  const loadOlder = useCallback(async () => {
    if (!meId || !groupId || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages(messages[0].created_at);
      setMessages((prev) => mergeMessages(page.rows, prev));
      setHasMore(page.more);
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchMessages, groupId, hasMore, loadingOlder, meId, messages]);

  // Clean stale typers
  useEffect(() => {
    const t = window.setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) if (now - v < 4000) next[k] = v;
        return next;
      });
    }, 1500);
    return () => window.clearInterval(t);
  }, []);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      const ch = channelRef.current;
      if (!ch || !meId) return;
      const now = Date.now();
      if (isTyping && now - lastTypingSent.current < 1500) return;
      lastTypingSent.current = now;
      ch.send({ type: "broadcast", event: "typing", payload: { userId: meId, isTyping } });
      if (isTyping) {
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => {
          ch.send({ type: "broadcast", event: "typing", payload: { userId: meId, isTyping: false } });
        }, 3000);
      }
    },
    [meId],
  );

  const send = useCallback(
    async (input: {
      content?: string;
      type?: string;
      media_url?: string | null;
      media_meta?: Record<string, unknown> | null;
      reply_to_id?: string | null;
      disappear_seconds?: number | null;
    }) => {
      if (!meId || !groupId) return;
      const now = new Date().toISOString();
      const expires_at = expirySeconds(input.disappear_seconds ?? null);
      const draft: MessageRow = {
        id: crypto.randomUUID(),
        sender_id: meId,
        receiver_id: null,
        group_id: groupId,
        content: input.content ?? "",
        type: (input.type ?? "text") as never,
        created_at: now,
        media_url: input.media_url ?? null,
        media_meta: input.media_meta ?? null,
        reply_to_id: input.reply_to_id ?? null,
        reactions: {},
        read_at: null,
        pinned: false,
        expires_at,
      };
      setMessages((prev) => mergeMessages(prev, [draft]));

      const insertPayload = {
        sender_id: meId,
        receiver_id: null,
        group_id: groupId,
        content: draft.content,
        type: draft.type as never,
        media_url: draft.media_url,
        media_meta: (draft.media_meta ?? null) as never,
        reply_to_id: draft.reply_to_id,
        expires_at,
      };
      const { data, error } = await supabase.from("messages").insert(insertPayload).select("*").single();
      if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== draft.id));
        throw error;
      }
      if (data) {
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== draft.id), [data as unknown as MessageRow]));
      }
    },
    [meId, groupId],
  );

  const react = useCallback(
    async (m: MessageRow, emoji: string) => {
      if (!meId) return;
      const reactions = { ...(m.reactions ?? {}) } as Record<string, string[]>;
      const list = reactions[emoji] ?? [];
      reactions[emoji] = list.includes(meId) ? list.filter((x) => x !== meId) : [...list, meId];
      if (reactions[emoji].length === 0) delete reactions[emoji];
      await supabase.from("messages").update({ reactions }).eq("id", m.id);
    },
    [meId],
  );

  const togglePin = useCallback(async (m: MessageRow) => {
    await supabase.from("messages").update({ pinned: !m.pinned }).eq("id", m.id);
  }, []);

  const remove = useCallback(async (m: MessageRow) => {
    await supabase.from("messages").delete().eq("id", m.id);
  }, []);

  const setVanish = useCallback(async (m: MessageRow, seconds: number | null) => {
    const expires_at = seconds ? new Date(Date.now() + seconds * 1000).toISOString() : null;
    await supabase.from("messages").update({ expires_at }).eq("id", m.id);
  }, []);

  // Reap expired messages (real vanish)
  useEffect(() => {
    if (!meId) return;
    const tick = () => {
      const now = Date.now();
      const expired = messages.filter((m) => m.expires_at && new Date(m.expires_at).getTime() <= now);
      if (expired.length === 0) return;
      setMessages((prev) => prev.filter((x) => !expired.some((e) => e.id === x.id)));
      const mineIds = expired.filter((m) => m.sender_id === meId).map((m) => m.id);
      if (mineIds.length) supabase.from("messages").delete().in("id", mineIds).then();
    };
    tick();
    const t = window.setInterval(tick, 5000);
    return () => window.clearInterval(t);
  }, [messages, meId]);

  return { messages, loading, loadingOlder, hasMore, loadOlder, typingUsers, onlineIds, send, sendTyping, react, togglePin, remove, setVanish };
}
