import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Send,
  RefreshCw,
  Maximize2,
  ExternalLink,
  Play,
  Users,
  Radio,
  Rewind,
  FastForward,
  Timer,
  Sparkles,
  CircleDot,
  Wifi,
  WifiOff,
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
    label: "VidKing Auto",
    hint: "Autoplay enabled",
    url: (id, t) =>
      `https://www.vidking.net/embed/movie/${id}?color=9146ff&autoPlay=true${t ? `&progress=${Math.floor(t)}` : ""}`,
  },
  {
    id: "vidking-manual",
    label: "VidKing Manual",
    hint: "Press play inside the player",
    url: (id, t) =>
      `https://www.vidking.net/embed/movie/${id}?color=9146ff${t ? `&progress=${Math.floor(t)}` : ""}`,
  },
  {
    id: "vidking-clean",
    label: "VidKing Clean",
    hint: "Basic VidKing embed",
    url: (id, t) => `https://www.vidking.net/embed/movie/${id}${t ? `?progress=${Math.floor(t)}` : ""}`,
  },
];

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
  const [sourceIdx, setSourceIdx] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [started, setStarted] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [embeddedPreview, setEmbeddedPreview] = useState(false);
  const [slowPlayer, setSlowPlayer] = useState(false);
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const [autoFollow, setAutoFollow] = useState(false);
  const publishTimer = useRef<number | null>(null);
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
    drift,
  } = useWatchSync(me?.id ?? null, partner?.id ?? null, tmdbId, "movie");

  useEffect(() => {
    fetchMovie({ data: { id: tmdbId } }).then(setMovie).catch(() => setMovie(null));
  }, [tmdbId]);

  useEffect(() => {
    setEmbeddedPreview(window.self !== window.top);
  }, []);

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
        // Throttle timeupdate; always send discrete events
        const isDiscrete = evt === "play" || evt === "pause" || evt === "seeked" || evt === "ended";
        if (isDiscrete || now - lastPublishRef.current > 2000) {
          lastPublishRef.current = now;
          publish({ event: evt, currentTime, duration, sourceIdx });
        }
      } catch {
        /* ignore non-JSON provider messages */
      }
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

  // Handle incoming seek command
  useEffect(() => {
    if (!incomingSeek) return;
    if (autoFollow) {
      applySeek(incomingSeek.time);
      clearIncomingSeek();
    }
  }, [incomingSeek, autoFollow]);

  // Handle countdown → auto play
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!countdown) { setCountdownRemaining(null); return; }
    const tick = () => {
      const rem = Math.ceil((countdown.startAt - Date.now()) / 1000);
      if (rem <= 0) {
        setCountdownRemaining(0);
        // start playback at synced time if provided
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

  const src = useMemo(() => SOURCES[sourceIdx].url(tmdbId, startAt), [sourceIdx, tmdbId, startAt]);
  const fullPageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/movies/${tmdbId}/watch`
      : `/app/movies/${tmdbId}/watch`;

  const applySeek = useCallback((time: number) => {
    setStartAt(time);
    setStarted(true);
    setPlayerLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

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
    setStarted(true);
    setPlayerLoading(true);
    setIframeKey((k) => k + 1);
  }

  function startCountdown(seconds = 4) {
    // Broadcast + local start; sync at partner's current time if they're ahead of us
    const syncTime = peer && peer.currentTime > mine.currentTime ? peer.currentTime : mine.currentTime;
    sendCountdown(seconds, syncTime > 5 ? syncTime : undefined);
  }

  function syncToPartner() {
    if (!peer) return toast.info("Waiting for partner's player…");
    applySeek(Math.max(0, peer.currentTime - 1));
    toast.success(`Synced to ${partner?.display_name.split(" ")[0]} at ${fmtTime(peer.currentTime)}`);
  }

  function pullPartnerHere() {
    // Ask partner to jump to my current time
    sendSeek(mine.currentTime);
    toast.success("Sync request sent 💞");
  }

  const progressPct = mine.duration > 0 ? Math.min(100, (mine.currentTime / mine.duration) * 100) : 0;
  const peerPct = peer && peer.duration > 0 ? Math.min(100, (peer.currentTime / peer.duration) * 100) : 0;
  const driftAbs = drift != null ? Math.abs(drift) : null;
  const inSync = driftAbs != null && driftAbs < 3;
  const partnerFirst = partner?.display_name.split(" ")[0] ?? "them";

  return (
    <div className="pt-8 pb-24">
      <header className="px-5 pb-3 flex items-center gap-3 max-w-6xl mx-auto">
        <Link to="/app/movies/$id" params={{ id }} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal flex items-center gap-1.5">
            <Radio className="size-3 animate-pulse" /> Watch Party
          </p>
          <h1 className="font-serif text-lg md:text-2xl italic truncate">
            {movie?.title ?? "Loading…"}
            {movie?.release_date && (
              <span className="text-candle-muted not-italic font-sans text-sm md:text-base ml-2">
                ({movie.release_date.slice(0, 4)})
              </span>
            )}
          </h1>
        </div>
        <button
          onClick={openFullscreen}
          className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle"
          aria-label="Fullscreen"
        >
          <Maximize2 className="size-4" />
        </button>
      </header>

      <div className="px-3 md:px-5 max-w-6xl mx-auto">
        {embeddedPreview && (
          <div className="mb-3 rounded-2xl border border-petal/30 bg-petal-soft/10 px-4 py-3 text-xs text-candle-muted leading-relaxed">
            Playback works best in a full tab. Sync events still flow inside the preview.
            <a href={fullPageUrl} target="_blank" rel="noreferrer" className="ml-2 text-petal font-semibold underline underline-offset-4">
              Open full player
            </a>
          </div>
        )}

        {/* Partner sync bar */}
        {partner && (
          <div className="mb-3 rounded-2xl border border-border bg-surface/70 backdrop-blur px-3 py-2.5 flex items-center gap-3">
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
                  <span className="text-green-400 text-[10px] flex items-center gap-1"><Wifi className="size-2.5"/>in room</span>
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

        {/* Player */}
        <div className="relative rounded-2xl md:rounded-3xl overflow-hidden bg-black border border-border aspect-video">
          {started ? (
            <iframe
              id="movie-frame"
              key={`${sourceIdx}-${iframeKey}`}
              src={src}
              width="100%"
              height="600"
              frameBorder={0}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              onLoad={() => setPlayerLoading(false)}
              allowFullScreen
            />
          ) : (
            <button
              onClick={() => { setStarted(true); setPlayerLoading(true); }}
              className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 group"
              style={
                movie?.backdrop_path
                  ? {
                      backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45)), url(https://image.tmdb.org/t/p/w1280${movie.backdrop_path})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              <span className="size-16 md:size-20 rounded-full bg-petal text-velvet flex items-center justify-center shadow-2xl shadow-petal/40 group-hover:scale-105 transition">
                <Play className="size-7 md:size-9 fill-velvet ml-1" />
              </span>
              <span className="text-candle text-sm md:text-base font-medium">Tap to play</span>
              <span className="text-candle-muted text-[11px] md:text-xs">Source: {SOURCES[sourceIdx].label}</span>
            </button>
          )}
          {started && playerLoading && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-velvet/80">
              <div className="flex flex-col items-center gap-3 text-candle">
                <RefreshCw className="size-6 animate-spin text-petal" />
                <span className="text-xs uppercase tracking-widest text-candle-muted">Loading player</span>
              </div>
            </div>
          )}
          {countdownRemaining != null && countdownRemaining > 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-velvet/85 backdrop-blur-sm animate-fade-up">
              <p className="text-[11px] uppercase tracking-widest text-petal mb-2">Pressing play together in</p>
              <p className="font-serif text-8xl md:text-9xl italic text-candle drop-shadow-[0_4px_24px_rgba(238,130,175,0.5)]">
                {countdownRemaining}
              </p>
              <p className="mt-3 text-xs text-candle-muted">with {partnerFirst} 💞</p>
            </div>
          )}
          {started && slowPlayer && (
            <div className="absolute left-3 right-3 bottom-3 rounded-2xl bg-velvet/90 border border-border px-3 py-2 text-[11px] text-candle-muted backdrop-blur">
              Stuck at 00:00? Try <span className="text-petal">VidKing Manual</span> and press play inside the player.
            </div>
          )}
        </div>

        {/* Incoming seek request */}
        {incomingSeek && !autoFollow && (
          <div className="mt-3 rounded-2xl border border-petal bg-petal-soft/15 px-3 py-2.5 flex items-center gap-3 animate-fade-up">
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

        {/* Sync controls */}
        {partner && (
          <div className="mt-3 rounded-2xl border border-border bg-surface/50 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="size-3.5 text-petal" />
              <span className="text-[10px] uppercase tracking-widest text-candle-muted">Sync tools</span>
              <label className="ml-auto flex items-center gap-1.5 text-[10px] text-candle-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFollow}
                  onChange={(e) => setAutoFollow(e.target.checked)}
                  className="accent-petal"
                />
                Auto-follow {partnerFirst}
              </label>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => startCountdown(4)}
                className="shrink-0 h-9 px-4 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-petal/30"
              >
                <Timer className="size-3.5" /> Watch together (3-2-1)
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
              <button
                onClick={() => { setStartAt(undefined); setStarted(true); setPlayerLoading(true); setIframeKey((k) => k + 1); }}
                className="shrink-0 h-9 px-3 rounded-full bg-surface border border-border text-xs text-candle-muted flex items-center gap-1.5"
                title="Restart from beginning"
              >
                <RefreshCw className="size-3.5" /> Restart
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-[10px] uppercase tracking-widest text-candle-muted shrink-0 pr-1">Sources</span>
          {SOURCES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => switchSource(i)}
              title={s.hint}
              className={`shrink-0 px-3 h-8 rounded-full text-xs border transition ${
                i === sourceIdx
                  ? "bg-petal text-velvet border-petal"
                  : "bg-surface text-candle border-border hover:border-petal/60"
              }`}
            >
              {s.label}
            </button>
          ))}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 h-8 px-3 rounded-full bg-surface border border-border text-xs text-candle-muted flex items-center gap-1.5"
          >
            <ExternalLink className="size-3" /> New tab
          </a>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {partner ? (
            <button
              onClick={inviteToWatch}
              className="flex items-center justify-center gap-2 h-11 rounded-full bg-petal text-velvet font-semibold text-sm"
            >
              <Send className="size-4" /> Invite {partnerFirst} again
            </button>
          ) : (
            <Link
              to="/app/invite"
              className="flex items-center justify-center gap-2 h-11 rounded-full bg-petal text-velvet font-semibold text-sm"
            >
              <Send className="size-4" /> Invite partner
            </Link>
          )}
          <Link
            to="/app/movies/$id"
            params={{ id }}
            className="flex items-center justify-center gap-2 h-11 rounded-full bg-surface border border-border text-candle text-sm"
          >
            Back to details
          </Link>
        </div>

        {movie?.overview && (
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Synopsis</p>
            <p className="text-sm text-candle leading-relaxed max-w-3xl">{movie.overview}</p>
          </div>
        )}

        {Array.isArray(movie?.genres) && movie.genres.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {movie.genres.map((g: any) => (
              <span key={g.id} className="px-3 h-7 inline-flex items-center rounded-full bg-surface border border-border text-[11px] text-candle-muted">
                {g.name}
              </span>
            ))}
          </div>
        )}
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
    mine, peer, partnerOnline, publish, sendSeek, incomingSeek, clearIncomingSeek, drift,
  } = useWatchSync(me?.id ?? null, partner?.id ?? null, 0, "movie");

  const handleRef = useRef<import("@/components/CustomMoviePlayer").CustomPlayerHandle | null>(null);

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

  useEffect(() => {
    if (!incomingSeek) return;
    handleRef.current?.seek(incomingSeek.time);
    clearIncomingSeek();
  }, [incomingSeek, clearIncomingSeek]);

  const partnerFirst = partner?.display_name.split(" ")[0] ?? "them";

  return (
    <div className="pt-8 pb-24 max-w-6xl mx-auto">
      <header className="px-5 pb-3 flex items-center gap-3">
        <Link to="/app/admin" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">Custom · Watch Party</p>
          <h1 className="font-serif text-lg md:text-2xl italic truncate">{movie?.title ?? (loading ? "Loading…" : "Not found")}</h1>
        </div>
      </header>

      <div className="px-3 md:px-5">
        <div className="relative aspect-video">
          {videoSrc ? (
            <CustomMoviePlayer
              src={videoSrc}
              poster={movie?.backdrop_url ?? movie?.poster_url ?? null}
              onReady={(h) => (handleRef.current = h)}
              onEvent={(evt) => publish({ event: evt.event, currentTime: evt.currentTime, duration: evt.duration, sourceIdx: 0 })}
            />
          ) : (
            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center text-candle-muted text-sm">
              {loading ? "Loading video…" : "No video available for this movie."}
            </div>
          )}
        </div>

        {partner && (
          <div className="mt-3 rounded-2xl border border-border bg-surface px-3 py-2.5 flex items-center gap-3">
            <span className={`size-2.5 rounded-full ${partnerOnline ? "bg-green-400" : "bg-candle-muted/60"}`} />
            <span className="text-xs text-candle">{partnerFirst} · {peer ? `${peer.event} at ${fmtTime(peer.currentTime)}` : "not in room"}</span>
            <button
              onClick={() => { if (peer) handleRef.current?.seek(peer.currentTime); }}
              disabled={!peer}
              className="ml-auto h-8 px-3 rounded-full bg-surface-elevated text-xs text-candle disabled:opacity-40"
            >
              Jump to {partnerFirst}
            </button>
            <button
              onClick={() => sendSeek(mine.currentTime)}
              className="h-8 px-3 rounded-full bg-petal text-velvet text-xs font-semibold"
            >
              Pull them here
            </button>
            {drift != null && Math.abs(drift) > 3 && (
              <span className="text-[10px] text-amber-400">±{fmtTime(Math.abs(drift))}</span>
            )}
          </div>
        )}

        {movie?.overview && (
          <p className="mt-5 text-sm text-candle leading-relaxed">{movie.overview}</p>
        )}
      </div>
    </div>
  );
}
