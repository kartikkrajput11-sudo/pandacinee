import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { signMedia } from "@/lib/chat";

export function VoicePlayer({ path, durationMs }: { path: string; durationMs?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let m = true;
    signMedia(path).then((u) => m && setUrl(u));
    return () => { m = false; };
  }, [path]);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime / (a.duration || 1));
    const onEnd = () => {
      // Rewind so the next tap replays from the start instead of firing
      // "ended" immediately (currentTime stays at duration otherwise).
      try { a.currentTime = 0; } catch { /* ignore */ }
      setPlaying(false);
      setProgress(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, [url]);

  async function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    // If we're at the end (or very close), rewind before playing so replay
    // works reliably on Safari/iOS where "ended" leaves currentTime pinned.
    if (a.duration && a.currentTime >= a.duration - 0.05) {
      try { a.currentTime = 0; } catch { /* ignore */ }
    }
    // Refresh the signed URL if it might have expired between plays.
    try {
      const p = a.play();
      if (p && typeof (p as Promise<void>).catch === "function") {
        await (p as Promise<void>);
      }
    } catch {
      const fresh = await signMedia(path);
      if (fresh) {
        setUrl(fresh);
        a.src = fresh;
        try { a.currentTime = 0; } catch { /* ignore */ }
        try { await a.play(); } catch { /* ignore */ }
      }
    }
  }

  const secs = durationMs ? Math.round(durationMs / 1000) : 0;

  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <button onClick={toggle} className="size-9 rounded-full bg-velvet/30 flex items-center justify-center">
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="flex-1 h-1.5 bg-velvet/30 rounded-full overflow-hidden">
        <div className="h-full bg-current/70" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-xs opacity-70 tabular-nums">{secs}s</span>
      {url && <audio ref={ref} src={url} preload="metadata" />}
    </div>
  );
}
