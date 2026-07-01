import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChat } from "@/hooks/useChat";
import type { Profile } from "@/hooks/useProfile";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "🥺", "🔥", "🍿", "🐼", "💜"];

type FloatingReaction = { id: string; emoji: string; x: number };

export function WatchTogetherPanel({
  me,
  partner,
  movieId,
  movieTitle,
}: {
  me: Profile;
  partner: Profile;
  movieId: number;
  movieTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [floats, setFloats] = useState<FloatingReaction[]>([]);
  const [partnerWatching, setPartnerWatching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const roomChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { messages, send, partnerTyping, partnerOnline, sendTyping } = useChat(me.id, partner.id);

  // Presence + reactions room specific to this movie
  useEffect(() => {
    const topic = `watch-room:${movieId}:${[me.id, partner.id].sort().join(":")}`;
    const ch = supabase.channel(topic, { config: { presence: { key: me.id } } });

    ch.on("broadcast", { event: "reaction" }, ({ payload }) => {
      spawnFloat(payload.emoji as string);
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown>;
      setPartnerWatching(Boolean(state[partner.id]));
    });
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") await ch.track({ at: Date.now(), title: movieTitle });
    });
    roomChannel.current = ch;
    return () => {
      supabase.removeChannel(ch);
      roomChannel.current = null;
    };
  }, [me.id, partner.id, movieId, movieTitle]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open]);

  function spawnFloat(emoji: string) {
    const id = crypto.randomUUID();
    const x = Math.random() * 80 + 10;
    setFloats((f) => [...f, { id, emoji, x }]);
    setTimeout(() => setFloats((f) => f.filter((r) => r.id !== id)), 3200);
  }

  function react(emoji: string) {
    spawnFloat(emoji);
    roomChannel.current?.send({ type: "broadcast", event: "reaction", payload: { emoji, from: me.id } });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    sendTyping(false);
    await send({ content: t, type: "text" });
  }

  const unread = messages.filter((m) => m.sender_id === partner.id && !m.read_at).length;

  return (
    <>
      {/* Floating reactions overlay - fixed to the viewport bottom-right area */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 top-0 z-30 overflow-hidden">
        {floats.map((f) => (
          <span
            key={f.id}
            className="absolute text-3xl animate-float-up"
            style={{ left: `${f.x}%`, bottom: "10%" }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Quick reactions bar */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-[10px] uppercase tracking-widest text-candle-muted shrink-0 pr-1">
          React
        </span>
        {QUICK_REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => react(e)}
            className="shrink-0 size-9 rounded-full bg-surface border border-border text-lg hover:border-petal hover:scale-110 transition"
          >
            {e}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
          <span className={`size-1.5 rounded-full ${partnerWatching ? "bg-green-400 animate-pulse" : "bg-candle-muted"}`} />
          <span className="text-[10px] text-candle-muted">
            {partnerWatching ? `${partner.display_name.split(" ")[0]} is watching` : "Waiting…"}
          </span>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 right-4 z-40 size-14 rounded-full bg-petal text-velvet shadow-xl shadow-petal/40 flex items-center justify-center hover:scale-105 transition md:bottom-8"
        aria-label="Open watch chat"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-velvet text-petal text-[10px] font-bold flex items-center justify-center border-2 border-petal">
            {unread}
          </span>
        )}
      </button>

      {/* Chat drawer */}
      <div
        className={`fixed z-40 bg-velvet/95 backdrop-blur-xl border border-border shadow-2xl transition-transform
          bottom-0 right-0 left-0 rounded-t-3xl max-h-[75vh] flex flex-col
          md:left-auto md:bottom-4 md:right-4 md:w-96 md:rounded-3xl md:max-h-[70vh]
          ${open ? "translate-y-0" : "translate-y-[110%]"}`}
      >
        <header className="px-4 py-3 flex items-center gap-2 border-b border-border">
          <div className="size-9 rounded-full bg-petal-soft overflow-hidden flex items-center justify-center">
            {partner.avatar_url ? <img src={partner.avatar_url} alt="" className="size-full object-cover" /> : <span>🐼</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif italic text-sm truncate">Watching with {partner.display_name}</p>
            <p className="text-[10px] text-petal">
              {partnerTyping ? "typing…" : partnerOnline ? "online" : "offline"} · 🎬 {movieTitle}
            </p>
          </div>
          <button onClick={() => setOpen(false)} className="text-candle-muted p-1"><X className="size-4" /></button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {messages.length === 0 && (
            <div className="text-center py-8 text-xs text-candle-muted">
              <Heart className="size-5 mx-auto mb-2 text-petal" />
              Whisper to your panda while the movie plays 🍿
            </div>
          )}
          {messages.slice(-40).map((m) => {
            const mine = m.sender_id === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm ${
                    mine
                      ? "bg-petal text-velvet rounded-br-md"
                      : "bg-surface-elevated text-candle rounded-bl-md border border-border"
                  }`}
                >
                  {m.type === "text" ? m.content : m.type === "sticker" ? <span className="text-2xl">{m.content}</span> : "…"}
                </div>
              </div>
            );
          })}
          {partnerTyping && (
            <div className="flex gap-1 px-3">
              <span className="size-1.5 rounded-full bg-petal animate-bounce" />
              <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>

        <form onSubmit={submit} className="p-2 border-t border-border flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              sendTyping(e.target.value.length > 0);
            }}
            placeholder="Say something cozy…"
            className="flex-1 h-10 px-4 rounded-full bg-surface border border-border text-candle text-sm outline-none focus:border-petal"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}
