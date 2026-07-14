import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Send,
  RefreshCw,
  Maximize2,
  Play,
  Radio,
  Rewind,
  FastForward,
  Timer,
  Sparkles,
  CircleDot,
  Wifi,
  WifiOff,
  Moon,
  MonitorPlay,
  Server,
  Check,
  Heart,
  MessageCircle,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { tmdbMovie } from "@/lib/tmdb.functions";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { WatchTogetherPanel } from "@/components/watch/WatchTogetherPanel";
import { useWatchSync, fmtTime } from "@/hooks/useWatchSync";
import { CustomMoviePlayer, type CustomPlayerHandle } from "@/components/CustomMoviePlayer";

type Source = { id: string; label: string; url: (tmdb: number, startAt?: number) => string; hint: string };

const SOURCES: Source[] = [
  {
    id: "vidking-auto",
    label: "Velvet HD",
    hint: "Autoplay enabled — recommended",
    url: (id, t) =>
      `https://www.vidking.net/embed/movie/${id}?color=9146ff&autoPlay=true${t ? `&progress=${Math.floor(t)}` : ""}`,
  },
  {
    id: "vidking-manual",
    label: "Velvet Manual",
    hint: "Press play inside the player",
    url: (id, t) =>
      `https://www.vidking.net/embed/movie/${id}?color=9146ff${t ? `&progress=${Math.floor(t)}` : ""}`,
  },
  {
    id: "vidking-clean",
    label: "Basic",
    hint: "Minimal fallback embed",
    url: (id, t) => `https://www.vidking.net/embed/movie/${id}${t ? `?progress=${Math.floor(t)}` : ""}`,
  },
];

const REACTIONS = ["❤️", "🔥", "😂", "😱", "🥰", "🍿"];

export const Route = createFileRoute("/_authenticated/app/movies/$id/watch")({
  component: WatchMovie,
});

function WatchMovie() {
  const { id } = Route.useParams();
  const isCustom = id.startsWith("custom:");
  const tmdbId = Number(id);
  const fetchMovie = useServerFn(tmdbMovie);
  if (isCustom) return <CustomWatch customId={id.slice("custom:".length)} />;
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const partner = prof?.partner;
  const navigate = useNavigate();
  const [movie, setMovie] = useState<any>(null);
  const [pandacine, setPandacine] = useState<{ videoSrc: string; title: string | null } | null>(null);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [started, setStarted] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [slowPlayer, setSlowPlayer] = useState(false);
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const [autoFollow, setAutoFollow] = useState(false);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [floaties, setFloaties] = useState<{ id: number; emoji: string; x: number; from: "me" | "partner" }[]>([]);
  const lastPublishRef = useRef(0);

  const {
    mine,
    peer,
    partnerOnline,
    publish,
    sendSeek,
    sendCountdown,
    countdown,
    clearCountdown,
    incomingSeek,
    clearIncomingSeek,
    incomingReaction,
    clearIncomingReaction,
    sendReaction,
    hostId,
    claimHost,
    releaseHost,
    drift,
  } = useWatchSync(me?.id ?? null, partner?.id ?? null, tmdbId, "movie");

  const iAmHost = !!me && hostId === me.id;
  const partnerIsHost = !!partner && hostId === partner.id;
  const lastAppliedPeerEventRef = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, ovRes] = await Promise.all([
        fetchMovie({ data: { id: tmdbId } }).catch(() => null),
        supabase
          .from("custom_movies")
          .select("title, overview, poster_url, backdrop_url, runtime, video_url, video_storage_path")
          .eq("tmdb_id", tmdbId)
          .maybeSingle(),
      ]);
      if (!alive) return;
      const ov = ovRes.data as {
        title?: string; overview?: string | null;
        poster_url?: string | null; backdrop_url?: string | null; runtime?: number | null;
        video_url?: string | null; video_storage_path?: string | null;
      } | null;
      if (m && ov) {
        if (ov.title) m.title = ov.title;
        if (ov.overview != null) m.overview = ov.overview;
        if (ov.poster_url) m.poster_path = ov.poster_url;
        if (ov.backdrop_url) m.backdrop_path = ov.backdrop_url;
        if (ov.runtime) m.runtime = ov.runtime;
      }
      setMovie(m);

      // Resolve a Pandacine (self-hosted) video source when the admin has one
      if (ov?.video_storage_path) {
        const { data: signed } = await supabase.storage
          .from("custom-movies")
          .createSignedUrl(ov.video_storage_path, 60 * 60 * 6);
        if (signed?.signedUrl) setPandacine({ videoSrc: signed.signedUrl, title: ov.title ?? null });
      } else if (ov?.video_url) {
        setPandacine({ videoSrc: ov.video_url, title: ov.title ?? null });
      } else {
        setPandacine(null);
      }
    })();
    return () => { alive = false; };
  }, [tmdbId]);

  // Capture VidKing events, publish to partner (throttled)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!String(event.origin).includes("vidking.net")) return;
      try {
        const message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (message?.type !== "PLAYER_EVENT") return;
        const data = message.data ?? {};
        const evt: string = data.event ?? "timeupdate";
        const currentTime: number = Number(data.currentTime ?? 0);
        const duration: number = Number(data.duration ?? mine.duration ?? 0);
        setSlowPlayer(false);
        const now = Date.now();
        const isDiscrete = evt === "play" || evt === "pause" || evt === "seeked" || evt === "ended";
        if (isDiscrete || now - lastPublishRef.current > 2000) {
          lastPublishRef.current = now;
          publish({ event: evt, currentTime, duration, sourceIdx });
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [publish, sourceIdx, mine.duration]);

  useEffect(() => {
    if (!started) return;
    setSlowPlayer(false);
    const t = window.setTimeout(() => setSlowPlayer(true), 14000);
    return () => window.clearTimeout(t);
  }, [started, sourceIdx, iframeKey]);

  useEffect(() => {
    if (!incomingSeek) return;
    if (autoFollow) {
      applySeek(incomingSeek.time);
      clearIncomingSeek();
    }
  }, [incomingSeek, autoFollow]);

  // Floating reactions from partner
  useEffect(() => {
    if (!incomingReaction) return;
    const f = { id: incomingReaction.id, emoji: incomingReaction.emoji, x: 20 + Math.random() * 60, from: "partner" as const };
    setFloaties((prev) => [...prev, f]);
    const t = window.setTimeout(() => {
      setFloaties((prev) => prev.filter((p) => p.id !== f.id));
      clearIncomingReaction();
    }, 2400);
    return () => window.clearTimeout(t);
  }, [incomingReaction, clearIncomingReaction]);

  // Sleep timer
  useEffect(() => {
    if (!sleepAt) return;
    const iv = window.setInterval(() => {
      if (Date.now() >= sleepAt) {
        // Reload iframe without autoplay to effectively pause
        setStarted(false);
        setSleepAt(null);
        setSleepMinutes(null);
        toast.info("Sleep timer — sweet dreams 🌙");
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, [sleepAt]);

  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!countdown) { setCountdownRemaining(null); return; }
    const tick = () => {
      const rem = Math.ceil((countdown.startAt - Date.now()) / 1000);
      if (rem <= 0) {
        setCountdownRemaining(0);
        if (typeof countdown.time === "number") setStartAt(countdown.time);
        setStarted(true);
        setPlayerLoading(true);
        setIframeKey((k) => k + 1);
        setTimeout(() => { clearCountdown(); setCountdownRemaining(null); }, 800);
      } else {
        setCountdownRemaining(rem);
      }
    };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
  }, [countdown, clearCountdown]);

  const [pausedByHost, setPausedByHost] = useState(false);

  // Merge Pandacine (self-hosted) as an extra source in front of the VidKing sources.
  const allSources = useMemo(() => {
    const list: { id: string; label: string; hint: string; kind: "pandacine" | "vidking"; buildUrl?: (id: number, t?: number) => string }[] = [];
    if (pandacine) {
      list.push({
        id: "pandacine",
        label: "Pandacine",
        hint: "Our own server — sync-ready",
        kind: "pandacine",
      });
    }
    for (const s of SOURCES) list.push({ id: s.id, label: s.label, hint: s.hint, kind: "vidking", buildUrl: s.url });
    return list;
  }, [pandacine]);

  // Clamp sourceIdx when the list changes.
  useEffect(() => {
    if (sourceIdx >= allSources.length) setSourceIdx(0);
  }, [allSources.length, sourceIdx]);

  const currentSource = allSources[sourceIdx] ?? allSources[0];
  const isPandacine = currentSource?.kind === "pandacine";

  const src = useMemo(() => {
    if (!currentSource || currentSource.kind === "pandacine") return "";
    // When host paused, force a manual (no-autoplay) URL so playback stops at that time.
    if (pausedByHost) return SOURCES[1].url(tmdbId, startAt);
    return currentSource.buildUrl!(tmdbId, startAt);
  }, [currentSource, tmdbId, startAt, pausedByHost]);


  const applySeek = useCallback((time: number, opts?: { pause?: boolean }) => {
    setStartAt(time);
    setPausedByHost(!!opts?.pause);
    setStarted(true);
    setPlayerLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  // Follower auto-sync: when partner is host, mirror their play/pause/seek
  useEffect(() => {
    if (!peer || !partnerIsHost || !me) return;
    if (peer.updatedAt <= lastAppliedPeerEventRef.current) return;
    const evt = peer.event;
    // Only react to discrete transport events
    if (evt !== "play" && evt !== "pause" && evt !== "seeked" && evt !== "timeupdate") return;
    // For timeupdate, only re-sync if drift is significant
    if (evt === "timeupdate") {
      const d = Math.abs(mine.currentTime - peer.currentTime);
      if (d < 6) return;
    }
    lastAppliedPeerEventRef.current = peer.updatedAt;
    if (evt === "pause") {
      applySeek(peer.currentTime, { pause: true });
      toast.info(`${partner?.display_name.split(" ")[0]} paused`);
    } else {
      applySeek(peer.currentTime, { pause: false });
      if (evt === "seeked") toast.info(`${partner?.display_name.split(" ")[0]} skipped`);
    }
  }, [peer, partnerIsHost, me, mine.currentTime, applySeek, partner]);

  async function inviteToWatch() {
    if (!me || !partner || !movie) return;
    const link = `${window.location.origin}/app/movies/${tmdbId}/watch`;
    const content = `🎬 Let's watch *${movie.title}* together 💞\n${link}`;
    const { error } = await supabase.from("messages").insert({
      sender_id: me.id, receiver_id: partner.id, content, type: "text",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Invite sent — press play together 🍿");
      navigate({ to: "/app/chat/$peerId", params: { peerId: partner.id } });
    }
  }

  function openFullscreen() {
    const el = document.getElementById("movie-frame");
    if (el && (el as any).requestFullscreen) (el as any).requestFullscreen();
  }

  function switchSource(i: number) {
    setSourceIdx(i);
    setSourceMenuOpen(false);
    setStarted(true);
    setPlayerLoading(true);
    setIframeKey((k) => k + 1);
  }

  function startCountdown(seconds = 4) {
    const syncTime = peer && peer.currentTime > mine.currentTime ? peer.currentTime : mine.currentTime;
    sendCountdown(seconds, syncTime > 5 ? syncTime : undefined);
  }

  function syncToPartner() {
    if (!peer) return toast.info("Waiting for partner's player…");
    applySeek(Math.max(0, peer.currentTime - 1));
    toast.success(`Synced to ${partner?.display_name.split(" ")[0]} at ${fmtTime(peer.currentTime)}`);
  }

  function pullPartnerHere() {
    sendSeek(mine.currentTime);
    toast.success("Sync request sent 💞");
  }

  function fireReaction(emoji: string) {
    const f = { id: Date.now() + Math.random(), emoji, x: 20 + Math.random() * 60, from: "me" as const };
    setFloaties((prev) => [...prev, f]);
    window.setTimeout(() => setFloaties((prev) => prev.filter((p) => p.id !== f.id)), 2400);
    if (partner) sendReaction(emoji);
  }

  function setSleep(minutes: number | null) {
    if (minutes == null) { setSleepMinutes(null); setSleepAt(null); toast.info("Sleep timer off"); return; }
    setSleepMinutes(minutes);
    setSleepAt(Date.now() + minutes * 60 * 1000);
    toast.success(`Sleep in ${minutes} min 🌙`);
  }

  const progressPct = mine.duration > 0 ? Math.min(100, (mine.currentTime / mine.duration) * 100) : 0;
  const peerPct = peer && peer.duration > 0 ? Math.min(100, (peer.currentTime / peer.duration) * 100) : 0;
  const driftAbs = drift != null ? Math.abs(drift) : null;
  const inSync = driftAbs != null && driftAbs < 3;
  const partnerFirst = partner?.display_name.split(" ")[0] ?? "them";
  const backdropUrl = movie?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;

  return (
    <div className={`relative min-h-screen pt-6 pb-24 transition-colors duration-500 ${cinemaMode ? "bg-black" : ""}`}>
      {/* Ambient backdrop glow */}
      {backdropUrl && !cinemaMode && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-30"
          style={{
            backgroundImage: `url(${backdropUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(80px) saturate(1.3)",
          }}
        />
      )}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-velvet/90 via-velvet to-velvet" />

      {/* Header */}
      <header className={`px-5 pb-4 flex items-center gap-3 max-w-6xl mx-auto transition-opacity ${cinemaMode ? "opacity-30 hover:opacity-100" : ""}`}>
        <Link to="/app/movies/$id" params={{ id }} className="size-9 rounded-full bg-surface/70 backdrop-blur border border-border flex items-center justify-center text-candle">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-petal flex items-center gap-1.5">
            <Radio className="size-3 animate-pulse" /> Now Screening
            {iAmHost && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-petal text-velvet text-[9px] font-bold">
                <Crown className="size-2.5" /> HOSTING
              </span>
            )}
            {partnerIsHost && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-petal/20 border border-petal/40 text-petal text-[9px] font-bold">
                <Crown className="size-2.5" /> FOLLOWING
              </span>
            )}
          </p>
          <h1 className="font-serif text-lg md:text-2xl italic truncate text-candle">
            {movie?.title ?? "Loading…"}
            {movie?.release_date && (
              <span className="text-candle-muted not-italic font-sans text-sm md:text-base ml-2">
                · {movie.release_date.slice(0, 4)}
              </span>
            )}
          </h1>
        </div>
        <button
          onClick={() => setCinemaMode((v) => !v)}
          className={`size-9 rounded-full backdrop-blur border flex items-center justify-center transition ${cinemaMode ? "bg-petal text-velvet border-petal" : "bg-surface/70 border-border text-candle"}`}
          aria-label="Cinema mode"
          title="Cinema mode"
        >
          <Moon className="size-4" />
        </button>
        <button
          onClick={openFullscreen}
          className="size-9 rounded-full bg-surface/70 backdrop-blur border border-border flex items-center justify-center text-candle"
          aria-label="Fullscreen"
        >
          <Maximize2 className="size-4" />
        </button>
      </header>

      <div className="px-3 md:px-5 max-w-6xl mx-auto">
        {/* Partner sync bar */}
        {partner && !cinemaMode && (
          <div className="mb-3 rounded-2xl border border-border bg-surface/60 backdrop-blur px-3 py-2.5 flex items-center gap-3">
            <div className="relative shrink-0">
              {partner.avatar_url ? (
                <img src={partner.avatar_url} alt={partner.display_name} className="size-10 rounded-full object-cover border border-border" />
              ) : (
                <div className="size-10 rounded-full bg-petal/20 border border-border flex items-center justify-center text-petal font-serif italic">
                  {partnerFirst[0]}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-velvet ${
                  partnerOnline ? "bg-green-400 animate-pulse" : "bg-candle-muted/60"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-candle font-semibold truncate">{partnerFirst}</span>
                {partnerOnline ? (
                  <span className="text-green-400 text-[10px] flex items-center gap-1"><Wifi className="size-2.5"/>in the room</span>
                ) : (
                  <span className="text-candle-muted text-[10px] flex items-center gap-1"><WifiOff className="size-2.5"/>waiting</span>
                )}
                {peer && (
                  <span className="text-candle-muted text-[10px] ml-auto flex items-center gap-1">
                    <CircleDot className={`size-2.5 ${peer.event === "play" ? "text-green-400" : peer.event === "pause" ? "text-amber-400" : "text-candle-muted"}`} />
                    {peer.event === "play" ? "Playing" : peer.event === "pause" ? "Paused" : peer.event}
                    · {fmtTime(peer.currentTime)}
                  </span>
                )}
              </div>
              <div className="mt-1.5 relative h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-petal/30 rounded-full transition-all" style={{ width: `${peerPct}%` }} />
                <div className="absolute inset-y-0 left-0 bg-petal rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                {peer && peer.duration > 0 && (
                  <span
                    className="absolute -top-1 size-3.5 rounded-full bg-candle border-2 border-petal shadow"
                    style={{ left: `calc(${peerPct}% - 7px)` }}
                    title={`${partnerFirst} at ${fmtTime(peer.currentTime)}`}
                  />
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-candle-muted">
                <span>You · {fmtTime(mine.currentTime)}</span>
                {driftAbs != null && (
                  <span className={inSync ? "text-green-400" : driftAbs > 15 ? "text-rose-400" : "text-amber-400"}>
                    {inSync ? "in sync ✓" : `${drift! > 0 ? "ahead" : "behind"} ${fmtTime(driftAbs)}`}
                  </span>
                )}
                <span>{mine.duration ? fmtTime(mine.duration) : "--:--"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Player — framed like a cinema screen */}
        <div className="relative">
          {/* Petal glow halo */}
          <div aria-hidden className="absolute -inset-2 rounded-[28px] bg-petal/20 blur-3xl opacity-60 pointer-events-none" />
          <div className="relative rounded-2xl md:rounded-3xl overflow-hidden bg-black border border-petal/30 aspect-video shadow-[0_30px_80px_-20px_rgba(238,130,175,0.35)]">
            {started ? (
              isPandacine && pandacine ? (
                <CustomMoviePlayer
                  key={`pandacine-${iframeKey}`}
                  src={pandacine.videoSrc}
                  poster={movie?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null}
                  onReady={() => setPlayerLoading(false)}
                  onEvent={(evt) => {
                    const now = Date.now();
                    const isDiscrete = evt.event === "play" || evt.event === "pause" || evt.event === "seeked" || evt.event === "ended";
                    if (isDiscrete || now - lastPublishRef.current > 2000) {
                      lastPublishRef.current = now;
                      publish({ event: evt.event, currentTime: evt.currentTime, duration: evt.duration, sourceIdx });
                    }
                  }}
                />
              ) : (
                <iframe
                  id="movie-frame"
                  key={`${sourceIdx}-${iframeKey}`}
                  src={src}
                  frameBorder={0}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  onLoad={() => setPlayerLoading(false)}
                  allowFullScreen
                />
              )
            ) : (
              <button
                onClick={() => { setStarted(true); setPlayerLoading(true); }}
                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 group"
                style={
                  backdropUrl
                    ? {
                        backgroundImage: `linear-gradient(to top, rgba(10,5,15,0.9), rgba(10,5,15,0.35)), url(${backdropUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <span className="size-20 md:size-24 rounded-full bg-petal text-velvet flex items-center justify-center shadow-2xl shadow-petal/50 group-hover:scale-105 transition ring-4 ring-petal/20">
                  <Play className="size-8 md:size-10 fill-velvet ml-1" />
                </span>
                <span className="text-candle font-serif italic text-lg md:text-xl">Raise the curtain</span>
                <span className="text-candle-muted text-[11px] uppercase tracking-[0.25em]">{currentSource?.label ?? "Loading"}</span>
              </button>
            )}

            {/* Floating reactions layer */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {floaties.map((f) => (
                <span
                  key={f.id}
                  className="absolute bottom-6 text-3xl md:text-4xl animate-float-up drop-shadow-[0_2px_12px_rgba(238,130,175,0.6)]"
                  style={{ left: `${f.x}%` }}
                >
                  {f.emoji}
                </span>
              ))}
            </div>

            {started && playerLoading && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-velvet/80">
                <div className="flex flex-col items-center gap-3 text-candle">
                  <RefreshCw className="size-6 animate-spin text-petal" />
                  <span className="text-xs uppercase tracking-widest text-candle-muted">Dimming the lights</span>
                </div>
              </div>
            )}
            {countdownRemaining != null && countdownRemaining > 0 && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-velvet/85 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.3em] text-petal mb-2">Pressing play together in</p>
                <p className="font-serif text-8xl md:text-9xl italic text-candle drop-shadow-[0_4px_24px_rgba(238,130,175,0.5)]">
                  {countdownRemaining}
                </p>
                <p className="mt-3 text-xs text-candle-muted">with {partnerFirst} 💞</p>
              </div>
            )}
            {started && slowPlayer && (
              <div className="absolute left-3 right-3 bottom-3 rounded-2xl bg-velvet/90 border border-border px-3 py-2 text-[11px] text-candle-muted backdrop-blur">
                Stuck? Try a different server from the ✦ menu below.
              </div>
            )}
          </div>
        </div>

        {/* Floating reaction bar */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => fireReaction(emoji)}
              className="size-10 rounded-full bg-surface/70 backdrop-blur border border-border hover:border-petal/60 hover:bg-petal/10 flex items-center justify-center text-xl transition active:scale-90"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Incoming seek request */}
        {incomingSeek && !autoFollow && (
          <div className="mt-3 rounded-2xl border border-petal bg-petal/10 px-3 py-2.5 flex items-center gap-3">
            <Sparkles className="size-4 text-petal shrink-0" />
            <p className="text-xs text-candle flex-1">
              {partnerFirst} wants to sync at <span className="text-petal font-semibold">{fmtTime(incomingSeek.time)}</span>
            </p>
            <button
              onClick={() => { applySeek(incomingSeek.time); clearIncomingSeek(); }}
              className="h-8 px-3 rounded-full bg-petal text-velvet text-xs font-semibold"
            >
              Jump
            </button>
            <button
              onClick={clearIncomingSeek}
              className="h-8 px-3 rounded-full bg-surface border border-border text-xs text-candle-muted"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Refined controls row */}
        <div className={`mt-4 grid gap-3 ${cinemaMode ? "opacity-40 hover:opacity-100 transition" : ""}`}>
          {/* Together tools */}
          {partner && (
            <div className="rounded-2xl border border-border bg-surface/40 backdrop-blur px-3 py-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Together</span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <Crown className={`size-3 ${hostId ? "text-petal" : "text-candle-muted/60"}`} />
                  <span className="text-candle-muted">
                    Host:{" "}
                    <span className={hostId ? "text-petal font-semibold" : ""}>
                      {iAmHost ? "You" : partnerIsHost ? partnerFirst : "no one"}
                    </span>
                  </span>
                </div>
              </div>

              {/* Host claim / release */}
              <div className="mb-2 flex items-center gap-2">
                {!iAmHost ? (
                  <button
                    onClick={claimHost}
                    className="flex-1 h-10 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-petal/30"
                  >
                    <Crown className="size-3.5" /> Take the reins
                  </button>
                ) : (
                  <button
                    onClick={releaseHost}
                    className="flex-1 h-10 rounded-full bg-surface border border-petal/60 text-petal text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Crown className="size-3.5 fill-petal" /> You're the host · release
                  </button>
                )}
              </div>

              {partnerIsHost && (
                <div className="mb-2 rounded-xl bg-petal/10 border border-petal/30 px-3 py-2 text-[11px] text-candle flex items-center gap-2">
                  <Crown className="size-3 text-petal shrink-0" />
                  <span>Auto-following {partnerFirst} — their play, pause & skips control your screen.</span>
                </div>
              )}

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => startCountdown(4)}
                  className="shrink-0 h-9 px-4 rounded-full bg-surface border border-border text-xs text-candle flex items-center gap-1.5"
                >
                  <Timer className="size-3.5" /> Countdown together
                </button>
                <button
                  onClick={syncToPartner}
                  disabled={!peer}
                  className="shrink-0 h-9 px-3 rounded-full bg-surface border border-border text-xs text-candle flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Rewind className="size-3.5" /> Jump to {partnerFirst}
                </button>
                <button
                  onClick={pullPartnerHere}
                  className="shrink-0 h-9 px-3 rounded-full bg-surface border border-border text-xs text-candle flex items-center gap-1.5"
                >
                  <FastForward className="size-3.5" /> Pull them here
                </button>
              </div>
            </div>
          )}

          {/* Row: source menu + sleep timer + invite */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {/* Source dropdown */}
            <div className="relative">
              <button
                onClick={() => setSourceMenuOpen((v) => !v)}
                className="w-full h-11 rounded-2xl bg-surface/60 backdrop-blur border border-border text-candle text-xs font-medium flex items-center justify-center gap-2"
              >
                <Server className="size-3.5 text-petal" />
                <span className="truncate">{SOURCES[sourceIdx].label}</span>
              </button>
              {sourceMenuOpen && (
                <div className="absolute z-20 top-full mt-2 left-0 right-0 rounded-2xl bg-velvet border border-border shadow-2xl shadow-black/60 overflow-hidden">
                  {SOURCES.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => switchSource(i)}
                      className="w-full px-3 py-2.5 flex items-start gap-2 text-left hover:bg-petal/10 border-b border-border/50 last:border-0"
                    >
                      <Check className={`size-3.5 mt-0.5 shrink-0 ${i === sourceIdx ? "text-petal" : "text-transparent"}`} />
                      <div className="min-w-0">
                        <div className="text-xs text-candle font-medium">{s.label}</div>
                        <div className="text-[10px] text-candle-muted truncate">{s.hint}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sleep timer */}
            <div className="relative group">
              <button className="w-full h-11 rounded-2xl bg-surface/60 backdrop-blur border border-border text-candle text-xs font-medium flex items-center justify-center gap-2">
                <Moon className="size-3.5 text-petal" />
                <span>{sleepMinutes ? `Sleep ${sleepMinutes}m` : "Sleep timer"}</span>
              </button>
              <div className="absolute z-20 top-full mt-2 left-0 right-0 rounded-2xl bg-velvet border border-border shadow-2xl shadow-black/60 overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition">
                {[15, 30, 45, 60, 90].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSleep(m)}
                    className="w-full px-3 py-2 text-left text-xs text-candle hover:bg-petal/10 border-b border-border/50"
                  >
                    In {m} minutes
                  </button>
                ))}
                {sleepMinutes && (
                  <button
                    onClick={() => setSleep(null)}
                    className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-petal/10"
                  >
                    Cancel timer
                  </button>
                )}
              </div>
            </div>

            {/* Invite / chat */}
            {partner ? (
              <button
                onClick={inviteToWatch}
                className="h-11 rounded-2xl bg-petal text-velvet font-semibold text-xs flex items-center justify-center gap-2 col-span-2 md:col-span-1 shadow-lg shadow-petal/30"
              >
                <Send className="size-4" /> Invite {partnerFirst}
              </button>
            ) : (
              <Link
                to="/app/invite"
                className="h-11 rounded-2xl bg-petal text-velvet font-semibold text-xs flex items-center justify-center gap-2 col-span-2 md:col-span-1"
              >
                <Send className="size-4" /> Invite partner
              </Link>
            )}
          </div>

          {/* Chat with partner shortcut */}
          {partner && (
            <Link
              to="/app/chat/$peerId"
              params={{ peerId: partner.id }}
              className="h-10 rounded-2xl bg-surface/40 backdrop-blur border border-border text-candle-muted text-xs flex items-center justify-center gap-2 hover:text-petal hover:border-petal/40 transition"
            >
              <MessageCircle className="size-3.5" /> Whisper to {partnerFirst}
            </Link>
          )}
        </div>
      </div>

      {me && partner && movie && (
        <WatchTogetherPanel
          me={me}
          partner={partner}
          movieId={tmdbId}
          movieTitle={movie.title}
          moviePoster={movie.poster_path ? `https://image.tmdb.org/t/p/w154${movie.poster_path}` : null}
          mediaType="movie"
        />
      )}
    </div>
  );
}

function CustomWatch({ customId }: { customId: string }) {
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const partner = prof?.partner;
  const [movie, setMovie] = useState<any>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    mine, peer, partnerOnline, publish, sendSeek, sendCountdown, countdown, clearCountdown,
    incomingSeek, clearIncomingSeek, hostId, claimHost, releaseHost, drift,
  } = useWatchSync(me?.id ?? null, partner?.id ?? null, 0, "movie");

  const handleRef = useRef<CustomPlayerHandle | null>(null);
  const suppressRef = useRef(false);
  const lastAppliedPeerEventRef = useRef<number>(0);

  const iAmHost = !!me && hostId === me.id;
  const partnerIsHost = !!partner && hostId === partner.id;

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("custom_movies").select("*").eq("id", customId).maybeSingle();
      if (!alive) return;
      if (error || !data) { setLoading(false); return; }
      setMovie(data);
      if (data.video_storage_path) {
        const { data: signed } = await supabase.storage.from("custom-movies").createSignedUrl(data.video_storage_path, 60 * 60 * 6);
        setVideoSrc(signed?.signedUrl ?? null);
      } else {
        setVideoSrc(data.video_url ?? null);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [customId]);

  // Manual seek request
  useEffect(() => {
    if (!incomingSeek) return;
    suppressRef.current = true;
    handleRef.current?.seek(incomingSeek.time);
    clearIncomingSeek();
    window.setTimeout(() => { suppressRef.current = false; }, 400);
  }, [incomingSeek, clearIncomingSeek]);

  // Follower: mirror host's discrete events + drift correction
  useEffect(() => {
    if (!peer || !partnerIsHost) return;
    if (peer.updatedAt <= lastAppliedPeerEventRef.current) return;
    const h = handleRef.current;
    if (!h) return;
    const evt = peer.event;
    if (evt !== "play" && evt !== "pause" && evt !== "seeked" && evt !== "timeupdate") return;

    if (evt === "timeupdate") {
      const d = Math.abs(h.currentTime() - peer.currentTime);
      if (d < 2) return; // native drift is tight
      suppressRef.current = true;
      h.seek(peer.currentTime);
      window.setTimeout(() => { suppressRef.current = false; }, 250);
      return;
    }

    lastAppliedPeerEventRef.current = peer.updatedAt;
    suppressRef.current = true;
    if (evt === "seeked") h.seek(peer.currentTime);
    if (evt === "play") { h.seek(peer.currentTime); h.play(); }
    if (evt === "pause") { h.seek(peer.currentTime); h.pause(); }
    window.setTimeout(() => { suppressRef.current = false; }, 400);
  }, [peer, partnerIsHost]);

  // Countdown → both press play together
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!countdown) { setCountdownRemaining(null); return; }
    const tick = () => {
      const rem = Math.ceil((countdown.startAt - Date.now()) / 1000);
      if (rem <= 0) {
        setCountdownRemaining(0);
        if (typeof countdown.time === "number") handleRef.current?.seek(countdown.time);
        handleRef.current?.play();
        setTimeout(() => { clearCountdown(); setCountdownRemaining(null); }, 800);
      } else setCountdownRemaining(rem);
    };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
  }, [countdown, clearCountdown]);

  const partnerFirst = partner?.display_name.split(" ")[0] ?? "them";
  const driftAbs = drift != null ? Math.abs(drift) : null;
  const inSync = driftAbs != null && driftAbs < 2;

  function handleEvent(evt: {
    event: "play" | "pause" | "seeked" | "timeupdate" | "ended";
    currentTime: number;
    duration: number;
  }) {
    // Only broadcast our own actions when we ARE the host, otherwise just publish state so partner can see our time
    // For follower's suppressed programmatic events, don't republish.
    if (suppressRef.current && (evt.event === "play" || evt.event === "pause" || evt.event === "seeked")) return;
    publish({ event: evt.event, currentTime: evt.currentTime, duration: evt.duration, sourceIdx: 0 });
  }

  return (
    <div className="pt-8 pb-24 max-w-6xl mx-auto">
      <header className="px-5 pb-3 flex items-center gap-3">
        <Link to="/app/movies/$id" params={{ id: `custom:${customId}` }} className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal flex items-center gap-2">
            <Radio className="size-3 animate-pulse" /> Private Screening
            {iAmHost && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-petal text-velvet text-[9px] font-bold">
                <Crown className="size-2.5" /> HOSTING
              </span>
            )}
            {partnerIsHost && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-petal/20 border border-petal/40 text-petal text-[9px] font-bold">
                <Crown className="size-2.5" /> FOLLOWING
              </span>
            )}
          </p>
          <h1 className="font-serif text-lg md:text-2xl italic truncate">{movie?.title ?? (loading ? "Loading…" : "Not found")}</h1>
        </div>
      </header>

      <div className="px-3 md:px-5">
        <div className="relative aspect-video">
          {movie?.use_vidking && movie?.tmdb_id ? (
            <iframe
              src={`https://www.vidking.net/embed/${movie.media_type ?? "movie"}/${movie.tmdb_id}?color=9146ff&autoPlay=true`}
              className="w-full h-full rounded-2xl bg-black"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : videoSrc ? (
            <CustomMoviePlayer
              src={videoSrc}
              poster={movie?.backdrop_url ?? movie?.poster_url ?? null}
              onReady={(h) => (handleRef.current = h)}
              onEvent={handleEvent}
            />
          ) : (
            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center text-candle-muted text-sm">
              {loading ? "Loading video…" : "No video available for this movie."}
            </div>
          )}
          {countdownRemaining != null && countdownRemaining > 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-velvet/85 backdrop-blur-sm rounded-2xl">
              <p className="text-[11px] uppercase tracking-[0.3em] text-petal mb-2">Together in</p>
              <p className="font-serif text-8xl italic text-candle drop-shadow-[0_4px_24px_rgba(238,130,175,0.5)]">
                {countdownRemaining}
              </p>
            </div>
          )}
        </div>

        {partner && (
          <div className="mt-3 rounded-2xl border border-border bg-surface/60 backdrop-blur px-3 py-3 space-y-3">
            <div className="flex items-center gap-3 text-xs">
              <span className={`size-2.5 rounded-full ${partnerOnline ? "bg-green-400 animate-pulse" : "bg-candle-muted/60"}`} />
              <span className="text-candle font-semibold">{partnerFirst}</span>
              <span className="text-candle-muted">
                · {peer ? `${peer.event} at ${fmtTime(peer.currentTime)}` : "not in room"}
              </span>
              {driftAbs != null && (
                <span className={`ml-auto text-[10px] ${inSync ? "text-green-400" : driftAbs > 8 ? "text-rose-400" : "text-amber-400"}`}>
                  {inSync ? "in sync ✓" : `±${fmtTime(driftAbs)}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!iAmHost ? (
                <button
                  onClick={claimHost}
                  className="flex-1 h-10 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-petal/30"
                >
                  <Crown className="size-3.5" /> Take the reins
                </button>
              ) : (
                <button
                  onClick={releaseHost}
                  className="flex-1 h-10 rounded-full bg-surface border border-petal/60 text-petal text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Crown className="size-3.5 fill-petal" /> You're the host · release
                </button>
              )}
              <button
                onClick={() => sendCountdown(4, mine.currentTime > 5 ? mine.currentTime : undefined)}
                className="h-10 px-3 rounded-full bg-surface border border-border text-xs text-candle flex items-center gap-1.5"
              >
                <Radio className="size-3.5" /> Countdown
              </button>
            </div>

            {partnerIsHost && (
              <div className="rounded-xl bg-petal/10 border border-petal/30 px-3 py-2 text-[11px] text-candle flex items-center gap-2">
                <Crown className="size-3 text-petal shrink-0" />
                <span>Auto-following {partnerFirst} — every play, pause & skip mirrors on your screen instantly.</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (peer) handleRef.current?.seek(peer.currentTime); }}
                disabled={!peer}
                className="flex-1 h-9 rounded-full bg-surface-elevated text-xs text-candle disabled:opacity-40"
              >
                Jump to {partnerFirst}
              </button>
              <button
                onClick={() => sendSeek(mine.currentTime)}
                className="flex-1 h-9 rounded-full bg-surface border border-border text-xs text-candle"
              >
                Pull them here
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

