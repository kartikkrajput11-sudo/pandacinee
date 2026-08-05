import { useEffect, useRef, useState } from "react";
import {
  Plus, X, Image as ImageIcon, Paperclip, Smile, Send, Film,
  Video as VideoIcon, Gamepad2, Heart, HeartHandshake, Handshake, Hand, Zap, EyeOff, Eye, Disc3, Sparkles, Pointer, CalendarClock, Angry, Feather, Laugh, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { uploadChatMedia, type MessageRow } from "@/lib/chat";
import { VoiceRecorder } from "./VoiceRecorder";
import { WatchInvitePicker } from "./WatchInvitePicker";
import { EmojiPicker } from "./EmojiPicker";
import { GameInvitePicker, type GamePick } from "./GameInvitePicker";
import { newGameRoomId } from "@/lib/game-room";
import { MovieWheelPicker, type WheelEntry } from "./MovieWheelPicker";
import { PandaStickerPicker } from "./PandaStickerPicker";
import { AiStickerPicker } from "./AiStickerPicker";
import { pandaStickerContent, type PandaStickerId } from "@/lib/panda-stickers";
import type { AiStickerMood } from "@/lib/ai-stickers.functions";
import type { TmdbMovie } from "@/lib/tmdb.functions";
import { preloadAffectionStickers } from "@/lib/affection-preload";
import { RitualsPanel } from "./RitualsPanel";



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
    type?: "text" | "voice" | "image" | "video" | "file" | "sticker" | "watch_invite" | "game_invite" | "kiss" | "hug" | "headpat" | "handhold" | "boop" | "slap" | "anger" | "tickle" | "wink" | "nudge" | "whisper" | "movie_wheel" | "heartbeat" | "mood" | "love_letter" | "time_capsule" | "confession" | string;
    media_url?: string | null;
    media_meta?: Record<string, unknown> | null;
    reply_to_id?: string | null;
    disappear_seconds?: number | null;
  }) => Promise<void>;

  /** Optional: opens a "send later" dialog with the current draft. */
  onSchedule?: (draft: string) => void;
};

export function ChatComposer({ meId, partnerName, replyTo, onClearReply, onTyping, onSend, locked, lockedHint, onSchedule }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [manualDisappear, setManualDisappear] = useState<number | null>(null);
  const [vanish, setVanish] = useState(false);
  const [ritualsOpen, setRitualsOpen] = useState(false);
  // Vanish mode gives every message a default 60s life unless a longer
  // timer was picked manually.
  const disappearSecs = vanish ? (manualDisappear ?? 60) : manualDisappear;
  const setDisappearSecs = setManualDisappear;
  const [disappearMenu, setDisappearMenu] = useState(false);

  const [watchPickerOpen, setWatchPickerOpen] = useState(false);
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [pandaOpen, setPandaOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [whisper, setWhisper] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);
  const [recording, setRecording] = useState(false);
  const [focused, setFocused] = useState(false);
  const [openGroup, setOpenGroup] = useState<null | "media" | "sticker" | "together" | "affection">(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const composing = (focused || text.trim().length > 0) && !recording;

  async function sendGameInvite(g: GamePick) {
    setGamePickerOpen(false);
    setMenuOpen(false);
    try {
      await onSend({
        type: "game_invite",
        content: g.name,
        media_meta: { game_id: g.id, emoji: g.emoji, body: g.body, href: g.href, room: newGameRoomId() },
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

  async function sendHeadpat() {
    setMenuOpen(false);
    try {
      await onSend({ type: "headpat", content: `✋ A gentle headpat for ${partnerName}`, disappear_seconds: disappearSecs });
      toast.success(`You patted ${partnerName} ✋`);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
    }
  }

  async function sendHandhold() {
    setMenuOpen(false);
    try {
      await onSend({ type: "handhold", content: `🤝 Holding hands with ${partnerName}`, disappear_seconds: disappearSecs });
      toast.success(`Fingers laced with ${partnerName} 🤝`);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
    }
  }

  async function sendBoop() {
    setMenuOpen(false);
    try {
      await onSend({ type: "boop", content: `👉 Booped ${partnerName}'s nose`, disappear_seconds: disappearSecs });
      toast.success(`Booped ${partnerName} 👉`);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
    }
  }


  async function sendAffection(
    type: "slap" | "anger" | "tickle" | "wink",
    content: string,
    toastMsg: string,
  ) {
    setMenuOpen(false);
    try {
      await onSend({ type, content, disappear_seconds: disappearSecs });
      toast.success(toastMsg);
    } catch (err: any) {
      console.error("[ChatComposer] affection send failed", type, err);
      toast.error(err?.message ?? "Couldn't send");
    }
  }

  const sendSlap = () => sendAffection("slap", `👋 Slapped ${partnerName}`, `You slapped ${partnerName} 💢`);
  const sendAnger = () => sendAffection("anger", `💢 Mad at ${partnerName}`, `${partnerName} knows you're mad 💢`);
  const sendTickle = () => sendAffection("tickle", `🪶 Tickled ${partnerName}`, `You tickled ${partnerName} 🪶`);
  const sendWink = () => sendAffection("wink", `😉 Winked at ${partnerName}`, `You winked at ${partnerName} 😉`);

  async function sendWatchInvite(movie: TmdbMovie & { media_type?: "movie" | "tv" }) {
    setWatchPickerOpen(false);
    setMenuOpen(false);
    try {
      await onSend({
        type: "watch_invite",
        content: movie.title,
        media_meta: {
          tmdb_id: movie.id,
          media_type: movie.media_type === "tv" ? "tv" : "movie",
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

  // Warm affection sticker cache so overlays appear instantly
  useEffect(() => {
    preloadAffectionStickers();
  }, []);


  async function sendText(e?: React.FormEvent) {
    e?.preventDefault();
    if (sending) return; // guard against Enter-key double submits while first send is in flight
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

  function uploadAndSend(
    file: File,
    kind: "image" | "video" | "file",
    payload: (path: string) => Parameters<typeof onSend>[0],
    _label: string,
  ) {
    setMenuOpen(false);
    const replyId = replyTo?.id ?? null;
    startUpload({
      scope: meId,
      kind,
      file,
      onComplete: async (path) => {
        await onSend({ ...payload(path), reply_to_id: replyId });
      },
    });
    onClearReply();
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
        <div className="relative studio-surface backdrop-blur-2xl overflow-hidden animate-fade-in">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petal/50 to-transparent" />
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-24 rounded-full bg-petal/10 blur-3xl" />

          <div className="relative px-3 pt-2.5 pb-3">
            <p className="text-[8px] uppercase tracking-[0.32em] text-candle-muted/70 font-medium text-center mb-2">
              Studio
            </p>
            <div className="grid grid-cols-3 gap-px rounded-2xl overflow-hidden border border-candle/10 bg-candle/[0.04]">
              <StudioTile
                icon={<ImageIcon className="size-4" />}
                label="Media"
                onClick={() => setOpenGroup((g) => (g === "media" ? null : "media"))}
                accent={openGroup === "media"}
                glow={openGroup === "media"}
              />
              <StudioTile
                icon={<Sparkles className="size-4" />}
                label="Sticker"
                onClick={() => setOpenGroup((g) => (g === "sticker" ? null : "sticker"))}
                accent={openGroup === "sticker"}
                glow={openGroup === "sticker"}
              />
              <StudioTile
                icon={<Film className="size-4" />}
                label="Together"
                onClick={() => setOpenGroup((g) => (g === "together" ? null : "together"))}
                accent={openGroup === "together"}
                glow={openGroup === "together"}
              />
            </div>

            {openGroup === "media" && (
              <div className="mt-2 grid grid-cols-4 gap-2 animate-fade-in">
                <GroupChoice icon={<ImageIcon className="size-4" />} label="Photo" hint="From gallery" onClick={() => { imgRef.current?.click(); setOpenGroup(null); }} />
                <GroupChoice icon={<VideoIcon className="size-4" />} label="Video" hint="Up to 60 MB" onClick={() => { vidRef.current?.click(); setOpenGroup(null); }} />
                <GroupChoice
                  icon={<Eye className="size-4" />}
                  label={viewOnce ? "Once ✓" : "Once"}
                  hint={viewOnce ? "Armed" : "One view"}
                  active={viewOnce}
                  onClick={() => {
                    const next = !viewOnce;
                    setViewOnce(next);
                    toast[next ? "success" : "message"](next ? "Next photo/video will vanish after one view" : "View-once turned off");
                  }}
                />
                <GroupChoice icon={<Paperclip className="size-4" />} label="File" hint="Any document" onClick={() => { fileRef.current?.click(); setOpenGroup(null); }} />
              </div>
            )}

            {openGroup === "sticker" && (
              <div className="mt-2 grid grid-cols-2 gap-2 animate-fade-in">
                <GroupChoice icon={<span className="text-base leading-none">🐼</span>} label="Panda" hint="Curated set" onClick={() => { setOpenGroup(null); setPandaOpen(true); setMenuOpen(false); }} />
                <GroupChoice icon={<Sparkles className="size-4 text-petal" />} label="AI ✨" hint="Made for you" onClick={() => { setOpenGroup(null); setAiOpen(true); setMenuOpen(false); }} />
              </div>
            )}

            {openGroup === "together" && (
              <div className="mt-2 grid grid-cols-3 gap-2 animate-fade-in">
                <GroupChoice icon={<Film className="size-4" />} label="Watch" hint="A movie together" onClick={() => { setWatchPickerOpen(true); setMenuOpen(false); setOpenGroup(null); }} />
                <GroupChoice icon={<Gamepad2 className="size-4" />} label="Game" hint="Play a round" onClick={() => { setGamePickerOpen(true); setMenuOpen(false); setOpenGroup(null); }} />
                <GroupChoice icon={<Disc3 className="size-4" />} label="Wheel" hint="Spin to pick" onClick={() => { setWheelOpen(true); setMenuOpen(false); setOpenGroup(null); }} />
              </div>
            )}

          </div>
        </div>
      )}

      {openGroup === "affection" && (
        <div className="relative mx-3 mb-2 rounded-3xl border border-petal/30 bg-surface/90 backdrop-blur-2xl overflow-hidden animate-fade-in petal-glow">
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-24 rounded-full bg-petal/20 blur-3xl" />
          <div className="relative px-3 pt-2.5 pb-3">
            <p className="text-[8px] uppercase tracking-[0.32em] text-petal/80 font-medium text-center mb-2">
              Affection
            </p>
            <div className="grid grid-cols-3 gap-2">
              <GroupChoice icon={<Heart className="size-4 fill-current" />} label="Kiss" onClick={() => { setOpenGroup(null); sendKiss(); }} />
              <GroupChoice icon={<HeartHandshake className="size-4" />} label="Hug" onClick={() => { setOpenGroup(null); sendHug(); }} />
              <GroupChoice icon={<Hand className="size-4" />} label="Headpat" onClick={() => { setOpenGroup(null); sendHeadpat(); }} />
              <GroupChoice icon={<Handshake className="size-4" />} label="Handhold" onClick={() => { setOpenGroup(null); sendHandhold(); }} />
              <GroupChoice icon={<Pointer className="size-4" />} label="Boop" onClick={() => { setOpenGroup(null); sendBoop(); }} />
              <GroupChoice icon={<Zap className="size-4" />} label="Nudge" onClick={() => { setOpenGroup(null); sendNudge(); }} />
              <GroupChoice icon={<Hand className="size-4 -scale-x-100" />} label="Slap" onClick={() => { setOpenGroup(null); sendSlap(); }} />
              <GroupChoice icon={<Angry className="size-4" />} label="Anger" onClick={() => { setOpenGroup(null); sendAnger(); }} />
              <GroupChoice icon={<Feather className="size-4" />} label="Tickle" onClick={() => { setOpenGroup(null); sendTickle(); }} />
              <GroupChoice icon={<Laugh className="size-4" />} label="Wink" onClick={() => { setOpenGroup(null); sendWink(); }} />
            </div>
          </div>
        </div>
      )}

      {ritualsOpen && (
        <RitualsPanel
          meId={meId}
          partnerName={partnerName}
          vanish={vanish}
          onToggleVanish={() => {
            setVanish((v) => {
              const next = !v;
              toast[next ? "success" : "message"](
                next ? "Vanish mode on — new messages fade after 60s" : "Vanish mode off",
              );
              return next;
            });
          }}
          onOpenDuet={() => {
            try {
              window.dispatchEvent(new CustomEvent("pandacine:open-duet"));
            } catch (err) {
              console.error("[ChatComposer] duet open failed", err);
              toast.error("Couldn't open the duet pad");
            }
          }}
          onSend={async (input: { content?: string; type?: string; media_url?: string | null; media_meta?: Record<string, unknown> | null; disappear_seconds?: number | null }) =>
            onSend({ ...input, disappear_seconds: input.disappear_seconds ?? disappearSecs })
          }

          onClose={() => setRitualsOpen(false)}
        />
      )}


      <WatchInvitePicker open={watchPickerOpen} onClose={() => setWatchPickerOpen(false)} onPick={sendWatchInvite} />
      <GameInvitePicker open={gamePickerOpen} onClose={() => setGamePickerOpen(false)} onPick={sendGameInvite} />
      <MovieWheelPicker open={wheelOpen} onClose={() => setWheelOpen(false)} onSend={sendMovieWheel} />
      <PandaStickerPicker open={pandaOpen} onClose={() => setPandaOpen(false)} onPick={sendPandaSticker} onOpenAi={() => setAiOpen(true)} />
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
          {/* Shortcut cluster — gracefully collapses while composing */}
          <div
            className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              composing
                ? "max-w-0 opacity-0 -translate-x-2 scale-90 pointer-events-none"
                : "max-w-[240px] opacity-100 translate-x-0 scale-100"
            }`}
            aria-hidden={composing}
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
            onClick={() => { setPandaOpen(true); setStickersOpen(false); setMenuOpen(false); }}
            className="size-11 rounded-full bg-surface border border-border flex items-center justify-center text-petal shrink-0"
            title="Stickers"
          >
            <Smile className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                setMenuOpen(false);
                setStickersOpen(false);
                setOpenGroup((g) => (g === "affection" ? null : "affection"));
              } catch (err) {
                console.error("[ChatComposer] failed to open affection panel", err);
                toast.error("Couldn't open affection");
              }
            }}
            className={`size-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              openGroup === "affection"
                ? "bg-petal text-velvet petal-glow"
                : "bg-surface border border-border text-petal hover:border-petal/60"
            }`}
            title="Send affection — kiss, hug, headpat & more"
            aria-label="Open affection panel"
          >
            <Heart className="size-4 fill-current" />
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                setMenuOpen(false);
                setStickersOpen(false);
                setOpenGroup(null);
                setRitualsOpen((r) => !r);
              } catch (err) {
                console.error("[ChatComposer] failed to open rituals", err);
                toast.error("Couldn't open rituals");
              }
            }}
            className={`size-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              ritualsOpen
                ? "bg-gilt text-velvet"
                : "bg-surface border border-border text-gilt hover:border-gilt/60"
            }`}
            title="Rituals — heartbeat, mood, letters, capsules & more"
            aria-label="Open rituals panel"
          >
            <Sparkles className="size-4" />
          </button>
          </div>

          {/* Collapse handle — brings the shortcuts back */}
          <button
            type="button"
            onClick={() => { setFocused(false); inputRef.current?.blur(); }}
            className={`size-11 rounded-full bg-surface border border-border text-petal flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              composing ? "max-w-11 opacity-100 scale-100" : "max-w-0 w-0 border-0 opacity-0 scale-90 pointer-events-none"
            }`}
            title="Show shortcuts"
            aria-label="Show shortcuts"
            aria-hidden={!composing}
          >
            <ChevronRight className="size-4" />
          </button>

          <div className="flex-1 relative min-w-0">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => { setText(e.target.value); onTyping(e.target.value.length > 0); }}
              onFocus={() => setFocused(true)}
              onBlur={() => { setFocused(false); onTyping(false); }}
              placeholder={whisper ? `Whisper to ${partnerName}…` : `Message ${partnerName}…`}
              disabled={recording}
              className={`w-full pl-4 py-3 bg-surface border rounded-full text-sm text-candle placeholder:text-candle-muted focus:outline-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                composing ? "shadow-[0_0_0_1px_rgba(236,72,153,0.35),0_8px_24px_-12px_rgba(236,72,153,0.55)]" : ""
              } ${
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


        {/* Trailing: schedule + send button OR voice recorder (single instance, morphs) */}
        <div className="min-w-0 flex items-center justify-end gap-1.5">
          {text.trim() && !recording && onSchedule && (
            <button
              type="button"
              onClick={() => onSchedule(text)}
              className="size-11 rounded-full bg-surface border border-border text-petal flex items-center justify-center shrink-0"
              title="Send later"
              aria-label="Schedule message"
            >
              <CalendarClock className="size-4" />
            </button>
          )}
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
      className={`group relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all duration-200 active:scale-[0.96] ${
        accent
          ? "bg-gradient-to-b from-petal/[0.14] to-petal/[0.02] hover:from-petal/25 hover:to-petal/[0.06]"
          : "bg-candle/[0.02] hover:bg-candle/[0.08]"
      } ${glow ? "shadow-[inset_0_0_18px_-8px_rgba(236,72,153,0.5)]" : ""}`}
    >
      <span className={`flex items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5 ${accent ? "text-petal" : "text-candle/80 group-hover:text-petal"}`}>
        {icon}
      </span>
      <span className="text-[9px] tracking-[0.08em] text-candle uppercase font-semibold leading-none">
        {label}
      </span>
    </button>
  );
}

function GroupChoice({
  icon,
  label,
  hint,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all active:scale-[0.97] ${
        active
          ? "bg-gradient-to-br from-petal/25 to-petal/[0.04] border-petal/60 shadow-[inset_0_0_18px_-8px_rgba(236,72,153,0.55)]"
          : "bg-gradient-to-br from-candle/[0.05] to-transparent border-candle/15 hover:border-petal/50 hover:from-petal/15"
      }`}
    >
      <span className="shrink-0 flex items-center justify-center size-6 rounded-lg bg-candle/[0.06] text-petal">
        {icon}
      </span>
      <span className="text-left leading-tight min-w-0">
        <span className="block text-[11px] font-medium text-candle truncate">{label}</span>
      </span>
    </button>
  );
}

