import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { expirySeconds, type MessageRow } from "@/lib/chat";

export function useGroupChat(meId: string | null, groupId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!meId || !groupId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("group_id", groupId)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: true })
        .limit(400);
      if (!cancelled && data) setMessages(data as unknown as MessageRow[]);
      setLoading(false);
    })();

    const ch = supabase.channel(`group:${groupId}`, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });

    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (payload) => {
      const m = payload.new as unknown as MessageRow;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (payload) => {
      const m = payload.new as unknown as MessageRow;
      setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
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
  }, [meId, groupId]);

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
      const { error } = await supabase.from("messages").insert({
        sender_id: meId,
        receiver_id: null,
        group_id: groupId,
        content: input.content ?? "",
        type: (input.type ?? "text") as never,
        media_url: input.media_url ?? null,
        media_meta: (input.media_meta ?? null) as never,
        reply_to_id: input.reply_to_id ?? null,
        expires_at: expirySeconds(input.disappear_seconds ?? null),
      });
      if (error) throw error;
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

  return { messages, loading, typingUsers, onlineIds, send, sendTyping, react, togglePin, remove, setVanish };
}
