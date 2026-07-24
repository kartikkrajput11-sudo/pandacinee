import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Settings2,
} from "lucide-react";

export type CustomPlayerHandle = {
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  currentTime: () => number;
  duration: () => number;
  isPaused: () => boolean;
  setMuted: (m: boolean) => void;
  isMuted: () => boolean;
  setPlaybackRate: (r: number) => void;
};

export type QualitySource = { label: string; src: string; height?: number };

type Props = {
  src: string;
  /** Optional multi-quality variants. When present, exposes a quality menu. */
  sources?: QualitySource[];
  poster?: string | null;
  startAt?: number;
  onEvent?: (evt: {
    event: "play" | "pause" | "seeked" | "timeupdate" | "ended" | "ratechange";
    currentTime: number;
    duration: number;
    playbackRate: number;
  }) => void;
  onReady?: (handle: CustomPlayerHandle) => void;
  /** When true, only the remote host may control playback: viewer cannot play/pause/seek/skip. */
  locked?: boolean;
  /** Called when a locked viewer attempts a restricted action. */
  onLockedAttempt?: () => void;
  /** Called when the browser cannot get playable media data from the source. */
  onLoadIssue?: (reason: "timeout" | "error") => void;
  /** Called whenever the local <video> stalls or resumes — used for SyncPlay-style buffer sync. */
  onBufferingChange?: (state: "waiting" | "ready") => void;
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

export function CustomMoviePlayer({ src, sources, poster, startAt, onEvent, onReady, locked = false, onLockedAttempt, onLoadIssue, onBufferingChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onLoadIssueRef = useRef(onLoadIssue);
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
  const bufferTimer = useRef<number | null>(null);
  const scrubbing = useRef(false);

  // Quality variants. If `sources` isn't provided, expose the single `src` as "Auto".
  const qualityList = useMemo<QualitySource[]>(() => {
    if (sources && sources.length > 0) return sources;
    return [{ label: "Auto", src }];
  }, [sources, src]);

  // Pick an initial quality: on slow / metered connections prefer the lowest,
  // otherwise the highest. This is the biggest single win for time-to-first-frame.
  const [qualityIdx, setQualityIdx] = useState<number>(() => {
    if (qualityList.length <= 1) return 0;
    const conn = (typeof navigator !== "undefined" ? (navigator as any).connection : null) as
      | { effectiveType?: string; saveData?: boolean }
      | null;
    const slow = !!conn && (conn.saveData || /2g|slow-2g/i.test(conn.effectiveType ?? ""));
    // Sort by height ascending for slow, descending for fast.
    const indexed = qualityList.map((q, i) => ({ i, h: q.height ?? 0 }));
    indexed.sort((a, b) => (slow ? a.h - b.h : b.h - a.h));
    return indexed[0]?.i ?? 0;
  });
  const [qualityOpen, setQualityOpen] = useState(false);
  const activeSrc = qualityList[qualityIdx]?.src ?? src;

  useEffect(() => {
    return () => {
      if (bufferTimer.current) window.clearTimeout(bufferTimer.current);
      // Fully tear down audio on unmount. Detached <video> elements can keep
      // playing audio in Chromium/WebKit until GC — that causes the "sound
      // plays twice" and "video paused but audio continues" glitches during
      // sync-triggered remounts (iframeKey bumps, source swaps, PiP exit).
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
          v.muted = true;
          v.removeAttribute("src");
          v.load();
        } catch { /* ignore */ }
      }
      try {
        if (document.pictureInPictureElement === videoRef.current) {
          (document as any).exitPictureInPicture?.();
        }
      } catch { /* ignore */ }
    };
  }, []);

  // Ref-cache the callback so we don't add it to every stop/start dep array.
  const onBufferingChangeRef = useRef(onBufferingChange);
  useEffect(() => { onBufferingChangeRef.current = onBufferingChange; }, [onBufferingChange]);
  // Followers must NEVER broadcast buffering upstream — their locked seeks/
  // pauses emit spurious `waiting` events that would auto-pause the host.
  const lockedRef = useRef(locked);
  useEffect(() => { lockedRef.current = locked; }, [locked]);
  const notifyBuffering = (state: "waiting" | "ready") => {
    if (lockedRef.current) return;
    onBufferingChangeRef.current?.(state);
  };


  // Debounce the "waiting" broadcast so brief stalls / drift-correction seeks
  // (<800ms) don't ping-pong the partner into an auto-pause loop.
  const waitingNotifyTimer = useRef<number | null>(null);
  const waitingNotifiedRef = useRef(false);
  const clearWaitingNotify = () => {
    if (waitingNotifyTimer.current) {
      window.clearTimeout(waitingNotifyTimer.current);
      waitingNotifyTimer.current = null;
    }
  };

  const stopBuffering = useCallback(() => {
    if (bufferTimer.current) {
      window.clearTimeout(bufferTimer.current);
      bufferTimer.current = null;
    }
    setBuffering(false);
    clearWaitingNotify();
    if (waitingNotifiedRef.current) {
      waitingNotifiedRef.current = false;
      notifyBuffering("ready");
    }
  }, []);

  const startBuffering = useCallback(() => {
    setBuffering(true);
    clearWaitingNotify();
    waitingNotifyTimer.current = window.setTimeout(() => {
      waitingNotifiedRef.current = true;
      notifyBuffering("waiting");
    }, 800);
    if (bufferTimer.current) window.clearTimeout(bufferTimer.current);
    bufferTimer.current = window.setTimeout(() => {
      setBuffering(false);
      setShowControls(true);
      clearWaitingNotify();
      if (waitingNotifiedRef.current) {
        waitingNotifiedRef.current = false;
        notifyBuffering("ready");
      }
    }, 6500);
  }, []);


  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onLoadIssueRef.current = onLoadIssue;
  }, [onLoadIssue]);

  useEffect(() => {
    const v = videoRef.current;
    setBuffering(false);
    setDuration(0);
    setTime(0);
    if (!v || !activeSrc) return;
    try {
      v.preload = "auto";
      v.load();
    } catch {}
    const timer = window.setTimeout(() => {
      if (v.readyState < 1 || !Number.isFinite(v.duration)) {
        stopBuffering();
        setShowControls(true);
        onLoadIssueRef.current?.("timeout");
      }
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [activeSrc, stopBuffering]);

  // Attach handle for parent sync control. Keep this independent from the
  // parent's callback identity so parent state updates cannot retrigger onReady
  // forever while playback time updates are rendering.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !onReadyRef.current) return;
    try { v.volume = 1; } catch {}
    onReadyRef.current({
      play: () => {
        setBuffering(true);
        // Wait until the video is actually buffered enough to play. Calling
        // .play() before HAVE_FUTURE_DATA is the classic "guest sees a black
        // frame" bug on watch parties — the browser accepts the call but has
        // no frame to render yet.
        const attempt = () => {
          v.play()
            .then(() => stopBuffering())
            .catch(() => {
              // Autoplay was blocked (no user gesture yet). Retry muted so the
              // follower still stays in sync — they can tap the speaker to unmute.
              try {
                v.muted = true;
                setMuted(true);
                v.play()
                  .then(() => {
                    stopBuffering();
                    setShowControls(true);
                  })
                  .catch(() => {
                    stopBuffering();
                    setPlaying(false);
                    setShowControls(true);
                  });
              } catch {
                stopBuffering();
                setPlaying(false);
                setShowControls(true);
              }
            });
        };
        if (v.readyState >= 2) {
          attempt();
        } else {
          const onReadyToPlay = () => {
            v.removeEventListener("loadeddata", onReadyToPlay);
            v.removeEventListener("canplay", onReadyToPlay);
            attempt();
          };
          // `loadeddata` fires ~1 frame after the first byte of media is decoded —
          // usually 500ms-1s earlier than `canplay`, which needs enough buffer to
          // play "for a while". This is the biggest time-to-first-frame win.
          v.addEventListener("loadeddata", onReadyToPlay);
          v.addEventListener("canplay", onReadyToPlay);
          // Safety: if buffering stalls, still try after 6s so we don't hang forever.
          window.setTimeout(() => {
            v.removeEventListener("loadeddata", onReadyToPlay);
            v.removeEventListener("canplay", onReadyToPlay);
            if (v.paused) attempt();
          }, 6000);
        }
      },
      pause: () => { v.pause(); stopBuffering(); },
      seek: (t: number) => {
        try {
          v.currentTime = Math.max(0, t);
        } catch {}
      },
      currentTime: () => v.currentTime,
      duration: () => v.duration,
      isPaused: () => v.paused,
      setMuted: (m: boolean) => { v.muted = m; setMuted(m); },
      isMuted: () => v.muted,
      setPlaybackRate: (r: number) => { try { v.playbackRate = r; setRate(r); } catch {} },
    });
  }, [activeSrc, stopBuffering]);

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
  }, [activeSrc, startAt]);

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
        if (locked) { onLockedAttempt?.(); return; }
        v.paused ? v.play() : v.pause();
      } else if (e.key === "ArrowRight") {
        if (locked) { e.preventDefault(); onLockedAttempt?.(); return; }
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
      } else if (e.key === "ArrowLeft") {
        if (locked) { e.preventDefault(); onLockedAttempt?.(); return; }
        v.currentTime = Math.max(0, v.currentTime - 10);
      } else if (e.key === "f") {
        toggleFullscreen();
      } else if (e.key === "m") {
        v.muted = !v.muted;
      } else if (e.key === "j" || e.key === "l") {
        if (locked) { e.preventDefault(); onLockedAttempt?.(); return; }
        v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + (e.key === "l" ? 10 : -10)));
      }
      scheduleHide();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [scheduleHide, locked, onLockedAttempt]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (locked) { onLockedAttempt?.(); return; }
    v.paused ? v.play().catch(() => {}) : v.pause();
  }

  function skip(delta: number) {
    if (locked) { onLockedAttempt?.(); return; }
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
    if (locked) { onLockedAttempt?.(); return; }
    const v = videoRef.current;
    if (!v || !duration) return;
    const t = (Number(e.target.value) / 1000) * duration;
    v.currentTime = t;
    setTime(t);
  }

  const progressPct = duration > 0 ? (time / duration) * 100 : 0;

  const changeQuality = useCallback((idx: number) => {
    const v = videoRef.current;
    const targetTime = v?.currentTime ?? 0;
    const wasPlaying = !!v && !v.paused;
    setQualityIdx(idx);
    setQualityOpen(false);
    // The src-change effect will call load() on the new source. Once it's
    // seekable, restore position and resume if we were playing.
    requestAnimationFrame(() => {
      const nv = videoRef.current;
      if (!nv) return;
      const resume = () => {
        try { nv.currentTime = targetTime; } catch {}
        if (wasPlaying) nv.play().catch(() => {});
      };
      if (nv.readyState >= 1) resume();
      else nv.addEventListener("loadedmetadata", resume, { once: true });
    });
  }, []);


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
        src={activeSrc}
        poster={poster ?? undefined}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          stopBuffering();
        }}
        onLoadedData={stopBuffering}
        onCanPlay={stopBuffering}
        onCanPlayThrough={stopBuffering}
        onTimeUpdate={(e) => {
          if (scrubbing.current) return;
          const v = e.currentTarget;
          setTime(v.currentTime);
          onEvent?.({ event: "timeupdate", currentTime: v.currentTime, duration: v.duration, playbackRate: v.playbackRate });
        }}
        onPlay={(e) => {
          setPlaying(true);
          stopBuffering();
          scheduleHide();
          onEvent?.({ event: "play", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration, playbackRate: e.currentTarget.playbackRate });
        }}
        onPause={(e) => {
          setPlaying(false);
          stopBuffering();
          setShowControls(true);
          onEvent?.({ event: "pause", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration, playbackRate: e.currentTarget.playbackRate });
        }}
        onSeeked={(e) => {
          stopBuffering();
          onEvent?.({ event: "seeked", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration, playbackRate: e.currentTarget.playbackRate });
        }}
        onRateChange={(e) => {
          setRate(e.currentTarget.playbackRate);
          onEvent?.({ event: "ratechange", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration, playbackRate: e.currentTarget.playbackRate });
        }}
        onWaiting={startBuffering}
        onStalled={startBuffering}
        onSuspend={stopBuffering}
        onPlaying={stopBuffering}
        onError={() => {
          stopBuffering();
          onLoadIssueRef.current?.("error");
        }}
        onEnded={(e) => onEvent?.({ event: "ended", currentTime: e.currentTarget.currentTime, duration: e.currentTarget.duration, playbackRate: e.currentTarget.playbackRate })}
        onClick={locked ? undefined : togglePlay}
      />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-12 rounded-full border-2 border-petal border-t-transparent animate-spin" />
        </div>
      )}

      {/* Center status button when paused. In locked (follower) mode this does
          not start an independent player; only the host's sync event can play. */}
      {!playing && !buffering && (
        <button
          onClick={togglePlay}
          aria-label={locked ? "Waiting for host" : "Play"}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <span className="size-16 md:size-20 rounded-full bg-petal text-velvet flex items-center justify-center shadow-2xl shadow-petal/40">
            <Play className="size-7 md:size-9 fill-velvet ml-1" />
          </span>
          {locked && (
            <span className="absolute bottom-16 md:bottom-20 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white/90 text-[11px] tracking-wide">
              Waiting for host · playback is synced
            </span>
          )}
        </button>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 px-2 md:px-4 pb-2 md:pb-3 pt-6 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-all duration-500 ${
          showControls || !playing ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        {/* Luxurious glass panel wrapping the bar */}
        <div className="relative rounded-xl px-2 py-1.5 md:px-3 md:py-2 bg-white/[0.06] backdrop-blur-2xl border border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]">
          {/* Petal glow accent */}
          <div aria-hidden className="pointer-events-none absolute -top-16 -left-10 h-32 w-56 rounded-full bg-petal/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 h-32 w-56 rounded-full bg-petal/15 blur-3xl" />
          {/* Sheen line at top */}
          <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {/* Progress — luxury scrub bar */}
        <div className="relative mb-3 group/scrub py-2">
          {/* Ambient glow that intensifies on hover */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-6 rounded-full pointer-events-none opacity-0 group-hover/scrub:opacity-100 transition-opacity duration-500"
            style={{
              background:
                "radial-gradient(60% 100% at var(--px, 0%) 50%, rgba(238,130,175,0.35), transparent 70%)",
              filter: "blur(10px)",
            }}
          />
          {/* Track */}
          <div className="relative h-[3px] group-hover/scrub:h-[6px] transition-[height] duration-300 rounded-full bg-white/15 backdrop-blur-sm overflow-hidden ring-1 ring-white/5">
            {/* Base track shimmer */}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
            {/* Filled portion — gradient + shine sweep */}
            <div
              className="relative h-full rounded-full transition-[width] duration-100"
              style={{
                width: `${progressPct}%`,
                background:
                  "linear-gradient(90deg, rgba(238,130,175,0.9) 0%, rgba(255,180,205,1) 55%, rgba(238,130,175,0.95) 100%)",
                boxShadow:
                  "0 0 12px rgba(238,130,175,0.55), 0 0 24px rgba(238,130,175,0.35), inset 0 0 6px rgba(255,255,255,0.35)",
              }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 -right-4 w-8 opacity-70"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
                  filter: "blur(2px)",
                }}
              />
            </div>
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
            onMouseMove={(e) => {
              const el = e.currentTarget as HTMLInputElement;
              const rect = el.getBoundingClientRect();
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              el.parentElement?.style.setProperty("--px", `${pct}%`);
            }}
            disabled={locked}
            aria-label="Seek"
            className={`absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-8 opacity-0 ${locked ? "cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
          />
          {/* Thumb — jeweled */}
          <div
            className="absolute top-1/2 pointer-events-none transition-[left,transform] duration-100"
            style={{ left: `calc(${progressPct}% - 8px)`, transform: "translateY(-50%)" }}
          >
            <span
              aria-hidden
              className="absolute -inset-2 rounded-full bg-petal/40 blur-md opacity-0 group-hover/scrub:opacity-100 transition-opacity duration-300"
            />
            <span
              className="relative block size-4 rounded-full bg-gradient-to-br from-white to-white/70 ring-2 ring-petal/70 shadow-[0_2px_10px_rgba(238,130,175,0.9),0_0_0_1px_rgba(255,255,255,0.4)_inset] scale-90 group-hover/scrub:scale-110 transition-transform duration-300"
            />
          </div>
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
                max={100}
              value={muted ? 0 : Math.round(volume * 100)}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                const pct = Number(e.target.value);
                const val = pct / 100;
                  v.volume = val;
                v.muted = val === 0;
                setVolume(val);
                setMuted(val === 0);
              }}
              className="w-24 accent-petal"
              aria-label="Volume"
                title={`${Math.round(volume * 100)}%`}
            />
          </div>



          <div className="ml-auto flex items-center gap-2">
            <span className="tabular-nums text-white/90">
              {fmt(time)} / {fmt(duration)}
            </span>

            {!locked && (
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
                  <div className="absolute right-0 bottom-11 z-50 bg-black/90 border border-white/10 rounded-2xl p-1.5 flex flex-col gap-0.5 min-w-[80px] shadow-2xl">

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
            )}

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
    </div>
  );
}
