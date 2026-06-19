import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { uploadChatMedia } from "@/lib/chat";

export function VoiceRecorder({
  userId,
  onSend,
}: {
  userId: string;
  onSend: (path: string, durationMs: number) => Promise<void> | void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: mime });
      };
      rec.start();
      recRef.current = rec;
      startRef.current = Date.now();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 250);
    } catch {
      setRecording(false);
    }
  }

  function stop(cancel: boolean) {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    if (cancel) {
      blobRef.current = null;
      setElapsed(0);
    }
  }

  async function sendNow() {
    if (!blobRef.current) return;
    setBusy(true);
    try {
      const ms = elapsed * 1000;
      const path = await uploadChatMedia(blobRef.current, userId, "voice", "webm");
      await onSend(path, ms);
    } finally {
      setBusy(false);
      blobRef.current = null;
      setElapsed(0);
    }
  }

  // recorder onstop is async; wait a tick before send
  async function stopAndSend() {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        rec.stop();
      });
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    await sendNow();
  }

  useEffect(() => () => stop(true), []);

  if (!recording && elapsed === 0) {
    return (
      <button
        type="button"
        onClick={start}
        className="size-11 rounded-full bg-surface border border-border flex items-center justify-center text-petal"
        aria-label="Record voice"
      >
        <Mic className="size-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 h-11 rounded-full bg-surface border border-petal/40">
      <div className="size-2 rounded-full bg-petal animate-pulse" />
      <span className="text-xs tabular-nums text-candle">{elapsed}s</span>
      <button onClick={() => stop(true)} type="button" className="text-candle-muted" aria-label="Cancel">
        <Trash2 className="size-4" />
      </button>
      {recording ? (
        <button onClick={stopAndSend} type="button" disabled={busy} className="text-petal" aria-label="Send">
          <Send className="size-4" />
        </button>
      ) : (
        <button onClick={() => stop(false)} type="button" className="text-petal" aria-label="Stop">
          <Square className="size-4" />
        </button>
      )}
    </div>
  );
}
