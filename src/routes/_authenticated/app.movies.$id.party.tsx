import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Users, Sparkles, Film } from "lucide-react";
import { tmdbMovie } from "@/lib/tmdb.functions";
import { useProfile } from "@/hooks/useProfile";
import { useFriendships } from "@/hooks/useFriends";
import { supabase } from "@/integrations/supabase/client";
import { WatchTogetherPanel } from "@/components/watch/WatchTogetherPanel";
import { AvatarImg } from "@/components/AvatarImg";
import { CustomMoviePlayer } from "@/components/CustomMoviePlayer";

export const Route = createFileRoute("/_authenticated/app/movies/$id/party")({
  validateSearch: (raw: Record<string, unknown>) => {
    const s = Number(raw.season);
    const e = Number(raw.episode);
    const w = typeof raw.with === "string" && raw.with.length > 0 ? raw.with : undefined;
    const t = raw.type === "tv" ? "tv" : raw.type === "movie" ? "movie" : undefined;
    return {
      season: Number.isFinite(s) && s > 0 ? Math.floor(s) : undefined,
      episode: Number.isFinite(e) && e > 0 ? Math.floor(e) : undefined,
      with: w,
      type: t,
    } as { season?: number; episode?: number; with?: string; type?: "movie" | "tv" };
  },
  component: PartyRoom,
});

function PartyRoom() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const tmdbId = Number(id);
  const fetchMovie = useServerFn(tmdbMovie);
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const realPartner = prof?.partner;
  const friendsQuery = useFriendships();

  const partner = useMemo(() => {
    const w = search.with;
    if (!w) return realPartner ?? null;
    if (realPartner && w === realPartner.id) return realPartner;
    const p = friendsQuery.data?.profiles?.[w];
    if (p) {
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      } as typeof realPartner;
    }
    return realPartner ?? null;
  }, [search.with, realPartner, friendsQuery.data?.profiles]);

  const [movie, setMovie] = useState<any>(null);
  const [isTv, setIsTv] = useState<boolean>(search.type === "tv");
  const [serverIdx, setServerIdx] = useState(0);
  const [pandacineSrc, setPandacineSrc] = useState<string | null>(null);
  const [partnerHere, setPartnerHere] = useState(false);

  // Presence: track whether partner has joined this party room
  useEffect(() => {
    if (!me?.id || !partner?.id) return;
    const roomKey = [me.id, partner.id].sort().join(":");
    const channel = supabase.channel(`party:${tmdbId}:${roomKey}`, {
      config: { presence: { key: me.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown>;
        setPartnerHere(Boolean(state[partner.id]));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ at: Date.now() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id, partner?.id, tmdbId]);

  useEffect(() => {
    let alive = true;
    fetchMovie({ data: { id: tmdbId } })
      .then((m) => {
        if (!alive || !m) return;
        setMovie(m);
        if (m.media_type === "tv" || m.first_air_date || m.number_of_seasons) setIsTv(true);
      })
      .catch(() => {});
    // Check custom overrides for media_type + Pandacine-uploaded video
    supabase
      .from("custom_movies")
      .select("id, media_type, title, poster_url, video_url, video_storage_path")
      .eq("tmdb_id", tmdbId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!alive || !data) return;
        if (data.media_type === "tv") setIsTv(true);
        setMovie((prev: any) => ({
          ...(prev ?? { id: tmdbId }),
          title: prev?.title || data.title,
          poster_path: prev?.poster_path || data.poster_url,
        }));
        // Resolve movie-level Pandacine source (episode overrides not wired for party yet)
        if (data.media_type !== "tv") {
          if (data.video_storage_path) {
            const { data: signed } = await supabase.storage
              .from("custom-movies")
              .createSignedUrl(data.video_storage_path, 60 * 60 * 6);
            if (!alive) return;
            if (signed?.signedUrl) setPandacineSrc(signed.signedUrl);
          } else if (data.video_url) {
            setPandacineSrc(data.video_url);
          }
        }
      });
    return () => {
      alive = false;
    };
  }, [tmdbId, fetchMovie]);


  const season = search.season ?? 1;
  const episode = search.episode ?? 1;

  type Server = { label: string; url: string; native?: boolean };
  const servers = useMemo<Server[]>(() => {
    const list: Server[] = [];
    if (pandacineSrc && !isTv) {
      list.push({ label: "Pandacine", url: pandacineSrc, native: true });
    }
    list.push(
      {
        label: "Panda Stream HD",
        url: isTv
          ? `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?color=ee82af&autoPlay=true`
          : `https://www.vidking.net/embed/movie/${tmdbId}?color=ee82af&autoPlay=true`,
      },
      {
        label: "Rose Cinema",
        url: isTv
          ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}?autoPlay=true`
          : `https://vidsrc.cc/v2/embed/movie/${tmdbId}?autoPlay=true`,
      },
      {
        label: "Moonlit Reel",
        url: isTv
          ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
          : `https://vidsrc.to/embed/movie/${tmdbId}`,
      },
      {
        label: "Twin Reel Mirror",
        url: isTv
          ? `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryColor=ee82af&autoplay=true`
          : `https://vidlink.pro/movie/${tmdbId}?primaryColor=ee82af&autoplay=true`,
      },
    );
    return list;
  }, [tmdbId, isTv, season, episode, pandacineSrc]);

  const activeServer = servers[Math.min(serverIdx, servers.length - 1)];


  if (!me) {
    return <div className="p-8 text-center text-candle-muted">Loading…</div>;
  }

  if (!partner) {
    return (
      <div className="pt-10 px-6 text-center">
        <h2 className="font-serif text-2xl italic mb-2">A party needs two</h2>
        <p className="text-sm text-candle-muted mb-6">
          Invite your partner or a friend to open a Same-Room party.
        </p>
        <Link to="/app/invite" className="inline-block px-6 py-3 bg-petal text-velvet rounded-full font-semibold text-sm">
          Invite
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-velvet">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-velvet/70 border-b border-white/[0.05]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/app/movies/$id" params={{ id: String(tmdbId) }} className="text-candle-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-[0.28em] text-petal flex items-center gap-1.5">
              <Sparkles className="size-3" /> Same-Room Party
            </p>
            <h1 className="font-serif italic text-base truncate text-candle">
              {movie?.title ?? "Loading…"}
              {isTv ? ` · S${season}·E${episode}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
            <Users className="size-3 text-petal" />
            <AvatarImg src={partner.avatar_url} alt={partner.display_name} className="size-5 rounded-full" />
          </div>
        </div>
        <div className="px-4 pb-2 text-[10px] text-candle-muted/80 italic flex items-center gap-1.5">
          <Film className="size-3" />
          Play whenever you like — chat and reactions are shared, playback isn't.
        </div>
      </header>

      {/* Player */}
      <div className="px-3 pt-3">
        <div className="relative rounded-2xl overflow-hidden bg-black border border-white/[0.06] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
          {activeServer.native ? (
            <div className="w-full aspect-video bg-black">
              <CustomMoviePlayer
                key={activeServer.url}
                src={activeServer.url}
                poster={movie?.backdrop_path ?? movie?.poster_path ?? null}
              />
            </div>
          ) : (
            <iframe
              key={activeServer.url}
              src={activeServer.url}
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              className="w-full aspect-video bg-black"
            />
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar px-0.5">
          {servers.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setServerIdx(i)}
              className={`shrink-0 h-6 px-2.5 rounded-full text-[10px] tracking-wide border transition ${
                i === serverIdx
                  ? "bg-petal text-velvet border-petal petal-glow"
                  : "bg-white/[0.03] text-candle-muted border-white/[0.06] hover:bg-white/[0.06]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-candle-muted/70 text-center tracking-wide">
          If a server says "couldn't find this content", tap another above.
        </p>
      </div>

      {/* Chat panel (floating on mobile, docks itself) */}
      <WatchTogetherPanel
        me={me}
        partner={partner as any}
        movieId={tmdbId}
        movieTitle={movie?.title ?? "Party"}
        moviePoster={movie?.poster_path ?? null}
        mediaType={isTv ? "tv" : "movie"}
      />
    </div>
  );
}
