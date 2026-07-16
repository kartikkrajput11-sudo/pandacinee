import { useEffect, useRef, useState } from "react";

function relTime(iso?: string | null) {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => {
    const i = window.setInterval(() => set((n) => n + 1), ms);
    return () => window.clearInterval(i);
  }, [ms]);
}
import { Heart, Pin, Trash2, Reply, Check, CheckCheck, Download, Zap, Phone, Video as VideoIcon, PhoneMissed, Clock } from "lucide-react";
import { signMedia, type MessageRow } from "@/lib/chat";
import { VoicePlayer } from "./VoicePlayer";
import { SignedImage } from "./SignedImage";
import { SignedVideo } from "./SignedVideo";
import { WatchInviteCard } from "./WatchInviteCard";
import { GameInviteCard } from "./GameInviteCard";
import { MovieWheelCard } from "./MovieWheelCard";
import { isPandaStickerContent, pandaStickerUrl } from "@/lib/panda-stickers";


const QUICK_REACTIONS = ["❤️", "😂", "🥺", "🔥", "🐼", "👍"];

export function ChatBubble({
  m,
  mine,
  replyTo,
  showAvatar: _showAvatar,
  isLast,
  isPartner = false,
  onReact,
  onReply,
  onPin,
  onDelete,
  onVanish,
}: {
  m: MessageRow;
  mine: boolean;
  replyTo: MessageRow | null;
  showAvatar: boolean;
  isLast: boolean;
  isPartner?: boolean;
  onReact: (m: MessageRow, emoji: string) => void;
  onReply: (m: MessageRow) => void;
  onPin: (m: MessageRow) => void;
  onDelete: (m: MessageRow) => void;
  onVanish?: (m: MessageRow, seconds: number | null) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [vanishOpen, setVanishOpen] = useState(false);

  async function downloadFile() {
    if (!m.media_url) return;
    const u = await signMedia(m.media_url);
    if (u) window.open(u, "_blank");
  }

  const reactionsEntries = Object.entries(m.reactions ?? {}).filter(([, ids]) => ids.length > 0);

  const isSticker = m.type === "sticker";
  const pandaUrl = isSticker ? pandaStickerUrl(m.content ?? "") : null;
  const isPandaSticker = !!pandaUrl;
  const isWatchInvite = m.type === "watch_invite";
  const isGameInvite = m.type === "game_invite";
  const isMovieWheel = m.type === "movie_wheel";
  const isKiss = m.type === "kiss";
  const isNudge = m.type === "nudge";
  const isWhisper = m.type === "whisper";
  const isCall = m.type === "call";
  const [whisperRevealed, setWhisperRevealed] = useState(false);
  useTick(30000);

  const bare = isSticker || isWatchInvite || isGameInvite || isMovieWheel || isKiss || isNudge || isCall;

  // ---- Gestures: long-press for actions, swipe for reply, double-tap for heart ----
  const [dragX, setDragX] = useState(0);
  const [heartPop, setHeartPop] = useState(0);
  const gesture = useRef({ startX: 0, startY: 0, moved: false, longPressed: false, lastTapAt: 0, singleTapTimer: 0 });
  const longPressTimer = useRef<number | null>(null);
  const clearLongPress = () => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const isInteractiveTarget = (t: EventTarget | null) =>
    !!(t as HTMLElement | null)?.closest?.("button, a, input, textarea, [data-no-gesture]");

  const dragXRef = useRef(0);
  const onPointerDown = (e: React.PointerEvent) => {
    if (isInteractiveTarget(e.target)) return;
    gesture.current.startX = e.clientX;
    gesture.current.startY = e.clientY;
    gesture.current.moved = false;
    gesture.current.longPressed = false;
    dragXRef.current = 0;
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch {}
    clearLongPress();
    // Only use long-press for touch/pen. Mouse users have right-click / hover.
    if (e.pointerType !== "mouse") {
      longPressTimer.current = window.setTimeout(() => {
        if (gesture.current.moved) return;
        gesture.current.longPressed = true;
        setActionsOpen(true);
        if ("vibrate" in navigator) navigator.vibrate?.(30);
      }, 500);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const dx = e.clientX - gesture.current.startX;
    const dy = e.clientY - gesture.current.startY;
    if (!gesture.current.moved && Math.hypot(dx, dy) > 6) {
      gesture.current.moved = true;
      clearLongPress();
    }
    if (gesture.current.moved && Math.abs(dx) > Math.abs(dy)) {
      const clamped = Math.max(-100, Math.min(100, dx));
      dragXRef.current = clamped;
      setDragX(clamped);
    }
  };
  const onPointerUp = () => {
    clearLongPress();
    const wasLP = gesture.current.longPressed;
    const moved = gesture.current.moved;
    const dx = dragXRef.current;
    dragXRef.current = 0;
    setDragX(0);
    if (wasLP) return;
    if (moved) {
      // Right swipe = reply. Left swipe = peek timestamp (no commit).
      if (dx > 45) {
        onReply(m);
        if ("vibrate" in navigator) navigator.vibrate?.(20);
      }
      return;
    }
    // Tap
    const now = Date.now();
    if (now - gesture.current.lastTapAt < 300) {
      if (gesture.current.singleTapTimer) window.clearTimeout(gesture.current.singleTapTimer);
      gesture.current.singleTapTimer = 0;
      gesture.current.lastTapAt = 0;
      onReact(m, "❤️");
      setHeartPop((n) => n + 1);
      if ("vibrate" in navigator) navigator.vibrate?.(15);
    } else {
      gesture.current.lastTapAt = now;
      gesture.current.singleTapTimer = window.setTimeout(() => {
        if (isWhisper) setWhisperRevealed((v) => !v);
        gesture.current.singleTapTimer = 0;
      }, 260);
    }
  };
  const onPointerCancel = () => { clearLongPress(); setDragX(0); };
  const onContextMenu = (e: React.MouseEvent) => {
    if (isInteractiveTarget(e.target)) return;
    e.preventDefault();
    setActionsOpen(true);
  };

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"} mt-1.5 px-1 relative`}>
      {dragX > 0 && (
        <div
          className="absolute top-1/2 -translate-y-1/2 left-3 size-8 rounded-full bg-petal/20 border border-petal/40 flex items-center justify-center text-petal pointer-events-none"
          style={{ opacity: Math.min(1, dragX / 50) }}
        >
          <Reply className="size-4" />
        </div>
      )}
      {dragX < 0 && (
        <div
          className="absolute top-1/2 -translate-y-1/2 right-3 text-[10px] text-candle-muted whitespace-nowrap pointer-events-none"
          style={{ opacity: Math.min(1, Math.abs(dragX) / 40) }}
        >
          {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          {m.read_at && <span className="ml-1 text-petal">· seen {relTime(m.read_at)}</span>}
        </div>
      )}
      <div
        className="max-w-[80%] flex flex-col items-stretch select-none"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragX === 0 ? "transform 200ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={onContextMenu}
      >
        {m.pinned && (
          <div className={`text-[10px] uppercase tracking-widest text-petal flex items-center gap-1 mb-0.5 ${mine ? "justify-end" : ""}`}>
            <Pin className="size-3" /> Pinned
          </div>
        )}
        <div
          className={`relative text-left rounded-2xl text-sm leading-relaxed transition-colors ${
            isPandaSticker
              ? "bg-transparent p-0"
              : isSticker
              ? "bg-transparent p-0 text-6xl leading-none"
              : bare
              ? "bg-transparent p-0"
              : mine
              ? "bg-petal text-velvet rounded-br-md px-3 py-2"
              : isPartner
              ? "bg-gradient-to-br from-petal-soft/70 to-surface-elevated text-candle rounded-bl-md border border-petal/50 px-3.5 py-2 font-partner text-[15px] animate-partner-glow"
              : "bg-surface-elevated text-candle rounded-bl-md border border-border px-3 py-2"
          }`}
        >
          {heartPop > 0 && (
            <span
              key={heartPop}
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl animate-pulse-soft"
              style={{ animation: "heartPop 700ms ease-out forwards" }}
            >
              ❤️
            </span>
          )}
          {replyTo && (
            <div className={`mb-1.5 px-2 py-1 rounded-lg text-xs border-l-2 ${mine ? "bg-velvet/20 border-velvet/40" : "bg-petal/10 border-petal/60"}`}>
              <p className="opacity-70 truncate">
                {replyTo.type === "voice" ? "🎙 Voice" :
                 replyTo.type === "image" ? "📷 Photo" :
                 replyTo.type === "video" ? "🎬 Video" :
                 replyTo.type === "file" ? `📎 ${replyTo.content}` :
                 replyTo.type === "game_invite" ? `🎮 ${replyTo.content}` :
                 replyTo.type === "movie_wheel" ? "🎡 Movie wheel" :
                 replyTo.type === "kiss" ? "💋 kiss" :
                 replyTo.type === "whisper" ? "🤫 whisper" :
                 replyTo.type === "sticker" && isPandaStickerContent(replyTo.content) ? "🐼 Sticker" :
                 replyTo.content}
              </p>
            </div>
          )}

          {m.type === "text" && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
          {m.type === "sticker" && (
            isPandaSticker ? (
              <img
                src={pandaUrl!}
                alt="Panda sticker"
                loading="lazy"
                width={512}
                height={512}
                className="w-40 h-40 sm:w-48 sm:h-48 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)] select-none"
                draggable={false}
              />
            ) : (
              <span>{m.content}</span>
            )
          )}
          {isWatchInvite && <WatchInviteCard m={m} mine={mine} />}
          {isGameInvite && <GameInviteCard m={m} mine={mine} />}
          {isMovieWheel && <MovieWheelCard m={m} mine={mine} />}

          {isKiss && (
            <div className={`px-4 py-3 rounded-2xl border ${mine ? "border-velvet/30 bg-velvet/10 text-velvet" : "border-petal/40 bg-petal-soft/30 text-candle"} flex items-center gap-3`}>
              <span className="text-4xl animate-pulse-soft">{m.content || "💋"}</span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Kiss</p>
                <p className="text-xs">{mine ? "You sent a kiss" : "You got a kiss"}</p>
              </div>
            </div>
          )}

          {isNudge && (
            <div className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2 ${mine ? "border-velvet/30 bg-velvet/10 text-velvet" : "border-petal/40 bg-petal-soft/30 text-candle"}`}>
              <Zap className="size-4 text-petal" />
              <span className="text-xs font-medium">{mine ? "You sent a nudge 👋" : "Nudged you! 👋"}</span>
            </div>
          )}

          {isCall && (() => {
            const meta = (m.media_meta ?? {}) as { mode?: "video" | "audio"; outcome?: "missed" | "completed"; duration_sec?: number };
            const missed = meta.outcome === "missed";
            const isVideo = meta.mode === "video";
            const Icon = missed ? PhoneMissed : isVideo ? VideoIcon : Phone;
            const dur = meta.duration_sec ?? 0;
            const durText = dur > 0
              ? `${Math.floor(dur / 60).toString().padStart(2, "0")}:${(dur % 60).toString().padStart(2, "0")}`
              : "";
            const label = missed
              ? mine ? `You called · no answer` : `Missed ${isVideo ? "video" : "voice"} call`
              : `${isVideo ? "Video" : "Voice"} call`;
            return (
              <div className={`px-3.5 py-2 rounded-2xl border flex items-center gap-2.5 ${
                missed
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : mine
                    ? "border-velvet/30 bg-velvet/10 text-velvet"
                    : "border-border bg-surface-elevated text-candle"
              }`}>
                <div className={`size-8 rounded-full flex items-center justify-center ${missed ? "bg-red-500/20" : "bg-petal/20"}`}>
                  <Icon className={`size-4 ${missed ? "text-red-300" : "text-petal"}`} />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-medium">{label}</span>
                  {!missed && durText && (
                    <span className="text-[10px] opacity-70 tabular-nums">{durText}</span>
                  )}
                </div>
              </div>
            );
          })()}


          {isWhisper && (
            <div className="relative">
              <p
                className={`whitespace-pre-wrap break-words select-none transition-all duration-300 ${
                  whisperRevealed ? "blur-0" : "blur-md"
                }`}
              >
                {m.content}
              </p>
              {!whisperRevealed && (
                <span className={`absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-[0.25em] pointer-events-none ${mine ? "text-velvet/70" : "text-petal"}`}>
                  🤫 tap to reveal
                </span>
              )}
            </div>
          )}

          {m.type === "voice" && m.media_url && (
            <VoicePlayer path={m.media_url} durationMs={(m.media_meta as any)?.duration_ms} />
          )}
          {m.type === "image" && m.media_url && (
            <SignedImage path={m.media_url} className="rounded-xl max-w-[240px] max-h-[320px] object-cover" />
          )}
          {m.type === "video" && m.media_url && (
            <SignedVideo path={m.media_url} />
          )}
          {m.type === "file" && (
            <div className="flex items-center gap-2" onClick={(e) => { e.stopPropagation(); downloadFile(); }}>
              <div className="size-9 rounded-full bg-velvet/20 flex items-center justify-center">
                <Download className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.content}</p>
                <p className="text-[10px] opacity-70">{Math.round(((m.media_meta as any)?.size ?? 0) / 1024)} KB</p>
              </div>
            </div>
          )}
        </div>


        {reactionsEntries.length > 0 && (
          <div className={`flex gap-1 mt-1 ${mine ? "justify-end" : ""}`}>
            {reactionsEntries.map(([e, ids]) => (
              <button
                key={e}
                onClick={() => onReact(m, e)}
                className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border"
              >
                {e} {ids.length > 1 && ids.length}
              </button>
            ))}
          </div>
        )}

        {mine ? (
          isLast && (
            <div className="flex items-center gap-1 mt-0.5 justify-end text-[10px] text-candle-muted">
              {m.read_at ? <CheckCheck className="size-3 text-petal" /> : <Check className="size-3" />}
              <span>
                {m.read_at ? `Seen ${relTime(m.read_at)}` : `Sent ${relTime(m.created_at)}`}
              </span>
            </div>
          )
        ) : (
          <div className="mt-0.5 text-[10px] text-candle-muted">
            {relTime(m.created_at)}
          </div>
        )}

        {m.expires_at && (
          <p className={`text-[10px] text-candle-muted mt-0.5 ${mine ? "text-right" : ""}`}>
            ⏱ vanishes {new Date(m.expires_at).toLocaleString()}
          </p>
        )}

        {actionsOpen && (
          <div className={`mt-1 flex gap-1 flex-wrap p-2 rounded-2xl bg-surface-elevated border border-border ${mine ? "self-end" : ""}`}>
            {QUICK_REACTIONS.map((e) => (
              <button key={e} onClick={() => { onReact(m, e); setActionsOpen(false); }} className="text-lg hover:scale-125 transition-transform">{e}</button>
            ))}
            <div className="w-px bg-border mx-1" />
            <button onClick={() => { onReply(m); setActionsOpen(false); }} className="p-1.5 rounded-lg text-candle hover:bg-petal/20"><Reply className="size-4" /></button>
            <button onClick={() => { onPin(m); setActionsOpen(false); }} className="p-1.5 rounded-lg text-candle hover:bg-petal/20"><Pin className="size-4" /></button>
            {mine && onVanish && (
              <button
                onClick={() => setVanishOpen((v) => !v)}
                className={`p-1.5 rounded-lg hover:bg-petal/20 ${m.expires_at ? "text-petal" : "text-candle"}`}
                title="Vanish after…"
              >
                <Clock className="size-4" />
              </button>
            )}
            {mine && (
              <button onClick={() => { onDelete(m); setActionsOpen(false); }} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></button>
            )}
            <button onClick={() => { onReact(m, "❤️"); setActionsOpen(false); }} className="p-1.5 rounded-lg text-petal hover:bg-petal/20"><Heart className="size-4" /></button>
          </div>
        )}

        {actionsOpen && vanishOpen && mine && onVanish && (
          <div className={`mt-1 flex gap-1 flex-wrap p-2 rounded-2xl bg-surface-elevated border border-petal/40 ${mine ? "self-end" : ""}`}>
            <span className="text-[10px] uppercase tracking-widest text-petal self-center px-1">Vanish in</span>
            {[
              { label: "10s", s: 10 },
              { label: "1m", s: 60 },
              { label: "5m", s: 300 },
              { label: "1h", s: 3600 },
              { label: "1d", s: 86400 },
              { label: "7d", s: 604800 },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => { onVanish(m, o.s); setVanishOpen(false); setActionsOpen(false); }}
                className="px-2 py-1 text-xs rounded-lg bg-surface border border-border text-candle hover:border-petal/60"
              >
                {o.label}
              </button>
            ))}
            {m.expires_at && (
              <button
                onClick={() => { onVanish(m, null); setVanishOpen(false); setActionsOpen(false); }}
                className="px-2 py-1 text-xs rounded-lg text-destructive hover:bg-destructive/10"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
