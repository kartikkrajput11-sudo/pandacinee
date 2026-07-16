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
  locked?: { reason: string } | null;
  lockedHint?: string | null;

  onSend: (input: {
    content?: string;
    type?: "text" | "voice" | "image" | "video" | "file" | "sticker" | "watch_invite" | "game_invite" | "kiss" | "nudge" | "whisper" | "movie_wheel";
    media_url?: string | null;
    media_meta?: Record<string, unknown> | null;
    reply_to_id?: string | null;
    disappear_seconds?: number | null;
  }) => Promise<void>;
};

export function ChatComposer({ meId, partnerName, replyTo, onClearReply, onTyping, onSend, locked, lockedHint }: Props) {
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
  const [recording, setRecording] = useState(false);

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
      // Only vanish if the user explicitly enabled disappearing messages.
      await onSend({ type: "kiss", content: emoji, reply_to_id: null, disappear_seconds: disappearSecs });
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
    }
  }

  async function sendNudge() {
    setMenuOpen(false);
    try {
      await onSend({ type: "nudge", content: `Nudged ${partnerName}!`, disappear_seconds: disappearSecs });
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
        disappear_seconds: disappearSecs,
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

  if (locked) {
    return (
      <div className="border-t border-border bg-velvet px-4 py-4 flex items-center gap-3">
        <span className="text-xl">🔒</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-petal">Chat locked</p>
          <p className="text-xs text-candle truncate">{locked.reason}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-velvet">
      {lockedHint && (
        <div className="px-4 pt-2 flex items-center gap-2 text-[11px] text-petal">
          <span>🔒</span>
          <span className="uppercase tracking-widest">{lockedHint}</span>
        </div>
      )}

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
        <div className="relative bg-[linear-gradient(180deg,rgba(30,20,35,0.92)_0%,rgba(18,12,22,0.96)_100%)] backdrop-blur-2xl overflow-hidden animate-fade-in">
          {/* Champagne hairline */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petal/50 to-transparent" />
          {/* Ambient glow */}
          <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-32 rounded-full bg-petal/10 blur-3xl" />

          <div className="relative px-5 pt-3 pb-4">
            <p className="text-[9px] uppercase tracking-[0.32em] text-candle-muted/80 font-medium text-center mb-3">
              Studio
            </p>

            {/* Section: Media */}
            <SectionLabel>Share</SectionLabel>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <StudioTile icon={<ImageIcon className="size-5" />} label="Photo" onClick={() => imgRef.current?.click()} />
              <StudioTile icon={<VideoIcon className="size-5" />} label="Video" onClick={() => vidRef.current?.click()} />
              <StudioTile icon={<Paperclip className="size-5" />} label="File" onClick={() => fileRef.current?.click()} />
              <StudioTile icon={<span className="text-xl leading-none">🐼</span>} label="Panda" onClick={() => { setPandaOpen(true); setMenuOpen(false); }} accent />
            </div>

            {/* Section: Together */}
            <SectionLabel>Together</SectionLabel>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <StudioTile icon={<Film className="size-5" />} label="Watch" onClick={() => { setWatchPickerOpen(true); setMenuOpen(false); }} accent />
              <StudioTile icon={<Gamepad2 className="size-5" />} label="Game" onClick={() => { setGamePickerOpen(true); setMenuOpen(false); }} accent />
              <StudioTile icon={<Disc3 className="size-5" />} label="Wheel" onClick={() => { setWheelOpen(true); setMenuOpen(false); }} accent />
              <StudioTile icon={<Zap className="size-5" />} label="Nudge" onClick={sendNudge} />
            </div>

            {/* Section: Affection */}
            <SectionLabel>Affection</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              <StudioTile icon={<Heart className="size-5 fill-current" />} label="Kiss" onClick={sendKiss} accent glow />
            </div>
          </div>
        </div>
      )}

      <WatchInvitePicker open={watchPickerOpen} onClose={() => setWatchPickerOpen(false)} onPick={sendWatchInvite} />
      <GameInvitePicker open={gamePickerOpen} onClose={() => setGamePickerOpen(false)} onPick={sendGameInvite} />
      <MovieWheelPicker open={wheelOpen} onClose={() => setWheelOpen(false)} onSend={sendMovieWheel} />
      <PandaStickerPicker open={pandaOpen} onClose={() => setPandaOpen(false)} onPick={sendPandaSticker} />



      <form
        onSubmit={sendText}
        className="px-3 py-3 grid items-center gap-2"
        style={{
          gridTemplateColumns: recording ? "0fr 1fr" : "1fr auto",
          transition: "grid-template-columns 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={handleVideo} />
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />

        {/* Text side — collapses to 0fr and fades left when recording */}
        <div
          className={`min-w-0 overflow-hidden flex items-center gap-2 origin-left transition-[opacity,transform] duration-300 ease-out ${
            recording ? "opacity-0 -translate-x-3 pointer-events-none" : "opacity-100 translate-x-0"
          }`}
          aria-hidden={recording}
        >
          <button
            type="button"
            onClick={() => { setMenuOpen((m) => !m); setStickersOpen(false); }}
            className="size-11 rounded-full bg-surface border border-border flex items-center justify-center text-petal shrink-0"
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
          <div className="flex-1 relative min-w-0">
            <input
              value={text}
              onChange={(e) => { setText(e.target.value); onTyping(e.target.value.length > 0); }}
              onBlur={() => onTyping(false)}
              placeholder={whisper ? `Whisper to ${partnerName}…` : `Message ${partnerName}…`}
              disabled={recording}
              className={`w-full pl-4 py-3 bg-surface border rounded-full text-sm text-candle placeholder:text-candle-muted focus:outline-none transition-colors ${
                whisper ? "border-petal/70 focus:border-petal pr-24" : "border-border focus:border-petal/60 pr-4"
              }`}
            />
            {whisper && (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] leading-none px-2 py-1 rounded-full bg-petal text-velvet shadow-[0_2px_8px_-2px_rgba(236,72,153,0.5)] flex items-center gap-1">
                🤫 <span className="tracking-wide">whisper</span>
              </span>
            )}
          </div>
        </div>

        {/* Trailing: send button OR voice recorder (single instance, morphs) */}
        <div className="min-w-0 flex items-center justify-end">
          {text.trim() && !recording ? (
            <button
              type="submit"
              disabled={sending}
              className="size-11 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow disabled:opacity-40 shrink-0"
            >
              <Send className="size-4" />
            </button>
          ) : (
            <div className={recording ? "w-full" : "w-auto"}>
              <VoiceRecorder userId={meId} onSend={handleVoiceSend} onRecordingChange={setRecording} />
            </div>
          )}
        </div>
      </form>
    </div>
  );



}
