import { useState } from "react";
import { toast } from "sonner";
import {
  HeartPulse, Mail, Hourglass, Sparkles, PenLine, EyeOff, Timer, Shuffle, Mic,
} from "lucide-react";
import { MOODS, drawConfessionPrompt } from "@/lib/rituals";
import { VoiceRecorder } from "./VoiceRecorder";

type SendFn = (input: {
  content?: string;
  type?: string;
  media_url?: string | null;
  media_meta?: Record<string, unknown> | null;
  disappear_seconds?: number | null;
}) => Promise<void>;

type Mode = null | "letter" | "capsule" | "confession" | "mood" | "voicekiss";

/**
 * RitualsPanel — the premium chat rituals: heartbeat ping, mood ring,
 * love letter, time capsule, confession jar, voice kiss, duet pad and
 * vanish mode. Every action is guarded so a failure never breaks the chat.
 */
export function RitualsPanel({
  meId,
  partnerName,
  onSend,
  onOpenDuet,
  vanish,
  onToggleVanish,
  onClose,
}: {
  meId: string;
  partnerName: string;
  onSend: SendFn;
  onOpenDuet: () => void;
  vanish: boolean;
  onToggleVanish: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [prompt, setPrompt] = useState(() => drawConfessionPrompt());
  const [busy, setBusy] = useState(false);

  async function guard(fn: () => Promise<void>, fallback: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setText("");
      setMode(null);
      onClose();
    } catch (err: any) {
      console.error("[RitualsPanel]", err);
      toast.error(err?.message ?? fallback);
    } finally {
      setBusy(false);
    }
  }

  const sendHeartbeat = () =>
    guard(async () => {
      await onSend({ type: "heartbeat", content: `💗 ${partnerName}, feel this` });
      if ("vibrate" in navigator) navigator.vibrate?.([90, 90, 90, 220]);
    }, "Couldn't send your heartbeat");

  const sendWhisper = () =>
    guard(async () => {
      if (!text.trim()) throw new Error("Write your whisper first");
      await onSend({ type: "whisper", content: text.trim() });
    }, "Couldn't send the whisper");

  return (
    <div className="relative mx-3 mb-2 rounded-3xl border border-gilt/25 bg-surface/90 backdrop-blur-2xl overflow-hidden animate-fade-in">
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-24 rounded-full bg-gilt/15 blur-3xl" />
      <div className="relative px-3 pt-2.5 pb-3">
        <p className="text-[8px] uppercase tracking-[0.32em] text-gilt/85 font-medium text-center mb-2">
          {mode ? "Rituals" : "Rituals"}
        </p>

        {!mode && (
          <div className="grid grid-cols-4 gap-2">
            <Choice icon={<HeartPulse className="size-4" />} label="Heartbeat" onClick={sendHeartbeat} />
            <Choice icon={<Sparkles className="size-4" />} label="Mood" onClick={() => setMode("mood")} />
            <Choice icon={<Mail className="size-4" />} label="Letter" onClick={() => setMode("letter")} />
            <Choice icon={<Hourglass className="size-4" />} label="Capsule" onClick={() => setMode("capsule")} />
            <Choice icon={<PenLine className="size-4" />} label="Confess" onClick={() => setMode("confession")} />
            <Choice icon={<Mic className="size-4" />} label="Voice kiss" onClick={() => setMode("voicekiss")} />
            <Choice icon={<Shuffle className="size-4" />} label="Duet" onClick={() => { onOpenDuet(); onClose(); }} />
            <Choice
              icon={vanish ? <Timer className="size-4" /> : <EyeOff className="size-4" />}
              label={vanish ? "Vanish on" : "Vanish"}
              active={vanish}
              onClick={onToggleVanish}
            />
          </div>
        )}

        {mode === "mood" && (
          <div className="grid grid-cols-3 gap-2">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() =>
                  guard(
                    () => onSend({ type: "mood", content: m.note, media_meta: { mood: m.id } }),
                    "Couldn't set your mood",
                  )
                }
                className="rounded-2xl border px-2 py-2.5 flex flex-col items-center gap-1 active:scale-95 transition"
                style={{ borderColor: `hsl(${m.hue} / 0.35)`, background: `hsl(${m.hue} / 0.10)` }}
              >
                <span className="text-lg">{m.emoji}</span>
                <span className="text-[10px] text-candle">{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {(mode === "letter" || mode === "capsule" || mode === "confession") && (
          <div className="space-y-2">
            {mode === "confession" && (
              <button
                type="button"
                onClick={() => setPrompt((p) => drawConfessionPrompt(p))}
                className="w-full text-left rounded-2xl border border-gilt/25 bg-surface-elevated/80 px-3 py-2"
              >
                <span className="text-[8px] uppercase tracking-[0.28em] text-gilt/80">Draw a prompt</span>
                <p className="font-serif italic text-[13px] text-candle mt-0.5">{prompt}</p>
              </button>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={
                mode === "letter"
                  ? `A letter for ${partnerName}…`
                  : mode === "capsule"
                    ? "A message for the future…"
                    : "Say it here…"
              }
              className="w-full rounded-2xl bg-surface-elevated border border-border px-3 py-2 text-sm text-candle placeholder:text-candle-muted/60 outline-none focus:border-petal/50"
            />
            {mode === "capsule" && (
              <input
                type="datetime-local"
                value={unlockAt}
                onChange={(e) => setUnlockAt(e.target.value)}
                className="w-full rounded-2xl bg-surface-elevated border border-border px-3 py-2 text-sm text-candle outline-none focus:border-petal/50"
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode(null); setText(""); }}
                className="flex-1 rounded-full border border-border py-2 text-xs text-candle-muted"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  guard(async () => {
                    const body = text.trim();
                    if (!body) throw new Error("Write something first");
                    if (mode === "letter") {
                      await onSend({ type: "love_letter", content: body });
                    } else if (mode === "capsule") {
                      if (!unlockAt) throw new Error("Pick an unlock date");
                      const iso = new Date(unlockAt).toISOString();
                      if (new Date(iso).getTime() <= Date.now()) throw new Error("Pick a future date");
                      await onSend({ type: "time_capsule", content: body, media_meta: { unlock_at: iso } });
                    } else {
                      await onSend({ type: "confession", content: body, media_meta: { prompt } });
                    }
                  }, "Couldn't send that")
                }
                className="flex-1 rounded-full bg-petal py-2 text-xs font-medium text-velvet disabled:opacity-60"
              >
                {mode === "letter" ? "Seal & send" : mode === "capsule" ? "Bury capsule" : "Confess"}
              </button>
            </div>
          </div>
        )}

        {mode === "voicekiss" && (
          <div className="space-y-2">
            <p className="text-[11px] text-candle-muted text-center">
              Record a short whisper — it plays with the kiss.
            </p>
            <VoiceRecorder
              userId={meId}
              onSend={async (path: string, durationMs: number) => {
                await guard(
                  () =>
                    onSend({
                      type: "kiss",
                      content: "💋",
                      media_url: path,
                      media_meta: { duration_ms: durationMs, voice_kiss: true },
                    }),
                  "Couldn't send your voice kiss",
                );
              }}
            />

            <button
              type="button"
              onClick={() => setMode(null)}
              className="w-full rounded-full border border-border py-2 text-xs text-candle-muted"
            >
              Back
            </button>
          </div>
        )}

        {mode === null && (
          <div className="mt-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Secret whisper — blurred until they hold it"
              className="w-full rounded-full bg-surface-elevated border border-border px-3.5 py-2 text-xs text-candle placeholder:text-candle-muted/60 outline-none focus:border-petal/50"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendWhisper(); } }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Choice({
  icon, label, onClick, active,
}: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-1 py-2.5 flex flex-col items-center gap-1 active:scale-95 transition ${
        active ? "border-petal/60 bg-petal/15 text-petal" : "border-border bg-surface-elevated/70 text-candle"
      }`}
    >
      {icon}
      <span className="text-[9px] leading-tight text-center">{label}</span>
    </button>
  );
}
