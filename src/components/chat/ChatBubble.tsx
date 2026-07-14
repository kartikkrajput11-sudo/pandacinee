import { useState } from "react";
import { Heart, Pin, Trash2, Reply, Check, CheckCheck, Download, Zap, Phone, Video as VideoIcon, PhoneMissed } from "lucide-react";
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
  onReact,
  onReply,
  onPin,
  onDelete,
}: {
  m: MessageRow;
  mine: boolean;
  replyTo: MessageRow | null;
  showAvatar: boolean;
  isLast: boolean;
  onReact: (m: MessageRow, emoji: string) => void;
  onReply: (m: MessageRow) => void;
  onPin: (m: MessageRow) => void;
  onDelete: (m: MessageRow) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);

  async function downloadFile() {
    if (!m.media_url) return;
    const u = await signMedia(m.media_url);
    if (u) window.open(u, "_blank");
  }

  const reactionsEntries = Object.entries(m.reactions ?? {}).filter(([, ids]) => ids.length > 0);

  const isSticker = m.type === "sticker";
  const isWatchInvite = m.type === "watch_invite";
  const isGameInvite = m.type === "game_invite";
  const isMovieWheel = m.type === "movie_wheel";
  const isKiss = m.type === "kiss";
  const isNudge = m.type === "nudge";
  const isWhisper = m.type === "whisper";
  const isCall = m.type === "call";
  const [whisperRevealed, setWhisperRevealed] = useState(false);

  const bare = isSticker || isWatchInvite || isGameInvite || isMovieWheel || isKiss || isNudge || isCall;

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"} mt-1.5 px-1`}>
      <div className="max-w-[80%] flex flex-col items-stretch">
        {m.pinned && (
          <div className={`text-[10px] uppercase tracking-widest text-petal flex items-center gap-1 mb-0.5 ${mine ? "justify-end" : ""}`}>
            <Pin className="size-3" /> Pinned
          </div>
        )}
        <button
          onClick={() => {
            if (isWhisper) { setWhisperRevealed((v) => !v); return; }
            setActionsOpen((o) => !o);
          }}
          className={`relative text-left rounded-2xl text-sm leading-relaxed transition-colors ${
            isSticker
              ? "bg-transparent p-0 text-6xl leading-none"
              : bare
              ? "bg-transparent p-0"
              : mine
              ? "bg-petal text-velvet rounded-br-md px-3 py-2"
              : "bg-surface-elevated text-candle rounded-bl-md border border-border px-3 py-2"
          }`}
        >
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
                 replyTo.content}
              </p>
            </div>
          )}

          {m.type === "text" && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
          {m.type === "sticker" && <span>{m.content}</span>}
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
        </button>


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

        {mine && isLast && (
          <div className="flex items-center gap-1 mt-0.5 justify-end text-[10px] text-candle-muted">
            {m.read_at ? <CheckCheck className="size-3 text-petal" /> : <Check className="size-3" />}
            <span>{m.read_at ? "Seen" : "Sent"}</span>
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
            {mine && (
              <button onClick={() => { onDelete(m); setActionsOpen(false); }} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></button>
            )}
            <button onClick={() => { onReact(m, "❤️"); setActionsOpen(false); }} className="p-1.5 rounded-lg text-petal hover:bg-petal/20"><Heart className="size-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
