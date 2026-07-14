import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  PictureInPicture2,
  Gauge,
} from "lucide-react";

export type CustomPlayerHandle = {
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  currentTime: () => number;
  duration: () => number;
  isPaused: () => boolean;
};

type Props = {
  src: string;
  poster?: string | null;
  startAt?: number;
  onEvent?: (evt: {
    event: "play" | "pause" | "seeked" | "timeupdate" | "ended";
    currentTime: number;
    duration: number;
  }) => void;
  onReady?: (handle: CustomPlayerHandle) => void;
  /** When true, only host controls playback: viewer cannot play/pause/seek/skip. */
  locked?: boolean;
};

function fmt(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function CustomMoviePlayer({ src, poster, startAt, onEvent, onReady, locked = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [rateOpen, setRateOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const scrubbing = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Set up Web Audio gain node for volume boost (up to 300%)
  const setupGain = useCallback(() => {
    const v = videoRef.current;
    if (!v || sourceNodeRef.current) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(v);
      const gain = ctx.createGain();
      gain.gain.value = 1;
      src.connect(gain).connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainNodeRef.current = gain;
      sourceNodeRef.current = src;
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      try { audioCtxRef.current?.close(); } catch {}
    };
  }, []);

  // Attach handle for parent sync control
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !onReady) return;
    onReady({
      play: () => v.play().catch(() => {}),
      pause: () => v.pause(),
      seek: (t: number) => {
        try {
          v.currentTime = Math.max(0, t);
        } catch {}
      },
      currentTime: () => v.currentTime,
      duration: () => v.duration,
      isPaused: () => v.paused,
    });
  }, [onReady]);

  // Seek to startAt when src or startAt changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !startAt || startAt < 1) return;
    const apply = () => {
      try {
        v.currentTime = startAt;
      } catch {}
    };
    if (v.readyState >= 1) apply();
    else v.addEventListener("loadedmetadata", apply, { once: true });
  }, [src, startAt]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2600);
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        if (locked) return;
        v.paused ? v.play() : v.pause();
      } else if (e.key === "ArrowRight") {
        if (locked) return;
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
      } else if (e.key === "ArrowLeft") {
        if (locked) return;
        v.currentTime = Math.max(0, v.currentTime - 10);
      } else if (e.key === "f") {
        toggleFullscreen();
      } else if (e.key === "m") {
        v.muted = !v.muted;
      }
      scheduleHide();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [scheduleHide, locked]);

  function togglePlay() {
    if (locked) return;
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }

  function skip(delta: number) {
    if (locked) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  async function togglePip() {
    const v = videoRef.current as any;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await (document as any).exitPictureInPicture();
      else await v.requestPictureInPicture?.();
    } catch {}
  }

  function onScrub(e: React.ChangeEvent<HTMLInputElement>) {
    if (locked) return;
    const v = videoRef.current;
    if (!v || !duration) return;
    const t = (Number(e.target.value) / 1000) * duration;
    v.currentTime = t;
    setTime(t);
  }

  const progressPct = duration > 0 ? (time / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative w-full h-full bg-black rounded-2xl md:rounded-3xl overflow-hidden focus:outline-none group"
      onMouseMove={scheduleHide}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          if (scrubbing.current) return;
          const v = e.currentTarget;
          setTime(v.currentTime);
          onEvent?.({ event: "timeupdate", currentTime: v.currentTime, duration: v.duration });
        }}
        onPlay={(e) => {
          setPlaying(true);
          scheduleHide();
          onEvent?.({ event: "play", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration });
        }}
        onPause={(e) => {
          setPlaying(false);
          setShowControls(true);
          onEvent?.({ event: "pause", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration });
        }}
        onSeeked={(e) => {
          onEvent?.({ event: "seeked", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration });
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onEnded={(e) => onEvent?.({ event: "ended", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration })}
        onClick={locked ? undefined : togglePlay}
      />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-12 rounded-full border-2 border-petal border-t-transparent animate-spin" />
        </div>
      )}

      {/* Center play button when paused (hidden for followers — host controls playback) */}
      {!playing && !buffering && !locked && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <span className="size-16 md:size-20 rounded-full bg-petal text-velvet flex items-center justify-center shadow-2xl shadow-petal/40">
            <Play className="size-7 md:size-9 fill-velvet ml-1" />
          </span>
        </button>
      )}

      {/* Follower lock hint when paused */}
      {locked && !playing && !buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-black/60 border border-white/10 text-white/90 text-xs tracking-wide">
            Host controls playback
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 p-3 md:p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress */}
        <div className="relative mb-2 group/scrub">
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-petal transition-[width] duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={duration > 0 ? Math.round((time / duration) * 1000) : 0}
            onMouseDown={() => (scrubbing.current = true)}
            onMouseUp={() => (scrubbing.current = false)}
            onTouchStart={() => (scrubbing.current = true)}
            onTouchEnd={() => (scrubbing.current = false)}
            onChange={onScrub}
            disabled={locked}
            aria-label="Seek"
            className={`absolute inset-0 w-full opacity-0 h-6 -top-2 ${locked ? "cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
          />
          <div
            className="absolute -top-1 size-3.5 rounded-full bg-white shadow pointer-events-none transition-[left]"
            style={{ left: `calc(${progressPct}% - 7px)` }}
          />
        </div>

        <div className="flex items-center gap-2 text-white text-xs">
          {!locked && (
            <>
              <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                {playing ? <Pause className="size-4 fill-white" /> : <Play className="size-4 fill-white ml-0.5" />}
              </button>
              <button onClick={() => skip(-10)} aria-label="Back 10 seconds" className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <RotateCcw className="size-4" />
              </button>
              <button onClick={() => skip(10)} aria-label="Forward 10 seconds" className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <RotateCw className="size-4" />
              </button>
            </>
          )}
          {locked && (
            <span className="text-[11px] text-white/70 tracking-wide">Host controls playback</span>
          )}


          <div className="hidden sm:flex items-center gap-2 ml-1">
            <button
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
              }}
              aria-label={muted ? "Unmute" : "Mute"}
              className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            >
              {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={300}
              value={muted ? 0 : Math.round(volume * 100)}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                setupGain();
                try { audioCtxRef.current?.resume(); } catch {}
                const pct = Number(e.target.value);
                const val = pct / 100;
                // Video element volume caps at 1; use gain node for >100%
                v.volume = Math.min(1, val);
                v.muted = val === 0;
                if (gainNodeRef.current) {
                  gainNodeRef.current.gain.value = val <= 1 ? 1 : val;
                }
                setVolume(val);
                setMuted(val === 0);
              }}
              className="w-24 accent-petal"
              aria-label="Volume"
              title={`${Math.round(volume * 100)}%${volume > 1 ? " (boosted)" : ""}`}
            />
            {volume > 1 && (
              <span className="text-[10px] text-petal font-semibold">{Math.round(volume * 100)}%</span>
            )}
          </div>



          <div className="ml-auto flex items-center gap-2">
            <span className="tabular-nums text-white/90">
              {fmt(time)} / {fmt(duration)}
            </span>

            <div className="relative">
              <button
                onClick={() => setRateOpen((o) => !o)}
                className="h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 flex items-center gap-1"
                aria-label="Playback speed"
              >
                <Gauge className="size-3.5" />
                <span>{rate}x</span>
              </button>
              {rateOpen && (
                <div className="absolute right-0 bottom-11 bg-black/90 border border-white/10 rounded-2xl p-1.5 flex flex-col gap-0.5 min-w-[80px]">
                  {RATES.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        const v = videoRef.current;
                        if (!v) return;
                        v.playbackRate = r;
                        setRate(r);
                        setRateOpen(false);
                      }}
                      className={`px-2 py-1 rounded-lg text-left text-xs hover:bg-white/10 ${r === rate ? "text-petal" : "text-white"}`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={togglePip} aria-label="Picture-in-picture" className="hidden sm:flex size-9 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center">
              <PictureInPicture2 className="size-4" />
            </button>
            <button onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
