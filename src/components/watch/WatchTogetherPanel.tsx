import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle,
  Send,
  X,
  Sparkles,
  Smile,
  Popcorn,
  Film,
  Trash2,
  Clock,
} from "lucide-react";
import { useMovieChat } from "@/hooks/useMovieChat";
import { STICKERS } from "@/lib/chat";
import type { Profile } from "@/hooks/useProfile";

const QUICK_PHRASES = [
  { emoji: "🍿", text: "Pass the popcorn!" },
  { emoji: "😱", text: "WAIT WHAT?!" },
  { emoji: "💜", text: "This scene is us." },
  { emoji: "😭", text: "I'm crying." },
  { emoji: "🎬", text: "Best scene so far!" },
  { emoji: "🥰", text: "Watching with you 🫶" },
];

function fmtClock(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

export function WatchTogetherPanel({
  me,
  partner,
  movieId,
  movieTitle,
  moviePoster,
  mediaType = "movie",
  inline = false,
}: {
  me: Profile;
  partner: Profile;
  movieId: number;
  movieTitle: string;
  moviePoster?: string | null;
  mediaType?: "movie" | "tv";
  inline?: boolean;
}) {
  const [open, setOpen] = useState(inline);
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState<null | "stickers" | "phrases">(null);
  const [opacityMode, setOpacityMode] = useState<"blur" | "clear" | "solid">("blur");
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [floaters, setFloaters] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const floaterId = useRef(0);

  const { messages, send, remove, sendTyping, partnerTyping, partnerPresent } =
    useMovieChat(me.id, partner.id, movieId, mediaType);

  // Unread while closed
  const [lastSeen, setLastSeen] = useState(0);
  useEffect(() => {
    if (open) setLastSeen(messages.length);
  }, [open, messages.length]);
  const unread = useMemo(() => {
    if (open) return 0;
    return messages.slice(lastSeen).filter((m) => m.sender_id === partner.id).length;
  }, [messages, lastSeen, open, partner.id]);

  useEffect(() => {
    setText("");
    setPickerOpen(null);
    setLastSeen(0);
  }, [movieId, mediaType]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open]);

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
    setPickerOpen(null);
    inputRef.current?.focus();
  }

  async function sendPhrase(p: { emoji: string; text: string }) {
    await send(`${p.emoji} ${p.text}`, "text");
    setPickerOpen(null);
  }

  const partnerFirst = partner.display_name.split(" ")[0];

  // Track fullscreen element so the floating chat stays visible when the player goes fullscreen.
  const [fsEl, setFsEl] = useState<Element | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setFsEl(document.fullscreenElement);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const REACTIONS = ["❤️", "😂", "😱", "🔥", "🥹", "🍿", "👏", "💜"];
  function spawnFloater(emoji: string) {
    const id = ++floaterId.current;
    const x = 20 + Math.random() * 60;
    setFloaters((f) => [...f, { id, emoji, x }]);
    window.setTimeout(() => setFloaters((f) => f.filter((it) => it.id !== id)), 3000);
  }
  function burstReaction(emoji: string) {
    spawnFloater(emoji);
    send(emoji, "sticker").catch(() => {});
  }

  // When partner sends a sticker (reaction), float it on our screen too.
  const lastStickerRef = useRef<string | null>(null);
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender_id !== partner.id || m.type !== "sticker") continue;
      if (lastStickerRef.current === m.id) break;
      lastStickerRef.current = m.id;
      spawnFloater(m.content);
      break;
    }
    // Prime on first mount so we don't burst historical stickers
    if (lastStickerRef.current === null && messages.length > 0) {
      lastStickerRef.current = messages[messages.length - 1].id;
    }
  }, [messages, partner.id]);

  const content = (
    <>
      {/* Floating reaction emojis rising over the screen */}
      {floaters.length > 0 && (
        <div className="fixed inset-0 z-[45] pointer-events-none overflow-hidden">
          {floaters.map((f) => (
            <span
              key={f.id}
              className="absolute bottom-24 text-4xl animate-float-up drop-shadow-lg"
              style={{ left: `${f.x}%` }}
            >
              {f.emoji}
            </span>
          ))}
        </div>
      )}

      {/* Draggable stack: chat FAB (top) + Reactions (bottom, fullscreen only) */}
      {!inline && (
        <DraggableFab>
          {/* Chat toggle */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="group block"
            aria-label={open ? "Close discussion" : "Open discussion"}
          >
            <span
              className={`relative flex items-center justify-center size-11 rounded-full transition-all duration-300 shadow-2xl ${
                open
                  ? "bg-velvet border border-petal/50 shadow-black/40"
                  : "bg-petal shadow-petal/40 hover:scale-105"
              }`}
            >
              {!open && (
                <span aria-hidden className="absolute inset-0 rounded-full bg-petal/40 blur-xl -z-10 group-hover:bg-petal/60 transition" />
              )}
              {open ? (
                <X className="size-4 text-petal" />
              ) : (
                <MessageCircle className="size-5 text-velvet fill-velvet/10" />
              )}
              {!open && unread > 0 && (
                <>
                  <span aria-hidden className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 animate-ping opacity-75" />
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-velvet shadow-lg">
                    {unread > 9 ? "9+" : unread}
                  </span>
                </>
              )}
              {!open && partnerPresent && unread === 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-green-400 border-2 border-velvet" />
              )}
            </span>
          </button>

          {/* Reactions — fullscreen only, sits UNDER the chat FAB */}
          {fsEl && (
            <div className="mt-3 flex flex-col items-center gap-2">
              {reactionsOpen && (
                <div className="flex flex-col items-center gap-2 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 px-2 py-3 shadow-2xl animate-fade-in">
                  {REACTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => burstReaction(e)}
                      className="text-2xl leading-none hover:scale-125 active:scale-95 transition-transform"
                      aria-label={`React ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setReactionsOpen((o) => !o)}
                aria-label="Instant reactions"
                className="font-serif italic text-sm tracking-[0.2em] text-white/90 px-3 py-1 rounded-full bg-black/30 backdrop-blur-xl border border-white/15 shadow-lg hover:text-white hover:border-white/30 transition-all"
              >
                {reactionsOpen ? "close" : "Reactions"}
              </button>
            </div>
          )}
        </DraggableFab>
      )}

      {/* No dimming backdrop — keep the video visible while chatting */}

      {/* Drawer — inline (under the player) or floating bottom-sheet */}
      <div
        className={
          inline
            ? "w-full"
            : `fixed z-40 inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[22rem]
          transition-all duration-300 ease-out
          ${open ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`
        }
      >
        <div className={`${inline ? "rounded-2xl" : "mx-2 sm:mx-0 rounded-t-3xl sm:rounded-3xl"} ${
          inline
            ? "bg-velvet/95 backdrop-blur-xl"
            : opacityMode === "blur"
              ? "bg-velvet/55 backdrop-blur-2xl backdrop-saturate-150"
              : opacityMode === "clear"
                ? "bg-velvet/20 backdrop-blur-sm"
                : "bg-velvet/95 backdrop-blur-xl"
        } border border-petal/25 shadow-[0_-30px_80px_-20px_rgba(238,130,175,0.35)] flex flex-col ${inline ? "h-[560px]" : "max-h-[55vh]"} overflow-hidden`}>
          {/* Grabber (only in floating mode) */}
          {!inline && (
            <div className="pt-2 pb-1 flex justify-center sm:hidden">
              <span className="w-10 h-1 rounded-full bg-candle-muted/40" />
            </div>
          )}

          {/* Header */}
          <header className="px-4 pt-2 pb-3 flex items-center gap-3 border-b border-border/50">
            <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface border border-border shrink-0 shadow-lg">
              {moviePoster ? (
                <img src={moviePoster} alt={movieTitle} className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center">
                  <Film className="size-4 text-candle-muted" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase tracking-[0.3em] text-petal">Scene notes</p>
              <p className="font-serif italic text-base truncate text-candle">{movieTitle}</p>
              <p className="text-[10px] text-candle-muted truncate flex items-center gap-1.5 mt-0.5">
                <span className={`size-1.5 rounded-full ${partnerPresent ? "bg-green-400 animate-pulse" : "bg-candle-muted/60"}`} />
                {partnerTyping
                  ? <span className="text-petal">{partnerFirst} is typing…</span>
                  : partnerPresent
                  ? <>with <span className="text-candle">{partnerFirst}</span> · live</>
                  : `${partnerFirst} hasn't joined yet`}
              </p>
            </div>
            {/* Opacity mode toggle — Blur / Clear / Solid */}
            {!inline && (
              <div className="flex items-center rounded-full bg-surface/60 border border-border p-0.5 mr-1">
                {(["blur", "clear", "solid"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setOpacityMode(m)}
                    className={`h-6 px-2 rounded-full text-[9px] uppercase tracking-widest transition ${
                      opacityMode === m ? "bg-petal text-velvet font-semibold" : "text-candle-muted hover:text-candle"
                    }`}
                    aria-label={`${m} background`}
                  >
                    {m === "blur" ? "Blur" : m === "clear" ? "Clear" : "Solid"}
                  </button>
                ))}
              </div>
            )}
            {!inline && (
              <button
                onClick={() => setOpen(false)}
                className="size-8 rounded-full bg-surface/70 border border-border flex items-center justify-center text-candle-muted hover:text-petal"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            )}
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
            {messages.length === 0 && (
              <div className="text-center py-10 text-xs text-candle-muted">
                <div className="mx-auto mb-3 size-14 rounded-full bg-petal/15 border border-petal/30 flex items-center justify-center">
                  <Sparkles className="size-5 text-petal" />
                </div>
                <p className="font-serif italic text-candle text-base mb-1">Start whispering</p>
                <p className="text-[11px] opacity-70 max-w-[16rem] mx-auto leading-relaxed">
                  These notes are for <span className="text-petal">{movieTitle}</span> only — they vanish when you leave this room.
                </p>
              </div>
            )}
            {messages.map((m, i) => {
              const mine = m.sender_id === me.id;
              const prev = messages[i - 1];
              const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
              return (
                <div key={m.id}>
                  {showTime && (
                    <div className="flex justify-center my-2">
                      <span className="text-[9px] uppercase tracking-widest text-candle-muted/60 flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {fmtClock(m.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`group flex ${mine ? "justify-end" : "justify-start"} animate-fade-up`}>
                    <div className={`max-w-[82%] flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                      {mine && (
                        <button
                          onClick={() => remove(m.id)}
                          className="opacity-0 group-hover:opacity-100 text-candle-muted hover:text-rose-400 transition p-1"
                          title="Delete"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                      {m.type === "sticker" ? (
                        <span className="text-5xl select-none drop-shadow-[0_2px_10px_rgba(238,130,175,0.4)]">{m.content}</span>
                      ) : (
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-sm leading-snug ${
                            mine
                              ? "bg-petal text-velvet rounded-br-md shadow-lg shadow-petal/20"
                              : "bg-surface-elevated text-candle rounded-bl-md border border-border"
                          }`}
                        >
                          {m.content}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {partnerTyping && (
              <div className="flex gap-1 px-3 py-1 items-center">
                <div className="px-3 py-2 rounded-2xl bg-surface-elevated border border-border flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-petal animate-bounce" />
                  <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="size-1.5 rounded-full bg-petal animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Picker overlay */}
          {pickerOpen && (
            <div className="border-t border-border/50 bg-velvet/80 backdrop-blur px-3 py-3 max-h-56 overflow-y-auto">
              {pickerOpen === "stickers" ? (
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
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PHRASES.map((p) => (
                    <button
                      key={p.text}
                      onClick={() => sendPhrase(p)}
                      className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-surface border border-border hover:border-petal hover:bg-petal/10 transition text-left"
                    >
                      <span className="text-xl">{p.emoji}</span>
                      <span className="text-sm text-candle">{p.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Composer */}
          <form onSubmit={submit} className="p-2.5 border-t border-border/50 flex items-center gap-2 bg-velvet/60">
            <button
              type="button"
              onClick={() => setPickerOpen(pickerOpen === "stickers" ? null : "stickers")}
              className={`size-10 rounded-full border flex items-center justify-center transition shrink-0 ${
                pickerOpen === "stickers"
                  ? "bg-petal text-velvet border-petal"
                  : "bg-surface border-border text-candle-muted hover:text-petal"
              }`}
              aria-label="Stickers"
            >
              <Smile className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(pickerOpen === "phrases" ? null : "phrases")}
              className={`size-10 rounded-full border flex items-center justify-center transition shrink-0 ${
                pickerOpen === "phrases"
                  ? "bg-petal text-velvet border-petal"
                  : "bg-surface border-border text-candle-muted hover:text-petal"
              }`}
              aria-label="Quick phrases"
            >
              <Popcorn className="size-4" />
            </button>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                sendTyping(e.target.value.length > 0);
              }}
              placeholder={`Whisper about ${movieTitle.slice(0, 24)}${movieTitle.length > 24 ? "…" : ""}`}
              className="flex-1 min-w-0 h-10 px-4 rounded-full bg-surface border border-border text-candle text-sm outline-none focus:border-petal placeholder:text-candle-muted/60"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center disabled:opacity-40 hover:scale-105 transition shrink-0 shadow-lg shadow-petal/30"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return fsEl && !inline ? createPortal(content, fsEl) : content;
}

/** Draggable floating container. Long-press or hold on the handle to move. */
function DraggableFab({ children }: { children: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: rect.left,
      oy: rect.top,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && !pos) return;
    const nx = Math.max(8, Math.min(window.innerWidth - 80, dragRef.current.ox + dx));
    const ny = Math.max(8, Math.min(window.innerHeight - 80, dragRef.current.oy + dy));
    setPos({ x: nx, y: ny });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 16, bottom: 96 };

  return (
    <div
      ref={containerRef}
      className="fixed z-40 flex flex-col items-center select-none touch-none"
      style={style}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="mb-1.5 w-10 h-1.5 rounded-full bg-white/40 hover:bg-white/70 cursor-grab active:cursor-grabbing shadow"
        aria-label="Drag to move"
        title="Drag to move"
      />
      {children}
    </div>
  );
}
