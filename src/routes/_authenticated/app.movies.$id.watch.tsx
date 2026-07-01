import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, RefreshCw, Maximize2, ExternalLink, Play } from "lucide-react";
import { toast } from "sonner";
import { tmdbMovie } from "@/lib/tmdb.functions";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { WatchTogetherPanel } from "@/components/watch/WatchTogetherPanel";

type Source = { id: string; label: string; url: (tmdb: number) => string; hint: string };

// VidKing-only embed sources. Keep these as plain iframes: no sandbox and no
// restrictive referrer policy, because VidKing needs its own scripts/storage.
const SOURCES: Source[] = [
  {
    id: "vidking-auto",
    label: "VidKing Auto",
    hint: "Autoplay enabled",
    url: (id) => `https://www.vidking.net/embed/movie/${id}?color=9146ff&autoPlay=true`,
  },
  {
    id: "vidking-manual",
    label: "VidKing Manual",
    hint: "Best fallback — press play inside the player",
    url: (id) => `https://www.vidking.net/embed/movie/${id}?color=9146ff`,
  },
  {
    id: "vidking-clean",
    label: "VidKing Clean",
    hint: "Exact basic VidKing embed",
    url: (id) => `https://www.vidking.net/embed/movie/${id}`,
  },
];

export const Route = createFileRoute("/_authenticated/app/movies/$id/watch")({
  component: WatchMovie,
});

function WatchMovie() {
  const { id } = Route.useParams();
  const tmdbId = Number(id);
  const fetchMovie = useServerFn(tmdbMovie);
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
  const [playerEvent, setPlayerEvent] = useState<string | null>(null);
  const [slowPlayer, setSlowPlayer] = useState(false);

  useEffect(() => {
    fetchMovie({ data: { id: tmdbId } }).then(setMovie).catch(() => setMovie(null));
  }, [tmdbId]);

  useEffect(() => {
    setEmbeddedPreview(window.self !== window.top);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!String(event.origin).includes("vidking.net")) return;
      try {
        const message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (message?.type === "PLAYER_EVENT") {
          setPlayerEvent(message.data?.event ?? "playing");
          setSlowPlayer(false);
        }
      } catch {
        // Ignore non-JSON provider messages.
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!started) return;
    setSlowPlayer(false);
    const timeout = window.setTimeout(() => setSlowPlayer(true), 14000);
    return () => window.clearTimeout(timeout);
  }, [started, sourceIdx, iframeKey]);

  const src = useMemo(() => SOURCES[sourceIdx].url(tmdbId), [sourceIdx, tmdbId]);
  const fullPageUrl = typeof window !== "undefined" ? `${window.location.origin}/app/movies/${tmdbId}/watch` : `/app/movies/${tmdbId}/watch`;

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
    setPlayerEvent(null);
    setIframeKey((k) => k + 1);
  }

  return (
    <div className="pt-8 pb-24">
      <header className="px-5 pb-3 flex items-center gap-3 max-w-6xl mx-auto">
        <Link to="/app/movies/$id" params={{ id }} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">Now playing</p>
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
            VidKing can be blocked inside the Lovable preview sandbox. Open this watch page in a full tab or on the published domain for real playback.
            <a href={fullPageUrl} target="_blank" rel="noreferrer" className="ml-2 text-petal font-semibold underline underline-offset-4">
              Open full player
            </a>
          </div>
        )}

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
              onClick={() => {
                setStarted(true);
                setPlayerLoading(true);
              }}
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
          {started && slowPlayer && !playerEvent && (
            <div className="absolute left-3 right-3 bottom-3 rounded-2xl bg-velvet/90 border border-border px-3 py-2 text-[11px] text-candle-muted backdrop-blur">
              If the video is stuck at 00:00, choose <span className="text-petal">VidKing Manual</span> and press play inside the player. Some titles may also be missing on VidKing's own servers.
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] uppercase tracking-widest text-candle-muted shrink-0 pr-1">
            Sources
          </span>
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
          <button
            onClick={() => {
              setStarted(true);
              setPlayerLoading(true);
              setPlayerEvent(null);
              setIframeKey((k) => k + 1);
            }}
            className="shrink-0 size-8 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
            aria-label="Reload"
            title="Reload"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>

        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-2 h-10 rounded-full bg-surface border border-border text-candle text-xs"
        >
          <ExternalLink className="size-3.5" /> Open in new tab if player is blocked
        </a>

        <p className="mt-3 text-[11px] text-candle-muted leading-relaxed">
          Streams use VidKing only. If autoplay is blocked, switch to VidKing Manual and press play inside the player.
          Pop-up ads belong to the provider — close them and press play again.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {partner ? (
            <button
              onClick={inviteToWatch}
              className="flex items-center justify-center gap-2 h-11 rounded-full bg-petal text-velvet font-semibold text-sm"
            >
              <Send className="size-4" /> Invite {partner.display_name.split(" ")[0]} to watch
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
      </div>

      {me && partner && movie && (
        <WatchTogetherPanel
          me={me}
          partner={partner}
          movieId={tmdbId}
          movieTitle={movie.title}
        />
      )}
    </div>
  );
}
