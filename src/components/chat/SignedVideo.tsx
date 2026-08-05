import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Loader2 } from "lucide-react";
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
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [poster, setPoster] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    function onFsChange() {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).webkitCurrentFullScreenElement;
      setIsFullscreen(!!fsEl);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as any);
    };
  }, []);

  useEffect(() => {
    let m = true;
    signMedia(path).then((u) => m && setUrl(u));
    return () => { m = false; };
  }, [path]);

  useEffect(() => () => { if (poster) URL.revokeObjectURL(poster); }, [poster]);

  /** Grab a real frame as the thumbnail so the bubble never shows a black box. */
  function captureThumbnail() {
    const v = videoRef.current;
    if (!v || poster || started) return;
    try {
      const canvas = document.createElement("canvas");
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (!w || !h) return;
      canvas.width = Math.min(640, w);
      canvas.height = Math.round((canvas.width / w) * h);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => { if (b) setPoster(URL.createObjectURL(b)); }, "image/jpeg", 0.72);
    } catch { /* cross-origin or codec issue — fall back to the video frame */ }
  }

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
      v.muted = false;
      setMuted(false);
      setStarted(true);
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

  async function toggleFullscreen() {
    const el = wrapRef.current;
    const doc: any = document;
    const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.webkitCurrentFullScreenElement;
    if (fsEl) {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.webkitCancelFullScreen;
      if (exit) { try { await exit.call(doc); } catch { /* ignore */ } }
      return;
    }
    if (!el) return;
    const anyEl = el as any;
    const fn = el.requestFullscreen || anyEl.webkitRequestFullscreen;
    if (fn) {
      try { await fn.call(el); } catch { /* ignore */ }
    } else {
      const v = videoRef.current as any;
      if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
    }
  }

  function seekTo(ratio: number) {
    const v = videoRef.current;
    if (!v || !duration) return;
    const t = Math.max(0, Math.min(duration, ratio * duration));
    v.currentTime = t;
    setCurrent(t);
  }

  function onScrub(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - rect.left) / rect.width);
  }

  if (!url) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border/60 w-[260px] h-[180px] bg-velvet/40">
        <div className="absolute inset-0 -translate-x-full animate-[media-shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-petal/15 to-transparent" />
      </div>
    );
  }

  const pct = duration ? (current / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      className="relative rounded-2xl overflow-hidden bg-black border border-petal/25 shadow-[0_20px_60px_-30px_rgba(236,72,153,0.6)] w-[260px] group"
      onMouseMove={nudgeControls}
      onClick={nudgeControls}
    >
      <video
        ref={videoRef}
        src={url}
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        className="block w-full max-h-[360px] object-contain bg-black"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          // Nudge one frame in so the captured poster isn't a black lead-in.
          try { e.currentTarget.currentTime = 0.12; } catch { /* ignore */ }
        }}
        onSeeked={captureThumbnail}
        onLoadedData={captureThumbnail}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => { setPlaying(true); setStarted(true); nudgeControls(); }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onEnded={() => { setPlaying(false); setShowControls(true); }}
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
      />

      {/* Poster / play state */}
      {!playing && (
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/70 via-black/5 to-black/35"
          aria-label="Play video"
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute size-16 rounded-full bg-petal/25 animate-ping" />
            <span className="relative size-14 rounded-full bg-petal/95 text-velvet flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(236,72,153,0.9)] transition-transform duration-200 group-hover:scale-105">
              <Play className="size-6 fill-current translate-x-0.5" />
            </span>
          </span>
        </button>
      )}

      {waiting && playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
          <Loader2 className="size-8 text-petal animate-spin" />
        </div>
      )}

      <div className="absolute top-2 left-2 pointer-events-none flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-[0.28em] text-white/70 bg-black/45 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
          Pandacine
        </span>
      </div>
      {!started && duration > 0 && (
        <span className="absolute top-2 right-2 pointer-events-none text-[10px] tabular-nums text-white/85 bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
          {fmt(duration)}
        </span>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-8 bg-gradient-to-t from-black/90 via-black/45 to-transparent transition-opacity duration-200 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Scrub bar */}
        <div
          className="relative h-4 flex items-center cursor-pointer mb-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => { e.stopPropagation(); onScrub(e); }}
          onPointerMove={(e) => { if (e.buttons === 1) onScrub(e); }}
          role="slider"
          aria-label="Seek"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-petal to-petal/70" style={{ width: `${pct}%` }} />
          </div>
          <span
            className="absolute size-3 rounded-full bg-petal shadow-[0_0_10px_rgba(236,72,153,0.8)] -translate-x-1/2 transition-transform"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="size-7 shrink-0 rounded-full bg-white/10 hover:bg-petal/70 text-white flex items-center justify-center transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current translate-x-[1px]" />}
          </button>

          <span className="text-[10px] text-white/85 tabular-nums font-medium">
            {fmt(current)} <span className="text-white/45">/ {fmt(duration)}</span>
          </span>

          <div className="flex-1" />

          <button
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="size-7 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className="size-7 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
