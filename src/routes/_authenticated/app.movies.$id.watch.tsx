import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, RefreshCw, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { tmdbMovie } from "@/lib/tmdb.functions";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

type Source = { id: string; label: string; url: (tmdb: number) => string };

const SOURCES: Source[] = [
  { id: "vidsrc.cc",  label: "Source 1", url: (id) => `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=false` },
  { id: "vidsrc.to",  label: "Source 2", url: (id) => `https://vidsrc.to/embed/movie/${id}` },
  { id: "vidsrc.xyz", label: "Source 3", url: (id) => `https://vidsrc.xyz/embed/movie?tmdb=${id}` },
  { id: "autoembed",  label: "Source 4", url: (id) => `https://player.autoembed.cc/embed/movie/${id}` },
  { id: "2embed",     label: "Source 5", url: (id) => `https://www.2embed.cc/embed/${id}` },
  { id: "embedsu",    label: "Source 6", url: (id) => `https://embed.su/embed/movie/${id}` },
  { id: "multiembed", label: "Source 7", url: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1` },
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

  useEffect(() => {
    fetchMovie({ data: { id: tmdbId } }).then(setMovie).catch(() => setMovie(null));
  }, [tmdbId]);

  const src = SOURCES[sourceIdx].url(tmdbId);

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

  return (
    <div className="pt-8 pb-24">
      <header className="px-5 pb-3 flex items-center gap-3">
        <Link to="/app/movies/$id" params={{ id }} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">Now playing</p>
          <h1 className="font-serif text-lg md:text-2xl italic truncate">
            {movie?.title ?? "Loading…"}
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

      <div className="px-3 md:px-5">
        <div className="relative rounded-2xl md:rounded-3xl overflow-hidden bg-black border border-border aspect-video">
          <iframe
            id="movie-frame"
            key={`${sourceIdx}-${iframeKey}`}
            src={src}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] uppercase tracking-widest text-candle-muted shrink-0 pr-1">
            Sources
          </span>
          {SOURCES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSourceIdx(i)}
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
            onClick={() => setIframeKey((k) => k + 1)}
            className="shrink-0 size-8 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
            aria-label="Reload"
            title="Reload"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>

        <p className="mt-3 text-[11px] text-candle-muted leading-relaxed">
          If a source is slow or stuck, switch to another. Ads in the player come from the
          third-party provider — close any pop-ups and press play again.
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
            <p className="text-sm text-candle leading-relaxed">{movie.overview}</p>
          </div>
        )}
      </div>
    </div>
  );
}
