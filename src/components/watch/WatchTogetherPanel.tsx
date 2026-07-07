import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  X,
  Heart,
  Sparkles,
  Smile,
  Popcorn,
  Volume2,
  VolumeX,
  Minimize2,
  Pause,
  Play as PlayIcon,
  Film,
  Trash2,
  GripVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMovieChat } from "@/hooks/useMovieChat";
import { STICKERS } from "@/lib/chat";
import type { Profile } from "@/hooks/useProfile";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "🥺", "🔥", "🍿", "🐼", "💜"];
const QUICK_PHRASES = [
  { emoji: "🍿", text: "Pass the popcorn!" },
  { emoji: "😱", text: "WAIT WHAT?!" },
  { emoji: "💜", text: "This scene is us." },
  { emoji: "⏸️", text: "Pause — bathroom break" },
  { emoji: "😭", text: "I'm crying." },
  { emoji: "🎬", text: "Best scene so far!" },
  { emoji: "🤔", text: "Rewind that?" },
  { emoji: "🥰", text: "Watching with you 🫶" },
];

type FloatingReaction = { id: string; emoji: string; x: number };
type Tab = "chat" | "stickers" | "phrases";

export function WatchTogetherPanel({
  me,
  partner,
  movieId,
  movieTitle,
  moviePoster,
  mediaType = "movie",
}: {
  me: Profile;
  partner: Profile;
  movieId: number;
  movieTitle: string;
  moviePoster?: string | null;
  mediaType?: "movie" | "tv";
}) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [text, setText] = useState("");
  const [floats, setFloats] = useState<FloatingReaction[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const roomChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastCountRef = useRef(0);

  const { messages, send, remove, sendTyping, partnerTyping, partnerPresent } =
    useMovieChat(me.id, partner.id, movieId, mediaType);

  // Presence + ambient reactions for this movie room (ephemeral broadcast)
  useEffect(() => {
    const topic = `watch-room:${mediaType}:${movieId}:${[me.id, partner.id].sort().join(":")}`;
    const ch = supabase.channel(topic, { config: { presence: { key: me.id } } });

    ch.on("broadcast", { event: "reaction" }, ({ payload }) => {
      spawnFloat(payload.emoji as string);
    });
    ch.on("broadcast", { event: "control" }, ({ payload }) => {
      const action = payload?.action as string;
      if (action === "pause") spawnFloat("⏸️");
      if (action === "play") spawnFloat("▶️");
    });
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") await ch.track({ at: Date.now(), title: movieTitle });
    });
    roomChannel.current = ch;
    return () => {
      supabase.removeChannel(ch);
      roomChannel.current = null;
    };
  }, [me.id, partner.id, movieId, mediaType, movieTitle]);

  // Reset chat state when the movie changes
  useEffect(() => {
    setText("");
    setTab("chat");
    lastCountRef.current = 0;
  }, [movieId, mediaType]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open, tab]);

  useEffect(() => {
    const prev = lastCountRef.current;
    lastCountRef.current = messages.length;
    if (!soundOn || prev === 0 || messages.length <= prev) return;
    const last = messages[messages.length - 1];
    if (last?.sender_id !== partner.id) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.start(); o.stop(ctx.currentTime + 0.4);
    } catch { /* ignore */ }
  }, [messages, partner.id, soundOn]);

  function spawnFloat(emoji: string) {
    const id = crypto.randomUUID();
    const x = Math.random() * 80 + 10;
    setFloats((f) => [...f, { id, emoji, x }]);
    setTimeout(() => setFloats((f) => f.filter((r) => r.id !== id)), 3200);
  }

  function broadcastReaction(emoji: string) {
    spawnFloat(emoji);
    roomChannel.current?.send({ type: "broadcast", event: "reaction", payload: { emoji, from: me.id } });
  }

  function sendControl(action: "pause" | "play") {
    roomChannel.current?.send({ type: "broadcast", event: "control", payload: { action, from: me.id } });
    spawnFloat(action === "pause" ? "⏸️" : "▶️");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    sendTyping(false);
    await send(t, "text");
  }

  async function sendSticker(emoji: string) {
    await send(emoji, "sticker");
    setTab("chat");
  }

  async function sendPhrase(p: { emoji: string; text: string }) {
    await send(`${p.emoji} ${p.text}`, "text");
    setTab("chat");
  }

  const unread = 0; // ephemeral movie chat — no persisted read receipts
  const partnerFirst = partner.display_name.split(" ")[0];
  const viewerCount = 1 + (partnerPresent ? 1 : 0);

  return (
    <>
      {/* Floating reactions overlay */}
      <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {floats.map((f) => (
          <span
            key={f.id}
            className="absolute text-4xl animate-float-up drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            style={{ left: `${f.x}%`, bottom: "8%" }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Quick reactions bar under the player */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <span className="text-[10px] uppercase tracking-widest text-candle-muted shrink-0 pr-1">
          React
        </span>
        {QUICK_REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => broadcastReaction(e)}
            className="shrink-0 size-9 rounded-full bg-surface border border-border text-lg hover:border-petal hover:scale-110 active:scale-95 transition"
          >
            {e}
          </button>
        ))}
        <button
          onClick={() => sendControl("pause")}
          className="shrink-0 h-9 px-3 rounded-full bg-surface border border-border text-[11px] text-candle-muted hover:border-petal flex items-center gap-1"
        >
          <Pause className="size-3" /> Pause
        </button>
        <button
          onClick={() => sendControl("play")}
          className="shrink-0 h-9 px-3 rounded-full bg-surface border border-border text-[11px] text-candle-muted hover:border-petal flex items-center gap-1"
        >
          <PlayIcon className="size-3" /> Play
        </button>
        <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
          <span className={`size-1.5 rounded-full ${partnerPresent ? "bg-green-400 animate-pulse" : "bg-candle-muted"}`} />
          <span className="text-[10px] text-candle-muted">
            {partnerPresent ? `${partnerFirst} is here` : "Waiting…"}
          </span>
        </div>
      </div>

      {/* Minimized pill */}
      {open && minimized && (
        <button
          onClick={() => setMinimized(false)}
          className="fixed bottom-24 right-4 z-40 h-12 pl-2 pr-4 rounded-full bg-petal text-velvet shadow-xl shadow-petal/40 flex items-center gap-2 hover:scale-105 transition md:bottom-8"
        >
          <span className="size-8 rounded-full bg-velvet/20 flex items-center justify-center">
            <Film className="size-4" />
          </span>
          <span className="text-xs font-semibold truncate max-w-[10rem]">{movieTitle}</span>
        </button>
      )}

      {/* Toggle button */}
      {(!open || !minimized) && (
        <button
          onClick={() => { setOpen((o) => !o); setMinimized(false); }}
          className="fixed bottom-24 right-4 z-40 size-14 rounded-full bg-petal text-velvet shadow-xl shadow-petal/40 flex items-center justify-center hover:scale-105 transition md:bottom-8"
          aria-label="Open movie chat"
        >
          {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
          {!open && unread > 0 && (
            <span className="absolute -top-1 -right-1 size-5 rounded-full bg-velvet text-petal text-[10px] font-bold flex items-center justify-center border-2 border-petal animate-pulse">
              {unread}
            </span>
          )}
          {!open && partnerPresent && (
            <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-green-400 border-2 border-velvet" />
          )}
        </button>
      )}

      {/* Chat drawer */}
      <div
        className={`fixed z-40 bg-velvet/95 backdrop-blur-xl border border-border shadow-2xl transition-transform
          bottom-0 right-0 left-0 rounded-t-3xl max-h-[80vh] flex flex-col
          md:left-auto md:bottom-4 md:right-4 md:w-[26rem] md:rounded-3xl md:max-h-[75vh]
          ${open && !minimized ? "translate-y-0" : "translate-y-[110%]"}`}
      >
        {/* Movie-specific header */}
        <header className="px-4 py-3 flex items-center gap-3 border-b border-border bg-gradient-to-r from-petal/10 to-transparent">
          <div className="relative shrink-0">
            <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface border border-border">
              {moviePoster ? (
                <img src={moviePoster} alt={movieTitle} className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center">
                  <Film className="size-4 text-candle-muted" />
                </div>
              )}
            </div>
            <span className="absolute -top-1 -right-1 size-4 rounded-full bg-petal text-velvet text-[9px] font-bold flex items-center justify-center border-2 border-velvet">
              {viewerCount}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-widest text-petal">Movie discussion</p>
            <p className="font-serif italic text-sm truncate">{movieTitle}</p>
            <p className="text-[10px] text-candle-muted truncate flex items-center gap-1">
              <Sparkles className="size-2.5 text-petal" />
              {partnerTyping
                ? `${partnerFirst} is typing…`
                : partnerPresent
                ? `with ${partnerFirst} · live`
                : `${partnerFirst} hasn't joined yet`}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setSoundOn((s) => !s)}
              className="size-7 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted hover:text-petal"
              title={soundOn ? "Mute" : "Unmute"}
            >
              {soundOn ? <Volume2 className="size-3" /> : <VolumeX className="size-3" />}
            </button>
            <button
              onClick={() => setMinimized(true)}
              className="size-7 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted hover:text-petal"
              title="Minimize"
            >
              <Minimize2 className="size-3" />
            </button>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="size-8 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted hover:text-petal"
          >
            <X className="size-3.5" />
          </button>
        </header>

        {/* Info banner */}
        <div className="px-4 py-2 text-[10px] text-candle-muted bg-surface/40 border-b border-border/60 flex items-center gap-1.5">
          <Film className="size-3 text-petal shrink-0" />
          <span className="truncate">
            This chat is only for <span className="text-petal font-semibold">{movieTitle}</span>. Your permanent messages stay in Chat.
          </span>
        </div>

        {/* Tabs */}
        <div className="px-2 pt-2 flex items-center gap-1 border-b border-border/60">
          {([
            { id: "chat", label: "Chat", icon: MessageCircle },
            { id: "stickers", label: "Stickers", icon: Smile },
            { id: "phrases", label: "Quick", icon: Popcorn },
          ] as { id: Tab; label: string; icon: typeof MessageCircle }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 h-9 rounded-t-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition ${
                tab === t.id
                  ? "bg-petal-soft/20 text-petal border-b-2 border-petal"
                  : "text-candle-muted hover:text-candle"
              }`}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        {tab === "chat" && (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {messages.length === 0 && (
              <div className="text-center py-10 text-xs text-candle-muted">
                <Heart className="size-6 mx-auto mb-2 text-petal animate-pulse" />
                <p className="mb-1">Start the discussion for</p>
                <p className="font-serif italic text-candle mb-1">{movieTitle}</p>
                <p className="text-[10px] opacity-70">Only messages about this title live here 🍿</p>
              </div>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === me.id;
              return (
                <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"} animate-fade-up`}>
                  <div className="max-w-[82%] flex items-center gap-1">
                    {mine && (
                      <button
                        onClick={() => remove(m.id)}
                        className="opacity-0 group-hover:opacity-100 text-candle-muted hover:text-destructive transition"
                        title="Delete"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                    <div
                      className={`px-3 py-1.5 rounded-2xl text-sm ${
                        m.type === "sticker"
                          ? "bg-transparent"
                          : mine
                          ? "bg-petal text-velvet rounded-br-md"
                          : "bg-surface-elevated text-candle rounded-bl-md border border-border"
                      }`}
                    >
                      {m.type === "sticker" ? <span className="text-4xl">{m.content}</span> : m.content}
                    </div>
                  </div>
                </div>
              );
            })}
            {partnerTyping && (
              <div className="flex gap-1 px-3 py-1 items-center">
                <span className="text-[10px] text-candle-muted mr-1">{partnerFirst} is typing</span>
                <span className="size-1.5 rounded-full bg-petal animate-bounce" />
                <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        )}

        {tab === "stickers" && (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">
              Tap to send a sticker
            </p>
            <div className="grid grid-cols-6 gap-2">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendSticker(s)}
                  className="aspect-square rounded-xl bg-surface border border-border hover:border-petal hover:scale-110 active:scale-95 transition text-2xl flex items-center justify-center"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "phrases" && (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">
              Movie-night quick sends
            </p>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_PHRASES.map((p) => (
                <button
                  key={p.text}
                  onClick={() => sendPhrase(p)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-surface border border-border hover:border-petal hover:bg-petal-soft/10 transition text-left"
                >
                  <span className="text-xl">{p.emoji}</span>
                  <span className="text-sm text-candle">{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer */}
        <form onSubmit={submit} className="p-2 border-t border-border flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab(tab === "stickers" ? "chat" : "stickers")}
            className={`size-10 rounded-full border flex items-center justify-center transition ${
              tab === "stickers"
                ? "bg-petal text-velvet border-petal"
                : "bg-surface border-border text-candle-muted hover:text-petal"
            }`}
            aria-label="Stickers"
          >
            <Smile className="size-4" />
          </button>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              sendTyping(e.target.value.length > 0);
            }}
            placeholder={`Discuss ${movieTitle}…`}
            className="flex-1 h-10 px-4 rounded-full bg-surface border border-border text-candle text-sm outline-none focus:border-petal"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center disabled:opacity-40 hover:scale-105 transition"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}
