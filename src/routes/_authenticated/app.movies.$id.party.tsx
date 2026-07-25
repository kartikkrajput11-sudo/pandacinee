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
  const [isTv, setIsTv] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMovie({ data: { id: tmdbId } })
      .then((m) => {
        if (!alive || !m) return;
        setMovie(m);
        if (m.media_type === "tv") setIsTv(true);
      })
      .catch(() => {});
    // Check custom overrides for media_type
    supabase
      .from("custom_movies")
      .select("media_type, title, poster_url")
      .eq("tmdb_id", tmdbId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        if (data.media_type === "tv") setIsTv(true);
        setMovie((prev: any) => ({
          ...(prev ?? { id: tmdbId }),
          title: prev?.title || data.title,
          poster_path: prev?.poster_path || data.poster_url,
        }));
      });
    return () => {
      alive = false;
    };
  }, [tmdbId, fetchMovie]);

  const season = search.season ?? 1;
  const episode = search.episode ?? 1;

  const embedUrl = useMemo(() => {
    const base =
      isTv
        ? `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`
        : `https://vidlink.pro/movie/${tmdbId}`;
    const params = new URLSearchParams({
      primaryColor: "ee82af",
      secondaryColor: "ee82af",
      iconColor: "ffffff",
      autoplay: "true",
      title: "true",
    });
    return `${base}?${params.toString()}`;
  }, [tmdbId, isTv, season, episode]);

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
          <iframe
            key={embedUrl}
            src={embedUrl}
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
            className="w-full aspect-video bg-black"
          />
        </div>
        <p className="mt-2 text-[10px] text-candle-muted/70 text-center tracking-wide">
          Cozy up in your own tabs · Chat lives on the right
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
