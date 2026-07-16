import { useEffect, useRef, useState } from "react";
import { Mic, Trash2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadChatMedia } from "@/lib/chat";

const BAR_COUNT = 28;

export function VoiceRecorder({
  userId,
  onSend,
  onRecordingChange,
}: {
  userId: string;
  onSend: (path: string, durationMs: number) => Promise<void> | void;
  onRecordingChange?: (active: boolean) => void;
}) {

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(4));

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  function stopAnalyser() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  function tickAnalyser() {
    const a = analyserRef.current;
    if (!a) return;
    const buf = new Uint8Array(a.frequencyBinCount);
    a.getByteFrequencyData(buf);
    // downsample to BAR_COUNT
    const step = Math.floor(buf.length / BAR_COUNT) || 1;
    const next: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const v = buf[i * step] ?? 0;
      next.push(4 + Math.round((v / 255) * 26));
    }
    setLevels(next);
    rafRef.current = requestAnimationFrame(tickAnalyser);
  }

  function pickMime(): { mime: string; ext: string } {
    // Safari/macOS reject audio/webm entirely. Probe in order so every
    // browser lands on something MediaRecorder can actually emit.
    const candidates: Array<{ mime: string; ext: string }> = [
      { mime: "audio/webm;codecs=opus", ext: "webm" },
      { mime: "audio/webm", ext: "webm" },
      { mime: "audio/ogg;codecs=opus", ext: "ogg" },
      { mime: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
      { mime: "audio/mp4", ext: "m4a" },
      { mime: "audio/aac", ext: "aac" },
    ];
    const MR: any = (typeof window !== "undefined" && (window as any).MediaRecorder) || null;
    if (MR?.isTypeSupported) {
      for (const c of candidates) if (MR.isTypeSupported(c.mime)) return c;
    }
    return { mime: "", ext: "m4a" }; // let the browser pick its default
  }

  const mimeRef = useRef<{ mime: string; ext: string }>({ mime: "", ext: "webm" });

  async function start() {
    try {
      if (typeof MediaRecorder === "undefined") {
        toast.error("Voice notes aren't supported in this browser.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Microphone unavailable on this device.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const picked = pickMime();
      mimeRef.current = picked;
      const rec = picked.mime
        ? new MediaRecorder(stream, { mimeType: picked.mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || picked.mime || "audio/mp4";
        blobRef.current = new Blob(chunksRef.current, { type });
      };

      // Show recording UI immediately so users get feedback…
      setRecording(true);
      onRecordingChange?.(true);
      setElapsed(0);

      // …but discard the first ~350ms where the mic's AGC/echo canceller
      // is still calibrating and produces a click/hiss burst.
      await new Promise((r) => setTimeout(r, 350));
      // User may have cancelled during warmup.
      if (!streamRef.current) return;

      rec.start();
      recRef.current = rec;
      startRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 250);

      // Waveform
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyserRef.current = analyser;
      rafRef.current = requestAnimationFrame(tickAnalyser);
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Microphone permission denied."
          : err?.name === "NotFoundError"
          ? "No microphone found."
          : err?.name === "NotSupportedError"
          ? "This browser can't record voice notes."
          : err?.message ?? "Couldn't start recording";
      toast.error(msg);
      setRecording(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function teardown() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    stopAnalyser();
  }

  function cancel() {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    teardown();
    blobRef.current = null;
    setRecording(false);
    onRecordingChange?.(false);
    setElapsed(0);
    setLevels(Array(BAR_COUNT).fill(4));
  }


  async function stopAndSend() {
    const rec = recRef.current;
    if (!rec) return;
    if (rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        rec.stop();
      });
    }
    const ms = Math.max(500, Date.now() - startRef.current);
    teardown();
    setRecording(false);
    onRecordingChange?.(false);

    if (!blobRef.current || ms < 500) {
      blobRef.current = null;
      setElapsed(0);
      return;
    }
    setBusy(true);
    try {
      const path = await uploadChatMedia(blobRef.current, userId, "voice", mimeRef.current.ext || "webm");
      await onSend(path, ms);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send voice note");
    } finally {
      setBusy(false);
      blobRef.current = null;
      setElapsed(0);
      setLevels(Array(BAR_COUNT).fill(4));
    }
  }

  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!recording && !busy) {
    return (
      <button
        type="button"
        onClick={start}
        className="size-11 rounded-full bg-surface border border-border flex items-center justify-center text-petal hover:bg-petal/10 transition-colors"
        aria-label="Record voice"
      >
        <Mic className="size-4" />
      </button>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex-1 flex items-center gap-2 px-3 h-11 rounded-full bg-surface border border-petal/50 shadow-inner shadow-petal/10">
      <button
        onClick={cancel}
        type="button"
        disabled={busy}
        className="text-candle-muted hover:text-destructive transition-colors"
        aria-label="Cancel"
      >
        <Trash2 className="size-4" />
      </button>
      <div className="size-2 rounded-full bg-petal animate-pulse shrink-0" />
      <span className="text-xs tabular-nums text-candle w-10 shrink-0">{mm}:{ss}</span>
      <div className="flex-1 flex items-center gap-[2px] h-6 overflow-hidden">
        {levels.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-petal/80"
            style={{ height: `${busy ? 4 : h}px`, transition: "height 80ms linear" }}
          />
        ))}
      </div>
      <button
        onClick={stopAndSend}
        type="button"
        disabled={busy}
        className="size-9 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow disabled:opacity-60"
        aria-label="Send voice"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </button>
    </div>
  );
}
