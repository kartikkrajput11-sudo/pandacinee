import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";
import { signMedia } from "@/lib/chat";

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SignedVideo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    let m = true;
    signMedia(path).then((u) => m && setUrl(u));
    return () => { m = false; };
  }, [path]);

  function nudgeControls() {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2200);
  }

  async function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // Ensure audio plays on the user gesture.
      v.muted = false;
      setMuted(false);
      try { await v.play(); } catch { /* ignore */ }
    } else {
      v.pause();
    }
    nudgeControls();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    nudgeControls();
  }

  function requestFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    const anyEl = el as any;
    const fn = el.requestFullscreen || anyEl.webkitRequestFullscreen || anyEl.webkitEnterFullscreen;
    if (fn) fn.call(el);
    else {
      // iOS Safari fallback: fullscreen the video element itself
      const v = videoRef.current as any;
      if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
    }
  }

  function onSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v) return;
    const t = (Number(e.target.value) / 1000) * (duration || 0);
    v.currentTime = t;
    setCurrent(t);
  }

  if (!url) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-velvet/40 to-velvet/20 border border-border/60 animate-pulse w-[240px] h-[180px]" />
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative rounded-2xl overflow-hidden bg-black border border-petal/25 shadow-[0_20px_60px_-30px_rgba(236,72,153,0.6)] w-[260px]"
      onMouseMove={nudgeControls}
      onClick={nudgeControls}
    >
      <video
        ref={videoRef}
        src={url}
        playsInline
        preload="metadata"
        className="block w-full max-h-[360px] object-contain bg-black"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setReady(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => { setPlaying(true); nudgeControls(); }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onEnded={() => { setPlaying(false); setShowControls(true); }}
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
      />

      {/* Center play button */}
      {(!playing || !ready) && (
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-black/10 to-black/30"
          aria-label="Play video"
        >
          <span className="size-14 rounded-full bg-petal/90 text-velvet flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(236,72,153,0.8)] backdrop-blur">
            <Play className="size-6 fill-current translate-x-0.5" />
          </span>
        </button>
      )}

      {/* Panda Cine brand caplet */}
      <div className="absolute top-2 left-2 pointer-events-none">
        <span className="text-[9px] uppercase tracking-[0.28em] text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
          Pandacine
        </span>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 px-3 pb-2 pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="size-7 rounded-full bg-white/10 hover:bg-petal/70 text-white flex items-center justify-center transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current translate-x-[1px]" />}
          </button>

          <span className="text-[10px] text-white/80 tabular-nums font-medium">
            {fmt(current)}
          </span>

          <input
            type="range"
            min={0}
            max={1000}
            value={duration ? (current / duration) * 1000 : 0}
            onChange={onSeek}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-1 accent-petal cursor-pointer"
            aria-label="Seek"
          />

          <span className="text-[10px] text-white/60 tabular-nums">
            {fmt(duration)}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="size-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); requestFullscreen(); }}
            className="size-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Fullscreen"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
