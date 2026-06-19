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
    const onEnd = () => { setPlaying(false); setProgress(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [url]);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
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
