import { useEffect, useRef, useState } from "react";
import {
  Plus, X, Image as ImageIcon, Paperclip, Smile, Send, Film,
  Video as VideoIcon, Gamepad2, Heart, HeartHandshake, Zap, EyeOff, Eye, Disc3, Sparkles, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { uploadChatMedia, type MessageRow } from "@/lib/chat";
import { VoiceRecorder } from "./VoiceRecorder";
import { WatchInvitePicker } from "./WatchInvitePicker";
import { EmojiPicker } from "./EmojiPicker";
import { GameInvitePicker, type GamePick } from "./GameInvitePicker";
import { MovieWheelPicker, type WheelEntry } from "./MovieWheelPicker";
import { PandaStickerPicker } from "./PandaStickerPicker";
import { AiStickerPicker } from "./AiStickerPicker";
import { pandaStickerContent, type PandaStickerId } from "@/lib/panda-stickers";
import type { AiStickerMood } from "@/lib/ai-stickers.functions";
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
    type?: "text" | "voice" | "image" | "video" | "file" | "sticker" | "watch_invite" | "game_invite" | "kiss" | "hug" | "nudge" | "whisper" | "movie_wheel";
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
  const [aiOpen, setAiOpen] = useState(false);
  const [whisper, setWhisper] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);
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

  async function sendHug() {
    setMenuOpen(false);
    try {
      await onSend({ type: "hug", content: `🫂 A warm hug for ${partnerName}`, disappear_seconds: disappearSecs });
      toast.success(`You hugged ${partnerName} 🫂`);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
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

  async function sendAiSticker(storagePath: string, mood: AiStickerMood) {
    setAiOpen(false);
    try {
      await onSend({
        content: `ai:${mood}`,
        type: "sticker",
        media_url: storagePath,
        media_meta: { kind: "ai_sticker", mood },
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
      media_meta: { name: file.name, size: file.size, mime: file.type, view_once: viewOnce || undefined },
      reply_to_id: replyTo?.id ?? null,
      disappear_seconds: disappearSecs,
    }), viewOnce ? "view-once photo" : "photo");
    if (viewOnce) setViewOnce(false);
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
      media_meta: { name: file.name, size: file.size, mime: file.type, view_once: viewOnce || undefined },
      reply_to_id: replyTo?.id ?? null,
      disappear_seconds: disappearSecs,
    }), viewOnce ? "view-once video" : "video");
    if (viewOnce) setViewOnce(false);
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
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petal/50 to-transparent" />
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-56 h-20 rounded-full bg-petal/10 blur-3xl" />

          <div className="relative px-3 pt-2 pb-3">
            <p className="text-[8px] uppercase tracking-[0.32em] text-candle-muted/70 font-medium text-center mb-1.5">
              Studio
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              <StudioTile icon={<ImageIcon className="size-4" />} label="Photo" onClick={() => imgRef.current?.click()} />
              <StudioTile icon={<VideoIcon className="size-4" />} label="Video" onClick={() => vidRef.current?.click()} />
              <StudioTile
                icon={<Eye className="size-4" />}
                label={viewOnce ? "Once ✓" : "View once"}
                onClick={() => {
                  const next = !viewOnce;
                  setViewOnce(next);
                  toast[next ? "success" : "message"](next ? "Next photo/video will vanish after one view" : "View-once turned off");
                }}
                accent={viewOnce}
                glow={viewOnce}
              />
              <StudioTile icon={<Paperclip className="size-4" />} label="File" onClick={() => fileRef.current?.click()} />
              <StudioTile icon={<span className="text-base leading-none">🐼</span>} label="Panda" onClick={() => { setPandaOpen(true); setMenuOpen(false); }} accent />
              <StudioTile icon={<Sparkles className="size-4" />} label="AI ✨" onClick={() => { setAiOpen(true); setMenuOpen(false); }} accent glow />
              <StudioTile icon={<Film className="size-4" />} label="Watch" onClick={() => { setWatchPickerOpen(true); setMenuOpen(false); }} accent />
              <StudioTile icon={<Gamepad2 className="size-4" />} label="Game" onClick={() => { setGamePickerOpen(true); setMenuOpen(false); }} accent />
              <StudioTile icon={<Disc3 className="size-4" />} label="Wheel" onClick={() => { setWheelOpen(true); setMenuOpen(false); }} accent />
              <StudioTile icon={<Heart className="size-4 fill-current" />} label="Kiss" onClick={sendKiss} accent glow />
              <StudioTile icon={<HeartHandshake className="size-4" />} label="Hug" onClick={sendHug} accent glow />
              <StudioTile icon={<Zap className="size-4" />} label="Nudge" onClick={sendNudge} />
            </div>
          </div>
        </div>
      )}

      <WatchInvitePicker open={watchPickerOpen} onClose={() => setWatchPickerOpen(false)} onPick={sendWatchInvite} />
      <GameInvitePicker open={gamePickerOpen} onClose={() => setGamePickerOpen(false)} onPick={sendGameInvite} />
      <MovieWheelPicker open={wheelOpen} onClose={() => setWheelOpen(false)} onSend={sendMovieWheel} />
      <PandaStickerPicker open={pandaOpen} onClose={() => setPandaOpen(false)} onPick={sendPandaSticker} />
      <AiStickerPicker open={aiOpen} onClose={() => setAiOpen(false)} onPick={sendAiSticker} />



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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-[0.28em] text-candle-muted/70 mb-2 flex items-center gap-1.5">
      <span className="h-px flex-1 max-w-4 bg-gradient-to-r from-transparent to-white/10" />
      {children}
      <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </p>
  );
}

function StudioTile({
  icon,
  label,
  onClick,
  accent,
  glow,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
  glow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl border transition-all duration-200 active:scale-95 ${
        accent
          ? "bg-gradient-to-b from-petal/20 to-petal/[0.04] border-petal/30 hover:border-petal/60 hover:from-petal/30"
          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15"
      } ${glow ? "shadow-[0_4px_16px_-6px_rgba(236,72,153,0.4)]" : ""}`}
    >
      <span className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-60" />
      <span className={`flex items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5 ${accent ? "text-petal" : "text-candle/80 group-hover:text-petal"}`}>
        {icon}
      </span>
      <span className="text-[10px] tracking-[0.08em] text-candle/90 uppercase font-medium">
        {label}
      </span>
    </button>
  );
}
