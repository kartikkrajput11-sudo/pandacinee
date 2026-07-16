import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { chatChannelKey, expirySeconds, type MessageRow } from "@/lib/chat";
import { sfxSend, sfxReceive, sfxReaction } from "@/lib/sfx";

type TypingState = { isTyping: boolean; at: number };

const PAGE_SIZE = 30;

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

function isDirectMessageFor(m: MessageRow, meId: string, partnerId: string) {
  return (
    (m.sender_id === meId && m.receiver_id === partnerId) ||
    (m.sender_id === partnerId && m.receiver_id === meId)
  );
}

export function useChat(meId: string | null, partnerId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);

  const fetchMessages = useCallback(
    async (before?: string) => {
      if (!meId || !partnerId) return { rows: [] as MessageRow[], more: false };
      const { data, error } = await (supabase.rpc as any)("chat_messages_between", {
        _peer: partnerId,
        _before: before ?? null,
        _limit: PAGE_SIZE,
      });
      if (error) throw error;
      const rawRows = (data ?? []) as MessageRow[];
      return {
        rows: sortMessages(rawRows.filter(isLiveMessage)),
        more: rawRows.length === PAGE_SIZE,
      };
    },
    [meId, partnerId],
  );

  // load + realtime
  useEffect(() => {
    if (!meId || !partnerId) {
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

    const topic = `chat:${chatChannelKey(meId, partnerId)}`;
    const ch = supabase.channel(topic, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });

    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const m = payload.new as MessageRow;
      if (isDirectMessageFor(m, meId, partnerId)) {
        if (m.sender_id === partnerId) sfxReceive();
        setMessages((prev) => mergeMessages(prev, [m]));
      }
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
      const m = payload.new as MessageRow;
      setMessages((prev) => {
        if (!isDirectMessageFor(m, meId, partnerId)) return prev.filter((x) => x.id !== m.id);
        return mergeMessages(prev.filter((x) => x.id !== m.id), [m]);
      });
    });
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
      const old = payload.old as { id: string };
      setMessages((prev) => prev.filter((x) => x.id !== old.id));
    });
    ch.on("broadcast", { event: "typing" }, (e) => {
      const v = e.payload as TypingState;
      setPartnerTyping(v.isTyping);
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown>;
      setPartnerOnline(Boolean(state[partnerId]));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ online_at: Date.now() });
      }
    });
    channelRef.current = ch;

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [fetchMessages, meId, partnerId]);

  const loadOlder = useCallback(async () => {
    if (!meId || !partnerId || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages(messages[0].created_at);
      setMessages((prev) => mergeMessages(page.rows, prev));
      setHasMore(page.more);
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchMessages, hasMore, loadingOlder, meId, messages, partnerId]);

  // mark partner's unread as read
  useEffect(() => {
    if (!meId || !partnerId) return;
    const unread = messages.filter((m) => m.sender_id === partnerId && m.receiver_id === meId && !m.read_at);
    if (unread.length === 0) return;
    const ids = unread.map((m) => m.id);
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", ids).then();
  }, [messages, meId, partnerId]);

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

  const sendTyping = useCallback((isTyping: boolean) => {
    const ch = channelRef.current;
    if (!ch) return;
    const now = Date.now();
    if (isTyping && now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { isTyping, at: now } as TypingState });
    if (isTyping) {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => {
        ch.send({ type: "broadcast", event: "typing", payload: { isTyping: false, at: Date.now() } });
      }, 3000);
    }
  }, []);

  const send = useCallback(
    async (input: {
      content?: string;
      type?: "text" | "voice" | "image" | "video" | "file" | "sticker" | "watch_invite" | "game_invite" | "kiss" | "nudge" | "whisper" | "movie_wheel";
      media_url?: string | null;
      media_meta?: Record<string, unknown> | null;
      reply_to_id?: string | null;
      disappear_seconds?: number | null;
    }) => {
      if (!meId || !partnerId) return;
      const now = new Date().toISOString();
      const expires_at = expirySeconds(input.disappear_seconds ?? null);
      const draft: MessageRow = {
        id: crypto.randomUUID(),
        sender_id: meId,
        receiver_id: partnerId,
        group_id: null,
        content: input.content ?? "",
        type: input.type ?? "text",
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
        receiver_id: partnerId,
        content: draft.content,
        type: draft.type,
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
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== draft.id), [data as MessageRow]));
      }
    },
    [meId, partnerId],
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

  return { messages, loading, loadingOlder, hasMore, loadOlder, partnerTyping, partnerOnline, send, react, togglePin, remove, setVanish, sendTyping };
}
