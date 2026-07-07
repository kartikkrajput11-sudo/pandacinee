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
 * Per-movie EPHEMERAL chat. Nothing is stored — messages exist only for the
 * duration of the current viewing session and are delivered via Supabase
 * Realtime broadcast. Opening the same movie later shows an empty chat.
 * The permanent partner DM lives elsewhere (public.messages).
 */
export function useMovieChat(
  meId: string | null,
  partnerId: string | null,
  movieId: number,
  mediaType: "movie" | "tv" = "movie",
) {
  const [messages, setMessages] = useState<MovieMessage[]>([]);
  const [loading] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerPresent, setPartnerPresent] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (!meId || !partnerId || !movieId) return;
    // Fresh chat every time this movie opens
    setMessages([]);
    setPartnerTyping(false);
    setPartnerPresent(false);

    const topic = `movie-chat:${mediaType}:${movieId}:${[meId, partnerId].sort().join(":")}`;
    const ch = supabase.channel(topic, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "message" }, ({ payload }) => {
      const m = payload as MovieMessage;
      if (!m || m.movie_id !== movieId || m.media_type !== mediaType) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    ch.on("broadcast", { event: "delete" }, ({ payload }) => {
      const id = (payload as { id: string })?.id;
      if (!id) return;
      setMessages((prev) => prev.filter((x) => x.id !== id));
    });
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
      supabase.removeChannel(ch);
      channelRef.current = null;
      setMessages([]);
    };
  }, [meId, partnerId, movieId, mediaType]);

  const send = useCallback(
    async (content: string, type: "text" | "sticker" = "text") => {
      const ch = channelRef.current;
      if (!ch || !meId || !partnerId || !content.trim()) return;
      const msg: MovieMessage = {
        id: crypto.randomUUID(),
        movie_id: movieId,
        media_type: mediaType,
        sender_id: meId,
        receiver_id: partnerId,
        content,
        type,
        created_at: new Date().toISOString(),
      };
      // Optimistic local render
      setMessages((prev) => [...prev, msg]);
      await ch.send({ type: "broadcast", event: "message", payload: msg });
    },
    [meId, partnerId, movieId, mediaType],
  );

  const remove = useCallback(async (id: string) => {
    setMessages((prev) => prev.filter((x) => x.id !== id));
    await channelRef.current?.send({ type: "broadcast", event: "delete", payload: { id } });
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
