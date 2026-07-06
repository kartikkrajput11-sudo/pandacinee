import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MovieMessage = {
  id: string;
  movie_id: number;
  media_type: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: string;
  created_at: string;
};

/**
 * Per-movie chat scoped to a paired couple. Messages are isolated by
 * (movie_id, media_type) and only involve the two partners. This is
 * completely separate from the permanent partner DM (public.messages).
 */
export function useMovieChat(
  meId: string | null,
  partnerId: string | null,
  movieId: number,
  mediaType: "movie" | "tv" = "movie",
) {
  const [messages, setMessages] = useState<MovieMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerPresent, setPartnerPresent] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (!meId || !partnerId || !movieId) return;
    let cancelled = false;
    setLoading(true);
    setMessages([]);

    (async () => {
      const { data } = await supabase
        .from("movie_chat_messages")
        .select("*")
        .eq("movie_id", movieId)
        .eq("media_type", mediaType)
        .or(
          `and(sender_id.eq.${meId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${meId})`,
        )
        .order("created_at", { ascending: true })
        .limit(500);
      if (!cancelled && data) setMessages(data as MovieMessage[]);
      setLoading(false);
    })();

    const topic = `movie-chat:${mediaType}:${movieId}:${[meId, partnerId].sort().join(":")}`;
    const ch = supabase.channel(topic, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "movie_chat_messages", filter: `movie_id=eq.${movieId}` },
      (payload) => {
        const m = payload.new as MovieMessage;
        if (m.media_type !== mediaType) return;
        const inPair =
          (m.sender_id === meId && m.receiver_id === partnerId) ||
          (m.sender_id === partnerId && m.receiver_id === meId);
        if (!inPair) return;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      },
    );
    ch.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "movie_chat_messages" },
      (payload) => {
        const old = payload.old as { id: string };
        setMessages((prev) => prev.filter((x) => x.id !== old.id));
      },
    );
    ch.on("broadcast", { event: "typing" }, (e) => {
      setPartnerTyping(Boolean((e.payload as { isTyping?: boolean })?.isTyping));
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown>;
      setPartnerPresent(Boolean(state[partnerId]));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ at: Date.now(), movie_id: movieId });
    });
    channelRef.current = ch;

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [meId, partnerId, movieId, mediaType]);

  const send = useCallback(
    async (content: string, type: "text" | "sticker" = "text") => {
      if (!meId || !partnerId || !content.trim()) return;
      const { error } = await supabase.from("movie_chat_messages").insert({
        movie_id: movieId,
        media_type: mediaType,
        sender_id: meId,
        receiver_id: partnerId,
        content,
        type,
      });
      if (error) throw error;
    },
    [meId, partnerId, movieId, mediaType],
  );

  const remove = useCallback(async (id: string) => {
    await supabase.from("movie_chat_messages").delete().eq("id", id);
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    const ch = channelRef.current;
    if (!ch) return;
    const now = Date.now();
    if (isTyping && now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { isTyping } });
    if (isTyping) {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => {
        ch.send({ type: "broadcast", event: "typing", payload: { isTyping: false } });
      }, 3000);
    }
  }, []);

  return { messages, loading, send, remove, sendTyping, partnerTyping, partnerPresent };
}
