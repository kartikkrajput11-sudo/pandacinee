import { useEffect, useRef, useState } from "react";
import {
  Plus, X, Image as ImageIcon, Paperclip, Smile, Send, Film,
  Video as VideoIcon, Gamepad2, Heart, Zap, EyeOff, Eye, Disc3,
} from "lucide-react";
import { toast } from "sonner";
import { uploadChatMedia, type MessageRow } from "@/lib/chat";
import { VoiceRecorder } from "./VoiceRecorder";
import { WatchInvitePicker } from "./WatchInvitePicker";
import { EmojiPicker } from "./EmojiPicker";
import { GameInvitePicker, type GamePick } from "./GameInvitePicker";
import { MovieWheelPicker, type WheelEntry } from "./MovieWheelPicker";
import { PandaStickerPicker } from "./PandaStickerPicker";
import { pandaStickerContent, type PandaStickerId } from "@/lib/panda-stickers";
import type { TmdbMovie } from "@/lib/tmdb.functions";

const KISS_EMOJIS = ["💋", "💜", "🌸", "🫧", "💫", "🐼", "🌷", "🫶"];


type Props = {
  meId: string;
  partnerName: string;
  replyTo: MessageRow | null;
  onClearReply: () => void;
  onTyping: (v: boolean) => void;
  onSend: (input: {
    content?: string;
    type?: "text" | "voice" | "image" | "video" | "file" | "sticker" | "watch_invite" | "game_invite" | "kiss" | "nudge" | "whisper" | "movie_wheel";
    media_url?: string | null;
    media_meta?: Record<string, unknown> | null;
    reply_to_id?: string | null;
    disappear_seconds?: number | null;
  }) => Promise<void>;
};

export function ChatComposer({ meId, partnerName, replyTo, onClearReply, onTyping, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [disappearSecs, setDisappearSecs] = useState<number | null>(null);
  const [disappearMenu, setDisappearMenu] = useState(false);
  const [watchPickerOpen, setWatchPickerOpen] = useState(false);
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [pandaOpen, setPandaOpen] = useState(false);
  const [whisper, setWhisper] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  async function sendGameInvite(g: GamePick) {
    setGamePickerOpen(false);
    setMenuOpen(false);
    try {
      await onSend({
        type: "game_invite",
        content: g.name,
        media_meta: { game_id: g.id, emoji: g.emoji, body: g.body, href: g.href },
        reply_to_id: replyTo?.id ?? null,
        disappear_seconds: disappearSecs,
      });
      onClearReply();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send invite");
    }
  }

  async function sendKiss() {
    setMenuOpen(false);
    const emoji = KISS_EMOJIS[Math.floor(Math.random() * KISS_EMOJIS.length)];
    try {
      await onSend({ type: "kiss", content: emoji, reply_to_id: null, disappear_seconds: 3600 });
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
    }
  }

  async function sendNudge() {
    setMenuOpen(false);
    try {
      await onSend({ type: "nudge", content: `Nudged ${partnerName}!`, disappear_seconds: 3600 });
      toast.success(`You nudged ${partnerName} 👋`);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't nudge");
    }
  }


  async function sendWatchInvite(movie: TmdbMovie) {
    setWatchPickerOpen(false);
    setMenuOpen(false);
    try {
      await onSend({
        type: "watch_invite",
        content: movie.title,
        media_meta: {
          tmdb_id: movie.id,
          media_type: "movie",
          poster_path: movie.poster_path,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
          overview: movie.overview,
        },
        reply_to_id: replyTo?.id ?? null,
        disappear_seconds: disappearSecs,
      });
      onClearReply();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send invite");
    }
  }

  async function sendMovieWheel(entries: WheelEntry[]) {
    setWheelOpen(false);
    setMenuOpen(false);
    const winner_index = Math.floor(Math.random() * entries.length);
    const winner = entries[winner_index];
    try {
      await onSend({
        type: "movie_wheel",
        content: `🎡 Movie wheel · ${entries.length} picks`,
        media_meta: { entries, winner_index, winner_title: winner?.title },
        reply_to_id: replyTo?.id ?? null,
        disappear_seconds: disappearSecs,
      });
      onClearReply();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send wheel");
    }
  }

  useEffect(() => {
    if (replyTo) onTyping(false);
  }, [replyTo, onTyping]);

  async function sendText(e?: React.FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText("");
    onTyping(false);
    try {
      await onSend({
        content,
        type: whisper ? "whisper" : "text",
        reply_to_id: replyTo?.id ?? null,
        disappear_seconds: whisper ? (disappearSecs ?? 3600) : disappearSecs,
      });
      onClearReply();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send");
      setText(content);
    } finally {
      setSending(false);
    }
  }

  async function sendEmoji(emoji: string, asSticker: boolean) {
    if (asSticker) {
      setStickersOpen(false);
      try {
        await onSend({
          content: emoji,
          type: "sticker",
          reply_to_id: replyTo?.id ?? null,
          disappear_seconds: disappearSecs,
        });
        onClearReply();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed");
      }
    } else {
      setText((t) => t + emoji);
    }
  }

  async function sendPandaSticker(id: PandaStickerId) {
    try {
      await onSend({
        content: pandaStickerContent(id),
        type: "sticker",
        reply_to_id: replyTo?.id ?? null,
        disappear_seconds: disappearSecs,
      });
      onClearReply();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  async function uploadAndSend(
    file: File,
    kind: "image" | "video" | "file",
    payload: (path: string) => Parameters<typeof onSend>[0],
    label: string,
  ) {
    setMenuOpen(false);
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const task = (async () => {
      const path = await uploadChatMedia(file, meId, kind, ext);
      await onSend(payload(path));
      onClearReply();
    })();
    toast.promise(task, {
      loading: `Sending ${label}…`,
      success: `${label[0].toUpperCase()}${label.slice(1)} sent`,
      error: (err: any) => err?.message ?? "Upload failed",
    });
    try { await task; } catch { /* toast already shown */ }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadAndSend(file, "image", (path) => ({
      type: "image",
      media_url: path,
      media_meta: { name: file.name, size: file.size, mime: file.type },
      reply_to_id: replyTo?.id ?? null,
      disappear_seconds: disappearSecs,
    }), "photo");
  }

  async function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) {
      toast.error("Video too large (max 60 MB)");
      return;
    }
    await uploadAndSend(file, "video", (path) => ({
      type: "video",
      media_url: path,
      media_meta: { name: file.name, size: file.size, mime: file.type },
      reply_to_id: replyTo?.id ?? null,
      disappear_seconds: disappearSecs,
    }), "video");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMenuOpen(false);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = await uploadChatMedia(file, meId, "file", ext);
      await onSend({
        type: "file",
        content: file.name,
        media_url: path,
        media_meta: { name: file.name, size: file.size, mime: file.type },
        reply_to_id: replyTo?.id ?? null,
        disappear_seconds: disappearSecs,
      });
      onClearReply();
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    }
  }

  async function handleVoiceSend(path: string, durationMs: number) {
    try {
      await onSend({
        type: "voice",
        media_url: path,
        media_meta: { duration_ms: durationMs },
        reply_to_id: replyTo?.id ?? null,
        disappear_seconds: disappearSecs,
      });
      onClearReply();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  return (
    <div className="border-t border-border bg-velvet/90 backdrop-blur">
      {replyTo && (
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border/60 bg-surface/40">
          <div className="flex-1 min-w-0 border-l-2 border-petal pl-2">
            <p className="text-[10px] uppercase tracking-widest text-petal">Replying</p>
            <p className="text-xs text-candle truncate">
              {replyTo.type === "voice" ? "🎙 Voice message" :
               replyTo.type === "image" ? "📷 Photo" :
               replyTo.type === "video" ? "🎬 Video" :
               replyTo.type === "file" ? `📎 ${replyTo.content}` :
               replyTo.content}
            </p>
          </div>
          <button onClick={onClearReply} className="text-candle-muted"><X className="size-4" /></button>
        </div>
      )}

      <EmojiPicker
        open={stickersOpen}
        onPick={(emoji, opts) => sendEmoji(emoji, opts.asSticker)}
        onClose={() => setStickersOpen(false)}
      />

      {menuOpen && (
        <div className="px-4 py-3 grid grid-cols-4 gap-2 border-b border-border/60 bg-surface/40 animate-fade-in">
          <button onClick={() => imgRef.current?.click()} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-surface border border-border text-candle hover:border-petal/50 transition-colors">
            <ImageIcon className="size-5 text-petal" />
            <span className="text-[11px]">Photo</span>
          </button>
          <button onClick={() => vidRef.current?.click()} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-surface border border-border text-candle hover:border-petal/50 transition-colors">
            <VideoIcon className="size-5 text-petal" />
            <span className="text-[11px]">Video</span>
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-surface border border-border text-candle hover:border-petal/50 transition-colors">
            <Paperclip className="size-5 text-petal" />
            <span className="text-[11px]">File</span>
          </button>
          <button
            onClick={() => { setWatchPickerOpen(true); setMenuOpen(false); }}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-petal-soft/40 border border-petal/40 text-candle"
          >
            <Film className="size-5 text-petal" />
            <span className="text-[11px]">Watch</span>
          </button>
          <button
            onClick={() => { setGamePickerOpen(true); setMenuOpen(false); }}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-petal-soft/40 border border-petal/40 text-candle"
          >
            <Gamepad2 className="size-5 text-petal" />
            <span className="text-[11px]">Game</span>
          </button>
          <button
            onClick={() => { setPandaOpen(true); setMenuOpen(false); }}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-gradient-to-br from-petal/25 to-petal-soft/50 border border-petal/40 text-candle hover:from-petal/40 transition-colors"
          >
            <span className="text-2xl leading-none">🐼</span>
            <span className="text-[11px]">Panda</span>
          </button>
          <button
            onClick={() => { setWheelOpen(true); setMenuOpen(false); }}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-gradient-to-br from-petal/30 to-petal-soft/40 border border-petal/40 text-candle hover:from-petal/50 transition-colors"
          >
            <Disc3 className="size-5 text-petal" />
            <span className="text-[11px]">Wheel</span>
          </button>
          <button
            onClick={sendKiss}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-gradient-to-br from-petal/25 to-petal-soft/40 border border-petal/40 text-candle hover:from-petal/40 transition-colors"
          >
            <Heart className="size-5 text-petal fill-petal" />
            <span className="text-[11px]">Kiss</span>
          </button>
          <button
            onClick={sendNudge}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-surface border border-border text-candle hover:border-petal/50 transition-colors"
          >
            <Zap className="size-5 text-petal" />
            <span className="text-[11px]">Nudge</span>
          </button>
          <button onClick={() => { setDisappearMenu((d) => !d); }} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-surface border border-border text-candle relative hover:border-petal/50 transition-colors">
            <Clock className="size-5 text-petal" />
            <span className="text-[11px]">{disappearSecs ? "Vanish" : "Timer"}</span>
            {disappearMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-surface-elevated border border-border rounded-2xl p-1 z-10 min-w-[120px] shadow-lg">
                {DISAPPEAR_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    onClick={(e) => { e.stopPropagation(); setDisappearSecs(o.seconds); setDisappearMenu(false); setMenuOpen(false); }}
                    className={`block w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-petal/20 ${disappearSecs === o.seconds ? "text-petal" : "text-candle"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </button>
        </div>
      )}

      <WatchInvitePicker open={watchPickerOpen} onClose={() => setWatchPickerOpen(false)} onPick={sendWatchInvite} />
      <GameInvitePicker open={gamePickerOpen} onClose={() => setGamePickerOpen(false)} onPick={sendGameInvite} />
      <MovieWheelPicker open={wheelOpen} onClose={() => setWheelOpen(false)} onSend={sendMovieWheel} />
      <PandaStickerPicker open={pandaOpen} onClose={() => setPandaOpen(false)} onPick={sendPandaSticker} />



      <form onSubmit={sendText} className="px-3 py-3 flex items-center gap-2">
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={handleVideo} />
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
        <button
          type="button"
          onClick={() => { setMenuOpen((m) => !m); setStickersOpen(false); }}
          className="size-11 rounded-full bg-surface border border-border flex items-center justify-center text-petal"
        >
          <Plus className={`size-4 transition-transform ${menuOpen ? "rotate-45" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => { setStickersOpen((s) => !s); setMenuOpen(false); }}
          className="size-11 rounded-full bg-surface border border-border flex items-center justify-center text-petal shrink-0"
        >
          <Smile className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setWhisper((w) => !w)}
          className={`size-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            whisper ? "bg-petal text-velvet petal-glow" : "bg-surface border border-border text-petal"
          }`}
          title={whisper ? "Whisper on — text arrives blurred" : "Send as whisper (blurred until tapped)"}
          aria-label="Toggle whisper mode"
        >
          {whisper ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <div className="flex-1 relative">
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); onTyping(e.target.value.length > 0); }}
            onBlur={() => onTyping(false)}
            placeholder={whisper ? `Whisper to ${partnerName}…` : `Message ${partnerName}…`}
            className={`w-full px-4 py-3 bg-surface border rounded-full text-sm text-candle placeholder:text-candle-muted focus:outline-none transition-colors ${
              whisper ? "border-petal/70 focus:border-petal" : "border-border focus:border-petal/60"
            }`}
          />
          {(disappearSecs || whisper) && (
            <span className="absolute -top-2 right-3 text-[10px] px-1.5 py-0.5 rounded-full bg-petal text-velvet">
              {whisper ? "🤫 whisper" : `⏱ ${DISAPPEAR_OPTIONS.find((o) => o.seconds === disappearSecs)?.label}`}
            </span>
          )}
        </div>
        {text.trim() ? (
          <button
            type="submit"
            disabled={sending}
            className="size-11 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        ) : (
          <VoiceRecorder userId={meId} onSend={handleVoiceSend} />
        )}
      </form>
    </div>
  );
}
