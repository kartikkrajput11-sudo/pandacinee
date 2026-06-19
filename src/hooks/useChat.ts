import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { chatChannelKey, expirySeconds, type MessageRow } from "@/lib/chat";

type TypingState = { isTyping: boolean; at: number };

export function useChat(meId: string | null, partnerId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);

  // load + realtime
  useEffect(() => {
    if (!meId || !partnerId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${meId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${meId})`,
        )
        .order("created_at", { ascending: true })
        .limit(300);
      if (!cancelled && data) setMessages(data as MessageRow[]);
      setLoading(false);
    })();

    const topic = `chat:${chatChannelKey(meId, partnerId)}`;
    const ch = supabase.channel(topic, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });

    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const m = payload.new as MessageRow;
      if (
        (m.sender_id === meId && m.receiver_id === partnerId) ||
        (m.sender_id === partnerId && m.receiver_id === meId)
      ) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
      const m = payload.new as MessageRow;
      setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
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
  }, [meId, partnerId]);

  // mark partner's unread as read
  useEffect(() => {
    if (!meId || !partnerId) return;
    const unread = messages.filter((m) => m.sender_id === partnerId && m.receiver_id === meId && !m.read_at);
    if (unread.length === 0) return;
    const ids = unread.map((m) => m.id);
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", ids).then();
  }, [messages, meId, partnerId]);

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
      type?: "text" | "voice" | "image" | "file" | "sticker";
      media_url?: string | null;
      media_meta?: Record<string, unknown> | null;
      reply_to_id?: string | null;
      disappear_seconds?: number | null;
    }) => {
      if (!meId || !partnerId) return;
      const { error } = await supabase.from("messages").insert({
        sender_id: meId,
        receiver_id: partnerId,
        content: input.content ?? "",
        type: input.type ?? "text",
        media_url: input.media_url ?? null,
        media_meta: (input.media_meta ?? null) as never,
        reply_to_id: input.reply_to_id ?? null,
        expires_at: expirySeconds(input.disappear_seconds ?? null),
      });
      if (error) throw error;
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

  return { messages, loading, partnerTyping, partnerOnline, send, react, togglePin, remove, sendTyping };
}
