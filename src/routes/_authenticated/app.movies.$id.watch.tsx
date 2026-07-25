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
  
  Server,
  Check,
  Heart,
  MessageCircle,
  Crown,
  ChevronLeft,
  ChevronRight,
  Tv,
  Clock,
  CalendarDays,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { tmdbMovie, tmdbTvDetail, tmdbTvSeason } from "@/lib/tmdb.functions";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { WatchTogetherPanel } from "@/components/watch/WatchTogetherPanel";

import { useWatchSync, fmtTime } from "@/hooks/useWatchSync";
import { CustomMoviePlayer, type CustomPlayerHandle } from "@/components/CustomMoviePlayer";
import { toEmbedUrl } from "@/lib/video-url";
import { useFriendships } from "@/hooks/useFriends";
import { AvatarImg } from "@/components/AvatarImg";
import { PostMovieReflection } from "@/components/movies/PostMovieReflection";

type Source = { id: string; label: string; url: (tmdb: number, startAt?: number, mediaType?: "movie" | "tv", season?: number, episode?: number) => string; hint: string };


const SOURCES: Source[] = [
  {
    id: "vidking-auto",
    label: "Panda HD",
    hint: "Primary — autoplay",
    url: (id, t, mt, s, e) => {
      const base = mt === "tv" && s != null && e != null
        ? `https://www.vidking.net/embed/tv/${id}/${s}/${e}`
        : `https://www.vidking.net/embed/movie/${id}`;
      return `${base}?color=ee82af&autoPlay=true${t ? `&progress=${Math.floor(t)}` : ""}`;
    },
  },
  {
    id: "vidking-manual",
    label: "Panda M",
    hint: "Manual play",
    url: (id, t, mt, s, e) => {
      const base = mt === "tv" && s != null && e != null
        ? `https://www.vidking.net/embed/tv/${id}/${s}/${e}`
        : `https://www.vidking.net/embed/movie/${id}`;
      return `${base}?color=ee82af${t ? `&progress=${Math.floor(t)}` : ""}`;
    },
  },
  {
    id: "vidsrc-cc",
    label: "Velvet",
    hint: "vidsrc.cc",
    url: (id, _t, mt, s, e) => {
      if (mt === "tv" && s != null && e != null) {
        return `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}?autoPlay=true`;
      }
      return `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true`;
    },
  },
  {
    id: "vidsrc-to",
    label: "Rose",
    hint: "vidsrc.to",
    url: (id, _t, mt, s, e) => {
      if (mt === "tv" && s != null && e != null) {
        return `https://vidsrc.to/embed/tv/${id}/${s}/${e}`;
      }
      return `https://vidsrc.to/embed/movie/${id}`;
    },
  },
  {
    id: "vidlink",
    label: "Moonlit",
    hint: "vidlink.pro",
    url: (id, _t, mt, s, e) => {
      const base = mt === "tv" && s != null && e != null
        ? `https://vidlink.pro/tv/${id}/${s}/${e}`
        : `https://vidlink.pro/movie/${id}`;
      return `${base}?primaryColor=ee82af&secondaryColor=ee82af&iconColor=ffffff&autoplay=true`;
    },
  },
  {
    id: "autoembed",
    label: "Twin",
    hint: "autoembed.cc",
    url: (id, _t, mt, s, e) => {
      if (mt === "tv" && s != null && e != null) {
        return `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`;
      }
      return `https://player.autoembed.cc/embed/movie/${id}`;
    },
  },
  {
    id: "2embed",
    label: "Mirror",
    hint: "2embed.cc",
    url: (id, _t, mt, s, e) => {
      if (mt === "tv" && s != null && e != null) {
        return `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`;
      }
      return `https://www.2embed.cc/embed/${id}`;
    },
  },
];


const REACTIONS = ["❤️", "🔥", "😂", "😱", "🥰", "🍿"];

export const Route = createFileRoute("/_authenticated/app/movies/$id/watch")({
  validateSearch: (raw: Record<string, unknown>) => {
    const s = Number(raw.season);
    const e = Number(raw.episode);
    const w = typeof raw.with === "string" && raw.with.length > 0 ? raw.with : undefined;
    const t = raw.type === "tv" || raw.type === "movie" ? raw.type : undefined;
    return {
      season: Number.isFinite(s) && s > 0 ? Math.floor(s) : undefined,
      episode: Number.isFinite(e) && e > 0 ? Math.floor(e) : undefined,
      with: w,
      type: t,
    } as { season?: number; episode?: number; with?: string; type?: "movie" | "tv" };
  },
  component: WatchMovie,
});

function WatchMovie() {
  const { id } = Route.useParams();
  const isCustom = id.startsWith("custom:");
  if (isCustom) return <CustomWatch customId={id.slice("custom:".length)} />;
  return <CatalogWatch id={id} />;
}

function CatalogWatch({ id }: { id: string }) {
  const search = Route.useSearch();
  const tmdbId = Number(id);
  const fetchMovie = useServerFn(tmdbMovie);
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const realPartner = prof?.partner;
  const friendsQuery = useFriendships();
  // Co-viewer: if `?with=<userId>` is present and points at a friend (or the
  // real partner), sync against that person instead of the default partner.
  // This lets non-partner friends watch together via a chat invite.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.with, realPartner?.id, friendsQuery.data?.profiles]);
  const navigate = useNavigate();
  const [movie, setMovie] = useState<any>(null);
  const [pandacine, setPandacine] = useState<{ videoSrc: string; title: string | null; qualities?: Array<{ label: string; url: string; height?: number | null }> } | null>(null);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [started, setStarted] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [slowPlayer, setSlowPlayer] = useState(false);
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const [autoFollow, setAutoFollow] = useState(true);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [customPlayerReady, setCustomPlayerReady] = useState(0);
  const [floaties, setFloaties] = useState<{ id: number; emoji: string; x: number; from: "me" | "partner" }[]>([]);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [waitingFor, setWaitingFor] = useState<{ id: string; name: string } | null>(null);
  const lastPublishRef = useRef(0);
  const lastVidkingReloadRef = useRef(0);

  // TV series state (populated when the admin marked this TMDB id as media_type=tv)
  const [isTv, setIsTv] = useState(search.type === "tv");
  const [customMovieId, setCustomMovieId] = useState<string | null>(null);
  const [tvSeasons, setTvSeasons] = useState<{ season_number: number; episode_count: number; name: string }[]>([]);
  const [season, setSeason] = useState<number>(search.season ?? 1);
  const [episode, setEpisode] = useState<number>(search.episode ?? 1);
  const [seasonEps, setSeasonEps] = useState<Array<{ episode_number: number; name: string; overview: string | null; still_path: string | null; runtime: number | null; air_date: string | null }>>([]);
  const [customEps, setCustomEps] = useState<Array<{ season: number; episode: number; title: string | null; video_url: string | null; video_storage_path: string | null; use_vidking: boolean }>>([]);
  const tvDetailFn = useServerFn(tmdbTvDetail);
  const tvSeasonFn = useServerFn(tmdbTvSeason);

  const syncRoomId = customMovieId
    ? `custom:${customMovieId}${isTv ? `:s${season}:e${episode}` : ""}`
    : isTv
      ? `tmdb:${tmdbId}:s${season}:e${episode}`
      : `tmdb:${tmdbId}`;


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
    myReady,
    peerReady,
    setReady,
    sendPrepare,
    peerPreparing,
    clearPeerPreparing,
    peerSourceKind,
    setSourceKind,
    peerBuffering,
    sendBuffering,
    startTogether,
    peerLatencyMs,
  } = useWatchSync(me?.id ?? null, partner?.id ?? null, syncRoomId, isTv ? "tv" : "movie");



  const iAmHost = !!me && hostId === me.id;
  const partnerIsHost = !!partner && hostId === partner.id;
  // Lock playback for anyone who isn't the active host once a partner is present
  // in the room. This prevents non-host viewers from spawning an independent
  // audio path (double-audio) or scrubbing/skipping out of sync.
  const followerLocked = !iAmHost && (!!hostId || !!peer);
  const lastAppliedPeerEventRef = useRef<number>(0);
  const customPlayerRef = useRef<CustomPlayerHandle | null>(null);
  const suppressPlayerEventRef = useRef(false);
  // Tracks the host's last-known playback state so a stale `timeupdate`
  // packet (arriving after `pause` due to network reordering) can't
  // resurrect a follower — which was leaving mp4 audio playing while the
  // video sat visually paused.
  const hostPausedRef = useRef(false);
  // Local receipt time per peer packet — avoids clock-skew drift.
  const peerReceivedAtRef = useRef<Record<number, number>>({});

  const pendingAutoJoinRef = useRef<number | null>(null);
  const pendingAutoJoinPlayRef = useRef(false);

  // Auto-dismiss the "waiting for friend" overlay once they actually join the room
  useEffect(() => {
    if (!waitingFor) return;
    if (partnerOnline || peer) {
      toast.success(`${waitingFor.name} joined 🍿`);
      setWaitingFor(null);
    }
  }, [waitingFor, partnerOnline, peer]);

  useEffect(() => {
    let alive = true;

    // 1) Instant local render: hit Supabase first and paint whatever we have.
    const localPromise = supabase
      .from("custom_movies")
      .select("id, title, overview, poster_url, backdrop_url, runtime, video_url, video_storage_path, video_qualities, media_type, tmdb_id")
      .eq("tmdb_id", tmdbId)
      .maybeSingle()
      .then((ovRes) => {
        if (!alive) return null;
        const ov = ovRes.data as {
          id?: string; title?: string; overview?: string | null;
          poster_url?: string | null; backdrop_url?: string | null; runtime?: number | null;
          video_url?: string | null; video_storage_path?: string | null;
          video_qualities?: Array<{ label: string; url: string; height?: number | null }> | null;
          media_type?: "movie" | "tv" | null;
        } | null;
        if (ov) {
          // Paint immediately from local data
          setMovie((prev: any) => ({
            ...(prev ?? {}),
            id: tmdbId,
            title: ov.title ?? prev?.title ?? "",
            overview: ov.overview ?? prev?.overview ?? "",
            poster_path: ov.poster_url ?? prev?.poster_path ?? null,
            backdrop_path: ov.backdrop_url ?? prev?.backdrop_path ?? null,
            runtime: ov.runtime ?? prev?.runtime ?? null,
            media_type: ov.media_type ?? prev?.media_type ?? null,
          }));
          const tv = ov.media_type === "tv";
          setIsTv(tv);
          setCustomMovieId(ov.id ?? null);

          const qualities = Array.isArray(ov.video_qualities) ? ov.video_qualities : [];

          // Resolve movie-level Pandacine source right away
          if (!tv) {
            if (ov.video_storage_path) {
              supabase.storage
                .from("custom-movies")
                .createSignedUrl(ov.video_storage_path, 60 * 60 * 6)
                .then(({ data: signed }) => {
                  if (!alive) return;
                  if (signed?.signedUrl) setPandacine({ videoSrc: signed.signedUrl, title: ov.title ?? null, qualities });
                });
            } else if (ov.video_url) {
              setPandacine({ videoSrc: ov.video_url, title: ov.title ?? null, qualities });
            } else {
              setPandacine(null);
            }
          }
        }
        return ov;
      });

    // 2) Enrich with TMDB in the background (release date, genres, etc.)
    const tvHint = search.type === "tv";
    const enrichPromise = tvHint
      ? tvDetailFn({ data: { id: tmdbId } }).catch(() => null)
      : fetchMovie({ data: { id: tmdbId } }).catch(() => null);
    enrichPromise.then((m: any) => {
        if (!alive || !m) return;
        setMovie((prev: any) => ({
          ...m,
          title: prev?.title || m.title || m.name,
          overview: prev?.overview || m.overview,
          poster_path: prev?.poster_path || m.poster_path,
          backdrop_path: prev?.backdrop_path || m.backdrop_path,
          runtime: prev?.runtime || m.runtime,
        }));
        if (tvHint || m.media_type === "tv" || Array.isArray(m.seasons)) setIsTv(true);
      });

    // 3) After local paint, if it's a TV show fetch season list + episode overrides
    localPromise.then(async (ov) => {
      if (!alive) return;
      const tv = ov?.media_type === "tv";
      if (!tv) { setTvSeasons([]); setCustomEps([]); return; }
      const [detail, epsRes] = await Promise.all([
        tvDetailFn({ data: { id: tmdbId } }).catch(() => null),
        ov?.id
          ? supabase.from("custom_episodes")
              .select("season, episode, title, video_url, video_storage_path, use_vidking")
              .eq("movie_id", ov.id)
          : Promise.resolve({ data: [] } as any),
      ]);
      if (!alive) return;
      if (detail?.seasons) {
        const s = detail.seasons.filter((x: any) => x.season_number > 0);
        setTvSeasons(s);
        if (s.length && !s.find((x: any) => x.season_number === season)) setSeason(s[0].season_number);
      }
      setCustomEps(((epsRes as any).data ?? []) as any);
    });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId]);


  // Load episodes for the selected season (TV only)
  useEffect(() => {
    if (!isTv) return;
    let alive = true;
    (async () => {
      try {
        const eps = await tvSeasonFn({ data: { id: tmdbId, season } });
        if (!alive) return;
        setSeasonEps(eps as any);
        // Snap episode to the first available if current is out of range
        if (eps.length && !eps.find((e: any) => e.episode_number === episode)) {
          setEpisode(eps[0].episode_number);
        }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTv, tmdbId, season]);

  // Resolve Pandacine source for the current episode override (TV only)
  useEffect(() => {
    if (!isTv) return;
    let alive = true;
    (async () => {
      const ov = customEps.find((r) => r.season === season && r.episode === episode);
      if (!ov) { setPandacine(null); return; }
      if (ov.video_storage_path) {
        const { data: signed } = await supabase.storage
          .from("custom-movies")
          .createSignedUrl(ov.video_storage_path, 60 * 60 * 6);
        if (!alive) return;
        if (signed?.signedUrl) setPandacine({ videoSrc: signed.signedUrl, title: ov.title ?? null });
        else setPandacine(null);
      } else if (ov.video_url) {
        setPandacine({ videoSrc: ov.video_url, title: ov.title ?? null });
      } else {
        setPandacine(null);
      }
    })();
    return () => { alive = false; };
  }, [isTv, season, episode, customEps]);



  // Capture VidKing events, publish to partner (host-only, throttled).
  // Only the host broadcasts play/pause/seek — followers listen only, so
  // their iframe's spurious pause/play emissions (on reload, when we soft-
  // sync them) can't feed back as a phantom "partner paused".
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const okOrigin = /vidking\.net|2embed\.cc|vidsrc\.(cc|to)|vidlink\.pro|autoembed\.cc/.test(String(event.origin));
      if (!okOrigin) return;
      try {
        const raw = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // Normalize across providers:
        //  - VidKing:  { type: "PLAYER_EVENT", data: { event, currentTime, duration } }
        //  - Vidlink:  { type: "PLAYER_EVENT", data: { event, currentTime, duration } }
        //              or { type: "MEDIA_DATA", data: { <id>: { progress: { watched, duration } } } }
        let evt = "timeupdate";
        let currentTime = 0;
        let duration = Number(mine.duration ?? 0);
        if (raw?.type === "PLAYER_EVENT") {
          const d = raw.data ?? {};
          evt = String(d.event ?? "timeupdate");
          currentTime = Number(d.currentTime ?? 0);
          duration = Number(d.duration ?? duration);
        } else if (raw?.type === "MEDIA_DATA" && raw.data && typeof raw.data === "object") {
          const first = Object.values(raw.data)[0] as { progress?: { watched?: number; duration?: number } } | undefined;
          if (!first?.progress) return;
          currentTime = Number(first.progress.watched ?? 0);
          duration = Number(first.progress.duration ?? duration);
        } else {
          return;
        }
        setSlowPlayer(false);
        const isDiscrete = evt === "play" || evt === "pause" || evt === "seeked" || evt === "ended";
        // First real interaction claims the room if no one owns it yet.
        const claimingNow = isDiscrete && partner && !hostId && !!me;
        if (claimingNow) claimHost();
        if (!iAmHost && !claimingNow) return;
        const now = Date.now();
        if (isDiscrete || now - lastPublishRef.current > 1000) {
          lastPublishRef.current = now;
          publish({ event: evt, currentTime, duration, sourceIdx });
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [publish, sourceIdx, mine.duration, iAmHost, hostId, partner, me, claimHost]);

  useEffect(() => {
    if (!started) return;
    setSlowPlayer(false);
    const t = window.setTimeout(() => {
      setSlowPlayer(true);
      toast("Player's taking a while — check your connection.", { duration: 5000 });
    }, 14000);
    return () => window.clearTimeout(t);
  }, [started, sourceIdx, iframeKey]);

  // Safety: some third-party embeds never fire `onLoad` reliably (redirects,
  // cross-origin quirks), which would leave the "Dimming the lights" veil
  // covering the player forever. Auto-clear it after a short grace period so
  // the iframe is visible even if the load event never arrives.
  useEffect(() => {
    if (!playerLoading) return;
    // Longer grace on follower iframes: keep the "Dimming the lights" pause veil
    // up until the embed actually finishes loading, so the follower doesn't
    // start playing (out of sync) before its own stream is ready.
    const t = window.setTimeout(() => setPlayerLoading(false), 12000);
    return () => window.clearTimeout(t);
  }, [playerLoading, sourceIdx, iframeKey]);

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
    const list: { id: string; label: string; hint: string; kind: "pandacine" | "vidking"; buildUrl?: (id: number, t?: number, mt?: "movie" | "tv", s?: number, e?: number) => string }[] = [];
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

  const [forceAutoplay, setForceAutoplay] = useState(false);

  const src = useMemo(() => {
    if (!currentSource || currentSource.kind === "pandacine") return "";
    const mt = isTv ? "tv" : "movie";
    const s = isTv ? season : undefined;
    const e = isTv ? episode : undefined;
    // When host paused, force a manual (no-autoplay) URL so playback stops at that time.
    if (pausedByHost) return SOURCES[1].url(tmdbId, startAt, mt, s, e);
    // When following a host play/seek/resume, force the autoPlay variant so the
    // follower's iframe actually starts on reload — even if they're on the
    // Manual (Panda M) source. Otherwise the reloaded iframe sits paused
    // waiting for a click, which was the "stuck on last synced frame" bug.
    if (forceAutoplay) return SOURCES[0].url(tmdbId, startAt, mt, s, e);
    return currentSource.buildUrl!(tmdbId, startAt, mt, s, e);
  }, [currentSource, tmdbId, startAt, pausedByHost, forceAutoplay, isTv, season, episode]);

  // Reload iframe when episode changes
  useEffect(() => {
    if (!isTv) return;
    setIframeKey((k) => k + 1);
    setStartAt(undefined);
  }, [isTv, season, episode]);




  const applySeek = useCallback((time: number, opts?: { pause?: boolean; autoplay?: boolean }) => {
    setStartAt(time);
    setPausedByHost(!!opts?.pause);
    setForceAutoplay(!opts?.pause && !!opts?.autoplay);
    setStarted(true);
    setPlayerLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  const runSuppressedPlayerAction = useCallback((action: () => void, ms = 500) => {
    suppressPlayerEventRef.current = true;
    action();
    window.setTimeout(() => { suppressPlayerEventRef.current = false; }, ms);
  }, []);

  // Mutual sync: mirror the latest source selection so both screens use the same stream.
  useEffect(() => {
    if (!peer) return;
    if (typeof peer.sourceIdx !== "number") return;
    if (peer.sourceIdx === sourceIdx) return;
    if (peer.sourceIdx < 0 || peer.sourceIdx >= allSources.length) return;
    setSourceIdx(peer.sourceIdx);
  }, [peer, sourceIdx, allSources.length]);

  // Mutual sync: mirror the latest season/episode (TV series only).
  useEffect(() => {
    if (!peer || !isTv) return;
    if (typeof peer.season === "number" && peer.season !== season) setSeason(peer.season);
    if (typeof peer.episode === "number" && peer.episode !== episode) setEpisode(peer.episode);
  }, [peer, isTv, season, episode]);

  // Stamp local receipt time for each new peer packet (clock-skew safe).
  useEffect(() => {
    if (!peer) return;
    if (peerReceivedAtRef.current[peer.updatedAt] != null) return;
    peerReceivedAtRef.current[peer.updatedAt] = Date.now();
    // Trim to last 10 entries
    const keys = Object.keys(peerReceivedAtRef.current).map(Number).sort((a, b) => b - a);
    for (const k of keys.slice(10)) delete peerReceivedAtRef.current[k];
  }, [peer]);

  // Mutual auto-sync: the latest play/pause/seek from either partner moves the other screen.
  // Two modes:
  //   • Pandacine ↔ Pandacine → tight sync via <video> handle (sub-second).
  //   • Vidking ↔ Vidking     → soft sync via iframe reload with ?progress= param
  //                              on drift > 3s or on play/pause/seeked.
  useEffect(() => {
    if (!peer || !partner || !me) return;
    // Only sync when BOTH sides are on the same kind of source.
    const bothPandacine = isPandacine && peerSourceKind === "pandacine";
    const bothIframe    = !isPandacine && peerSourceKind === "iframe";
    if (!bothPandacine && !bothIframe) return;
    if (peer.updatedAt <= lastAppliedPeerEventRef.current) return;
    const evt = peer.event;
    if (evt !== "play" && evt !== "pause" && evt !== "seeked" && evt !== "timeupdate" && evt !== "ratechange" && evt !== "ended") return;

    // Iframe-mode drift gate — reloading an iframe forces a re-buffer, which
    // shows up to the user as "the follower keeps buffering". So we only react
    // to timeupdate when drift is large (>10s) AND we haven't reloaded in the
    // last 30s. Small drift is left alone; discrete play/pause/seek still sync.
    // EXCEPTION: if the follower is currently paused-by-host and the host's
    // timestamp is advancing, that means the host resumed — Vidking sometimes
    // omits the discrete "play" event on resume, so treat an advancing
    // timeupdate as an implicit play so the follower doesn't get stuck paused.
    const hostAdvancingWhilePaused =
      bothIframe && evt === "timeupdate" && pausedByHost && peer.currentTime > mine.currentTime + 0.4;
    if (bothIframe && evt === "timeupdate" && !hostAdvancingWhilePaused) {
      const d = Math.abs(mine.currentTime - peer.currentTime);
      if (d < 10) return;
      if (Date.now() - lastVidkingReloadRef.current < 30000) return;
    }
    // Promote the implicit-play case to a real "play" so the branch below reloads
    // with the autoplay URL.
    const effectiveEvt = hostAdvancingWhilePaused ? "play" : evt;
    lastAppliedPeerEventRef.current = peer.updatedAt;

    if (!started) {
      if (evt === "pause") return;
      if (bothIframe) {
        lastVidkingReloadRef.current = Date.now();
        setStartAt(peer.currentTime);
        setPausedByHost(false);
        setStarted(true);
        setPlayerLoading(true);
        setIframeKey((k) => k + 1);
        return;
      }
      pendingAutoJoinPlayRef.current = true;
      pendingAutoJoinRef.current = peer.currentTime;
      setStartAt(peer.currentTime);
      setStarted(true);
      setPlayerLoading(true);
      return;
    }

    // Pandacine can't be controlled until the handle mounts — mount + replay on ready.
    if (bothPandacine && !customPlayerRef.current) {
      // Drive-embed variant (uncontrollable iframe): swap src to about:blank on
      // pause so Drive's own audio track actually stops, and reload with a
      // fresh startAt on play/seek.
      if (evt === "pause") {
        setPausedByHost(true);
        setIframeKey((k) => k + 1);
        toast.info(`${partner?.display_name?.split(" ")[0] ?? "Partner"} paused`);
        return;
      }
      pendingAutoJoinPlayRef.current = true;
      pendingAutoJoinRef.current = peer.currentTime;
      setStartAt(peer.currentTime);
      setPausedByHost(false);
      setStarted(true);
      setPlayerLoading(true);
      setIframeKey((k) => k + 1);
      return;
    }


    // Pandacine tight sync: control the <video> via handle.
    if (bothPandacine && customPlayerRef.current) {
      const h = customPlayerRef.current;
      const baseRate = (typeof peer.playbackRate === "number" && peer.playbackRate > 0) ? peer.playbackRate : 1;
      // Track host paused-state across events so stale timeupdates can't
      // force-resume audio on the follower.
      if (evt === "pause") hostPausedRef.current = true;
      else if (evt === "play" || evt === "seeked") hostPausedRef.current = false;
      // Latency compensation using LOCAL receive time, not the host's clock.
      // (Cross-machine clocks drift; mixing them causes the follower to
      // permanently believe it's behind → the "auto fast" 1.1×–1.25× glitch.)
      const now = Date.now();
      const receivedAt = peerReceivedAtRef.current[peer.updatedAt] ?? now;
      const hostPlaying = !hostPausedRef.current;
      const elapsed = hostPlaying ? Math.max(0, ((now - receivedAt) + peerLatencyMs) / 1000) * baseRate : 0;
      const targetTime = peer.currentTime + elapsed;
      const drift = h.currentTime() - targetTime;
      const abs = Math.abs(drift);

      runSuppressedPlayerAction(() => {
        if (evt === "pause" || hostPausedRef.current) {
          // Pause FIRST so decoded audio samples don't leak out during the
          // subsequent seek — that was the "sound continues, video pauses"
          // bug on uploaded mp4 sources.
          h.pause();
          h.setPlaybackRate(baseRate);
          h.seek(peer.currentTime);
          // Belt-and-braces: some browsers keep the audio track alive for a
          // few hundred ms after pause+seek. Muting for a tick guarantees
          // silence and un-mutes cleanly when the host resumes.
          h.setMuted(true);
          window.setTimeout(() => { if (hostPausedRef.current) h.pause(); }, 120);
          return;
        }
        // Host is playing — unmute if we muted during a prior pause.
        if (h.isMuted()) h.setMuted(false);
        const locallyPaused = h.isPaused();
        if (evt === "seeked" || abs > 3.0) {
          h.seek(targetTime);
          h.setPlaybackRate(baseRate);
          if (((evt === "play" || evt === "seeked") && hostPlaying) || (followerLocked && locallyPaused && evt === "timeupdate" && !hostPausedRef.current)) h.play();
          return;
        }
        if (abs > 1.5 && !locallyPaused) {
          const nudge = Math.max(-0.08, Math.min(0.08, -drift / 5));
          h.setPlaybackRate(Math.max(0.5, baseRate + nudge));
        } else if (!locallyPaused) {
          h.setPlaybackRate(baseRate);
        }
        if (evt === "play" || (followerLocked && locallyPaused && evt === "timeupdate" && !hostPausedRef.current)) h.play();
      });
      if (evt === "seeked") toast.info(`${partner?.display_name.split(" ")[0]} skipped`);
      if (evt === "pause") toast.info(`${partner?.display_name.split(" ")[0]} paused`);
      return;
    }

    // Vidking iframe soft sync: reload with ?progress=<peerTime>.
    // pausedByHost=true rewrites the URL to the no-autoplay variant → effectively pauses.
    if (bothIframe) {
      lastVidkingReloadRef.current = Date.now();
      if (effectiveEvt === "pause") {
        applySeek(peer.currentTime, { pause: true });
        toast.info(`${partner?.display_name.split(" ")[0]} paused`);
      } else if (effectiveEvt === "play" || effectiveEvt === "seeked" || effectiveEvt === "timeupdate") {
        applySeek(peer.currentTime, { pause: false, autoplay: true });
        if (effectiveEvt === "seeked") toast.info(`${partner?.display_name.split(" ")[0]} skipped`);
        else if (effectiveEvt === "play") toast.info(`${partner?.display_name.split(" ")[0]} resumed — starting together`);
        else toast.info("Re-syncing with partner…");
      }
    }
  }, [peer, me, mine.currentTime, applySeek, partner, isPandacine, peerSourceKind, started, customPlayerReady, runSuppressedPlayerAction, followerLocked, peerLatencyMs, pausedByHost]);

  // When the custom player mounts after an auto-join, seek first, then only play
  // if this mount was caused by a host sync event — not by a follower tap.
  useEffect(() => {
    if (pendingAutoJoinRef.current == null) return;
    const h = customPlayerRef.current;
    if (!h) return;
    const t = pendingAutoJoinRef.current;
    const shouldPlay = pendingAutoJoinPlayRef.current;
    pendingAutoJoinRef.current = null;
    pendingAutoJoinPlayRef.current = false;
    runSuppressedPlayerAction(() => {
      h.setMuted(false);
      h.seek(t);
      if (shouldPlay) h.play();
    }, 800);
  }, [customPlayerReady, runSuppressedPlayerAction]);

  // Rewind-on-buffer (SyncPlay-style): pause locally while the partner is
  // stalled; resume together via a short countdown when they recover.
  const autoPausedForBufferRef = useRef(false);
  useEffect(() => {
    if (!isPandacine || peerSourceKind !== "pandacine") return;
    const h = customPlayerRef.current;
    if (!h) return;
    if (peerBuffering) {
      if (!h.isPaused()) {
        autoPausedForBufferRef.current = true;
        runSuppressedPlayerAction(() => h.pause());
        toast.info(`${partner?.display_name?.split(" ")[0] ?? "Partner"} is buffering…`, { id: "peer-buffer", duration: 1500 });
      }
    } else if (autoPausedForBufferRef.current) {
      autoPausedForBufferRef.current = false;
      const t = h.currentTime();
      sendCountdown(0.3, t);
      window.setTimeout(() => {
        runSuppressedPlayerAction(() => { h.seek(t); h.play(); });
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerBuffering]);

  // -------- Storage-only sync gate --------

  // Real-time sync (seek, play/pause, drift) is only enabled when BOTH partners
  // have loaded the movie from Lovable Cloud storage (Pandacine source).
  // If either side is on a 3rd-party iframe, we can't reliably control it.
  const bothOnPandacine = isPandacine && peerSourceKind === "pandacine";

  // Announce our current source kind to the partner via presence.
  useEffect(() => {
    if (!currentSource) { setSourceKind("unknown"); return; }
    setSourceKind(isPandacine ? "pandacine" : "iframe");
  }, [isPandacine, currentSource, setSourceKind]);

  // -------- Ready-check gate (both partners must load before host can start) --------
  const gateActive = !!partner && partnerOnline && bothOnPandacine;
  const bothReady = myReady && peerReady;

  // Reset my ready flag whenever we swap streams (source/episode change).
  useEffect(() => {
    setReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pandacine?.videoSrc, season, episode, sourceIdx]);

  // Follower auto-mounts (paused, muted) as soon as host broadcasts "prepare".
  // Muting is critical: browsers block programmatic play() without a user gesture,
  // so if the follower never tapped the screen, the host's later "play" event
  // would silently fail. Muted autoplay is always permitted; the follower can
  // unmute with a single tap once sync is running.
  useEffect(() => {
    if (!peerPreparing || started || !isPandacine) return;
    setStartAt(peerPreparing.time ?? 0);
    setPausedByHost(true);
    setStarted(true);
    setPlayerLoading(true);
    // Pre-mute so the upcoming h.play() from host's play event isn't blocked.
    const h = customPlayerRef.current;
    if (h) h.setMuted(true);
    clearPeerPreparing();
  }, [peerPreparing, started, isPandacine, clearPeerPreparing]);


  async function sendWatchInviteMessage(receiverId: string, extra?: Record<string, unknown>) {
    if (!me || !movie) return { error: new Error("Missing data") };
    const media_meta = {
      tmdb_id: Number(tmdbId),
      media_type: isTv ? "tv" : "movie",
      poster_path: movie.poster_path ?? null,
      release_date: movie.release_date ?? movie.first_air_date ?? null,
      vote_average: movie.vote_average ?? null,
      overview: movie.overview ?? null,
      ...(extra ?? {}),
    };
    return await supabase.from("messages").insert({
      sender_id: me.id,
      receiver_id: receiverId,
      content: movie.title,
      type: "watch_invite",
      media_meta: media_meta as never,
    });
  }

  async function inviteToWatch() {
    if (!me || !partner || !movie) return;
    const { error } = await sendWatchInviteMessage(partner.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Invite sent — waiting for ${partnerFirst} 🍿`);
    setWaitingFor({ id: partner.id, name: partnerFirst });
  }

  async function inviteFriend(friendId: string, friendName: string) {
    if (!me || !movie) return;
    // Embed `with: me.id` so when the friend opens the invite, their watch
    // page joins the same sync room keyed to this pair (not their partner).
    const { error } = await sendWatchInviteMessage(friendId, { with: me.id });
    if (error) { toast.error(error.message); return; }
    const first = friendName.split(" ")[0];
    toast.success(`Invite sent — waiting for ${first} 🍿`);
    setFriendPickerOpen(false);
    setWaitingFor({ id: friendId, name: first });
    // Move sender into the same shared room so both sides sync on this friend.
    if (!realPartner || realPartner.id !== friendId) {
      navigate({
        to: "/app/movies/$id/watch",
        params: { id: String(tmdbId) },
        search: (prev: Record<string, unknown>) => ({ ...prev, with: friendId }),
        replace: true,
      });
    }
  }




  function openFullscreen() {
    const el = document.getElementById("movie-frame");
    if (el && (el as any).requestFullscreen) (el as any).requestFullscreen();
  }

  function switchSource(i: number) {
    if (followerLocked) {
      toast.info(`Server is controlled by ${partnerFirst}.`, { id: "source-locked", duration: 1800 });
      setSourceMenuOpen(false);
      return;
    }
    setSourceIdx(i);
    setSourceMenuOpen(false);
    setStarted(true);
    setPlayerLoading(true);
    setIframeKey((k) => k + 1);
  }




  function startCountdown(seconds = 4) {
    if (followerLocked) {
      toast.info(`Playback is controlled by ${partnerFirst}.`, { id: "countdown-locked", duration: 1800 });
      return;
    }
    const syncTime = peer && peer.currentTime > mine.currentTime ? peer.currentTime : mine.currentTime;
    sendCountdown(seconds, syncTime > 5 ? syncTime : undefined);
  }

  function syncToPartner() {
    if (!peer) return toast.info("Waiting for partner's player…");
    applySeek(Math.max(0, peer.currentTime - 1));
    toast.success(`Synced to ${partner?.display_name.split(" ")[0]} at ${fmtTime(peer.currentTime)}`);
  }

  function pullPartnerHere() {
    if (followerLocked) {
      toast.info(`Playback is controlled by ${partnerFirst}.`, { id: "pull-locked", duration: 1800 });
      return;
    }
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
  // Prefer the current episode still for a cinematic frame on series
  const currentEp = useMemo(
    () => (isTv ? seasonEps.find((e) => e.episode_number === episode) ?? null : null),
    [isTv, seasonEps, episode],
  );
  const currentEpIdx = useMemo(
    () => (isTv ? seasonEps.findIndex((e) => e.episode_number === episode) : -1),
    [isTv, seasonEps, episode],
  );
  const nextEp = useMemo(
    () => (currentEpIdx >= 0 && currentEpIdx < seasonEps.length - 1 ? seasonEps[currentEpIdx + 1] : null),
    [currentEpIdx, seasonEps],
  );
  const episodeStill = currentEp?.still_path ? `https://image.tmdb.org/t/p/w1280${currentEp.still_path}` : null;
  const backdropUrl =
    episodeStill ??
    (movie?.backdrop_path
      ? (/^https?:\/\//i.test(movie.backdrop_path) ? movie.backdrop_path : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`)
      : null);

  return (
    <div className={`relative min-h-screen pt-6 pb-24 transition-colors duration-500 ${cinemaMode ? "bg-black" : ""}`}>
      {cinemaMode && (
        <button
          onClick={() => setCinemaMode(false)}
          className="fixed top-4 right-4 z-[60] h-10 px-4 rounded-full bg-black/85 border border-white/10 text-white/80 hover:text-white text-[10px] uppercase tracking-[0.3em] flex items-center gap-1.5 backdrop-blur shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]"
        >
          <X className="size-3" /> Exit cinema
        </button>
      )}
      {/* Ambient backdrop glow (episode-aware on series) */}
      {backdropUrl && (
        <div
          aria-hidden
          key={backdropUrl}
          className="pointer-events-none fixed inset-0 -z-10 opacity-30 transition-opacity duration-700"
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
      <header className={`px-5 pb-4 flex items-center gap-3 max-w-6xl mx-auto transition-opacity duration-500 ${cinemaMode ? "opacity-0 pointer-events-none h-0 overflow-hidden pb-0" : "opacity-100"}`}>

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
        <div className="relative">
          <button
            onClick={() => setViewersOpen((v) => !v)}
            className="h-9 pl-1 pr-2.5 rounded-full bg-surface/70 backdrop-blur border border-border flex items-center gap-1.5 text-candle text-[11px]"
            aria-label="Who's watching"
          >
            <div className="flex -space-x-2">
              {me?.avatar_url ? (
                <AvatarImg src={me.avatar_url} alt="You" className="size-6 rounded-full object-cover border-2 border-velvet" />
              ) : (
                <div className="size-6 rounded-full bg-petal/30 border-2 border-velvet flex items-center justify-center text-[10px] text-petal font-semibold">
                  {(me?.display_name ?? "Y")[0]}
                </div>
              )}
              {partner && (
                partner.avatar_url ? (
                  <AvatarImg src={partner.avatar_url} alt={partner.display_name} className="size-6 rounded-full object-cover border-2 border-velvet" />
                ) : (
                  <div className="size-6 rounded-full bg-petal/20 border-2 border-velvet flex items-center justify-center text-[10px] text-petal font-semibold">
                    {partnerFirst[0]}
                  </div>
                )
              )}
            </div>
            <span className="font-semibold">{partner ? 2 : 1}</span>
          </button>
          {viewersOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setViewersOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-40 w-64 rounded-2xl bg-velvet border border-border shadow-2xl shadow-black/60 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-candle-muted">In the room</span>
                  <span className="text-[10px] text-candle-muted">{partner ? 2 : 1} watching</span>
                </div>
                {/* Me */}
                <div className="px-3 py-2.5 flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    {me?.avatar_url ? (
                      <AvatarImg src={me.avatar_url} alt="You" className="size-9 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="size-9 rounded-full bg-petal/20 border border-border flex items-center justify-center text-petal font-serif italic">
                        {(me?.display_name ?? "Y")[0]}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-velvet bg-green-400 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-candle font-semibold truncate">You</span>
                      {iAmHost && (
                        <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-petal text-velvet text-[8px] font-bold uppercase tracking-wider">
                          <Crown className="size-2.5" /> Host
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-candle-muted">{fmtTime(mine.currentTime)}{mine.duration ? ` / ${fmtTime(mine.duration)}` : ""}</p>
                  </div>
                </div>
                {/* Partner */}
                {partner && (
                  <div className="px-3 py-2.5 flex items-center gap-2.5 border-t border-border/60">
                    <div className="relative shrink-0">
                      {partner.avatar_url ? (
                        <AvatarImg src={partner.avatar_url} alt={partner.display_name} className="size-9 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="size-9 rounded-full bg-petal/20 border border-border flex items-center justify-center text-petal font-serif italic">
                          {partnerFirst[0]}
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-velvet ${partnerOnline ? "bg-green-400 animate-pulse" : "bg-candle-muted/50"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-candle font-semibold truncate">{partnerFirst}</span>
                        {partnerIsHost && (
                          <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-petal text-velvet text-[8px] font-bold uppercase tracking-wider">
                            <Crown className="size-2.5" /> Host
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-candle-muted">
                        {partnerOnline ? (peer ? `${peer.event} · ${fmtTime(peer.currentTime)}` : "in the room") : "waiting…"}
                      </p>
                    </div>
                  </div>
                )}
                {!hostId && (
                  <button
                    onClick={() => { claimHost(); setViewersOpen(false); }}
                    className="w-full px-3 py-2 border-t border-border/60 bg-petal/10 hover:bg-petal/20 text-petal text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Crown className="size-3" /> Claim host
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="px-3 md:px-5 max-w-6xl mx-auto">
        {/* Partner sync bar */}
        {partner && (
          <div className="mb-3 rounded-2xl border border-border bg-surface/60 backdrop-blur px-3 py-2.5 flex items-center gap-3">
            <div className="relative shrink-0">
              {partner.avatar_url ? (
                <AvatarImg src={partner.avatar_url} alt={partner.display_name} className="size-10 rounded-full object-cover border border-border" />
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
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className="text-candle font-semibold truncate">{partnerFirst}</span>
                {partnerOnline ? (
                  <span className="shrink-0 text-green-400 text-[10px] flex items-center gap-1"><Wifi className="size-2.5"/>live</span>
                ) : (
                  <span className="shrink-0 text-candle-muted text-[10px] flex items-center gap-1"><WifiOff className="size-2.5"/>away</span>
                )}
                {peer && (
                  <span className="shrink-0 ml-auto text-candle-muted text-[10px] flex items-center gap-1 tabular-nums">
                    <CircleDot className={`size-2.5 ${peer.event === "play" ? "text-green-400" : peer.event === "pause" ? "text-amber-400" : "text-candle-muted"}`} />
                    <span className="hidden sm:inline">{peer.event === "play" ? "Playing" : peer.event === "pause" ? "Paused" : peer.event}</span>
                    <span>{fmtTime(peer.currentTime)}</span>
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
              <div className="mt-1 flex items-center gap-2 text-[10px] text-candle-muted tabular-nums">
                <span className="shrink-0">You {fmtTime(mine.currentTime)}</span>
                {driftAbs != null && (
                  <span className={`shrink-0 mx-auto px-1.5 py-0.5 rounded-full ${inSync ? "text-green-400 bg-green-400/10" : driftAbs > 15 ? "text-rose-400 bg-rose-400/10" : "text-amber-400 bg-amber-400/10"}`}>
                    {inSync ? "in sync" : `${drift! > 0 ? "▲" : "▼"} ${fmtTime(driftAbs)}`}
                  </span>
                )}
                <span className="shrink-0 ml-auto">{mine.duration ? fmtTime(mine.duration) : "--:--"}</span>
              </div>
            </div>

          </div>
        )}

        {/* Player chrome — cinema, sleep timer, fullscreen */}
        <div className="mb-2 flex items-center justify-end gap-1.5">
          <div className="relative group/sleep">
            <button
              className={`h-8 px-3 rounded-full border text-[10px] uppercase tracking-[0.25em] flex items-center gap-1.5 transition ${
                sleepMinutes != null
                  ? "bg-petal/15 border-petal/50 text-petal"
                  : "bg-surface/60 border-border text-candle-muted hover:text-petal hover:border-petal/40"
              }`}
              onClick={(e) => {
                const menu = (e.currentTarget.parentElement?.querySelector("[data-sleep-menu]") as HTMLElement | null);
                if (menu) menu.classList.toggle("hidden");
              }}
              aria-label="Sleep timer"
            >
              <Moon className="size-3" />
              {sleepMinutes != null ? `${sleepMinutes}m` : "Sleep"}
            </button>
            <div data-sleep-menu className="hidden absolute right-0 top-full mt-2 z-30 w-40 rounded-2xl bg-velvet border border-border shadow-2xl shadow-black/60 overflow-hidden">
              {[15, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={(e) => { setSleep(m); (e.currentTarget.parentElement as HTMLElement)?.classList.add("hidden"); }}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-petal/10 flex items-center justify-between ${sleepMinutes === m ? "text-petal" : "text-candle"}`}
                >
                  <span>In {m} minutes</span>
                  {sleepMinutes === m && <Check className="size-3" />}
                </button>
              ))}
              {sleepMinutes != null && (
                <button
                  onClick={(e) => { setSleep(null); (e.currentTarget.parentElement as HTMLElement)?.classList.add("hidden"); }}
                  className="w-full px-3 py-2 text-left text-xs text-candle-muted hover:bg-petal/10 border-t border-border/60"
                >
                  Turn off
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setCinemaMode((v) => !v)}
            className={`h-8 px-3 rounded-full border text-[10px] uppercase tracking-[0.25em] flex items-center gap-1.5 transition ${
              cinemaMode
                ? "bg-petal text-velvet border-petal shadow-lg shadow-petal/30"
                : "bg-surface/60 border-border text-candle-muted hover:text-petal hover:border-petal/40"
            }`}
            aria-pressed={cinemaMode}
          >
            <Sparkles className="size-3" />
            Cinema
          </button>
          <button
            onClick={openFullscreen}
            className="h-8 w-8 rounded-full bg-surface/60 border border-border text-candle-muted hover:text-petal hover:border-petal/40 flex items-center justify-center transition"
            aria-label="Fullscreen"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>

        {/* Player — framed like a cinema screen */}
        <div className="relative group/player">
          {/* Layered petal halo — slow, breathing */}
          <div aria-hidden className="absolute -inset-3 rounded-[32px] bg-petal/25 blur-[80px] opacity-70 pointer-events-none animate-[halo-pulse_6s_ease-in-out_infinite]" />
          <div aria-hidden className="absolute -inset-1 rounded-[28px] bg-gradient-to-br from-petal/30 via-transparent to-petal/10 blur-2xl opacity-70 pointer-events-none" />
          {/* Hairline conic sheen on the frame */}
          <div aria-hidden className="absolute -inset-[1px] rounded-2xl md:rounded-3xl bg-[conic-gradient(from_120deg,transparent_0deg,rgba(238,130,175,0.35)_60deg,transparent_140deg,transparent_220deg,rgba(238,130,175,0.25)_300deg,transparent_360deg)] opacity-60 pointer-events-none" />
          <div className="relative rounded-2xl md:rounded-3xl overflow-hidden bg-black border border-petal/30 aspect-video shadow-[0_40px_100px_-24px_rgba(238,130,175,0.4),0_0_0_1px_rgba(238,130,175,0.15)_inset] transition-shadow duration-700 group-hover/player:shadow-[0_50px_120px_-20px_rgba(238,130,175,0.55),0_0_0_1px_rgba(238,130,175,0.25)_inset]">

            {started ? (
              isPandacine && pandacine ? (
                toEmbedUrl(pandacine.videoSrc) ? (
                  <>
                    <iframe
                      key={`pandacine-embed-${iframeKey}`}
                      src={pausedByHost ? "about:blank" : toEmbedUrl(pandacine.videoSrc)!}
                      className="absolute inset-0 w-full h-full bg-black"
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                      allowFullScreen
                      onLoad={() => { setPlayerLoading(false); setReady(true); }}
                    />
                    {pausedByHost && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 pointer-events-none">
                        <div className="px-4 py-2 rounded-full bg-black/70 border border-white/10 text-white/90 text-xs tracking-wide backdrop-blur">
                          Paused by {partnerFirst}
                        </div>
                      </div>
                    )}
                    <a
                      href={pandacine.videoSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 z-20 px-3 py-1.5 rounded-full text-[11px] tracking-wide bg-black/70 border border-white/15 text-white/85 hover:text-white backdrop-blur"
                    >
                      Open in Drive ↗
                    </a>
                  </>


                ) : (
                <CustomMoviePlayer
                  key={`pandacine-${iframeKey}`}
                  src={pandacine.videoSrc}
                  sources={(() => {
                    const extras = (pandacine.qualities ?? []).filter((q) => q.url && q.label);
                    if (extras.length === 0) return undefined;
                    return [
                      { label: "Auto", src: pandacine.videoSrc },
                      ...extras.map((q) => ({ label: q.label, src: q.url, height: q.height ?? undefined })),
                    ];
                  })()}
                  poster={backdropUrl}
                  startAt={startAt}
                    locked={followerLocked}
                  onLockedAttempt={() => {
                    toast.info(`Playback is controlled by ${partnerFirst}.`, { id: "locked-attempt", duration: 1800 });
                  }}
                  onReady={(h) => {
                    customPlayerRef.current = h;
                    setCustomPlayerReady((n) => n + 1);
                    setPlayerLoading(false);
                    setReady(true);
                  }}
                  
                  onEvent={(evt) => {
                    if (suppressPlayerEventRef.current) return;
                    if (followerLocked) return;
                    const now = Date.now();
                    const isDiscrete = evt.event === "play" || evt.event === "pause" || evt.event === "seeked" || evt.event === "ended" || evt.event === "ratechange";
                    const claimingNow = isDiscrete && partner && !hostId && !!me;
                    if (claimingNow) claimHost();
                    // Once a host exists, only the host publishes controls;
                    // followers only mirror to avoid independent audio paths.
                    if (!iAmHost && !claimingNow && !isDiscrete) return;
                    if (isDiscrete || now - lastPublishRef.current > 500) {
                      lastPublishRef.current = now;
                      publish({
                        event: evt.event,
                        currentTime: evt.currentTime,
                        duration: evt.duration,
                        sourceIdx,
                        playbackRate: evt.playbackRate,
                        season: isTv ? season : null,
                        episode: isTv ? episode : null,
                      });
                    }
                  }}
                  onBufferingChange={sendBuffering}
                />
                )
              ) : (
                <>
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
                  {!!hostId && !iAmHost && (
                    <div className="absolute inset-0 z-10 flex items-end justify-center pb-6 pointer-events-auto bg-transparent">
                      <div className="px-4 py-2 rounded-full bg-black/70 border border-white/10 text-white/90 text-xs tracking-wide backdrop-blur">
                        Host controls playback
                      </div>
                    </div>
                  )}
                </>
              )
            ) : (
              <button
                onClick={() => {
                  if (gateActive && !partnerIsHost && !hostId) claimHost();
                  if (partnerIsHost && peer) {
                    pendingAutoJoinPlayRef.current = false;
                    pendingAutoJoinRef.current = peer.event !== "pause" ? peer.currentTime : null;
                    setStartAt(peer.currentTime);
                    setPausedByHost(peer.event === "pause");
                  } else {
                    setPausedByHost(false);
                  }
                  setStarted(true);
                  setPlayerLoading(true);
                }}
                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 group overflow-hidden"
                style={
                  backdropUrl
                    ? {
                        backgroundImage: `linear-gradient(to top, rgba(10,5,15,0.92), rgba(10,5,15,0.35)), url(${backdropUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {/* Slowly drifting blur veil for luxury depth */}
                <span aria-hidden className="absolute inset-0 backdrop-blur-[2px] bg-velvet/20" />
                <span aria-hidden className="absolute -inset-1/4 bg-[radial-gradient(circle_at_30%_40%,rgba(238,130,175,0.28),transparent_60%)] blur-3xl animate-[halo-pulse_8s_ease-in-out_infinite]" />

                {partnerIsHost && peer && peer.event !== "pause" && (
                  <span className="relative z-10 absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-petal/90 backdrop-blur text-velvet text-[10px] uppercase tracking-[0.25em] font-bold shadow-lg shadow-petal/50 animate-pulse">
                    {partnerFirst} is watching · tap to join
                  </span>
                )}
                <span className="relative z-10 flex flex-col items-center gap-3">
                  {/* Concentric rings */}
                  <span className="relative">
                    <span aria-hidden className="absolute inset-0 rounded-full bg-petal/25 blur-2xl scale-150 animate-[halo-pulse_3s_ease-in-out_infinite]" />
                    <span aria-hidden className="absolute -inset-4 rounded-full border border-petal/25 animate-[ring-expand_3s_ease-out_infinite]" />
                    <span aria-hidden className="absolute -inset-4 rounded-full border border-petal/20 animate-[ring-expand_3s_ease-out_infinite] [animation-delay:1.2s]" />
                    <span className={`relative size-20 md:size-24 rounded-full bg-gradient-to-br from-petal to-petal/80 text-velvet flex items-center justify-center shadow-[0_20px_60px_-10px_rgba(238,130,175,0.7)] group-hover:scale-110 group-active:scale-95 transition-transform duration-500 ring-4 ring-petal/20 backdrop-blur-sm ${partnerIsHost && peer && peer.event !== "pause" ? "animate-pulse" : ""}`}>
                      <Play className="size-8 md:size-10 fill-velvet ml-1" />
                    </span>
                  </span>
                  <span className="text-candle font-serif italic text-lg md:text-2xl tracking-wide drop-shadow-[0_2px_16px_rgba(238,130,175,0.35)]">
                    {partnerIsHost && peer ? `Join ${partnerFirst} at ${fmtTime(peer.currentTime)}` : "Raise the curtain"}
                  </span>
                  <span className="text-candle-muted text-[11px] uppercase tracking-[0.35em]">{currentSource?.label ?? "Loading"}</span>
                </span>
              </button>
            )}

            {started && playerLoading && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-velvet/50 backdrop-blur-2xl animate-[fade-in_0.4s_ease-out]">
                <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(238,130,175,0.25),transparent_60%)] animate-[halo-pulse_3s_ease-in-out_infinite]" />
                <div className="relative flex flex-col items-center gap-4 text-candle">
                  <span className="relative size-14 rounded-full flex items-center justify-center bg-petal/10 border border-petal/30 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(238,130,175,0.6)]">
                    <span aria-hidden className="absolute inset-0 rounded-full border-t-2 border-petal animate-spin" />
                    <RefreshCw className="size-5 text-petal" />
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.4em] text-candle-muted">Dimming the lights</span>
                </div>
              </div>
            )}

            {/* Partner online but not on the storage source — sync is disabled */}
            {started && !!partner && partnerOnline && isPandacine && peerSourceKind !== "pandacine" && peerSourceKind !== "unknown" && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-velvet/85 border border-petal/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-petal backdrop-blur-md">
                Waiting for {partnerFirst} to load the movie…
              </div>
            )}

            {/* Both loaded — host taps to actually start */}
            {started && gateActive && bothReady && iAmHost && pausedByHost && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-velvet/70 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.35em] text-petal">Both ready 💞</p>
                <button
                  onClick={() => {
                    const h = customPlayerRef.current;
                    setPausedByHost(false);
                    runSuppressedPlayerAction(() => {
                      h?.setMuted(false);
                      h?.seek(startAt ?? 0);
                      h?.play();
                    });
                    publish({
                      event: "play",
                      currentTime: startAt ?? 0,
                      duration: h?.duration() ?? mine.duration,
                      sourceIdx,
                      playbackRate: 1,
                      season: isTv ? season : null,
                      episode: isTv ? episode : null,
                    });
                  }}
                  className="relative size-24 rounded-full bg-gradient-to-br from-petal to-petal/80 text-velvet flex items-center justify-center shadow-[0_20px_60px_-10px_rgba(238,130,175,0.7)] active:scale-95 transition-transform ring-4 ring-petal/20"
                >
                  <Play className="size-10 fill-velvet ml-1" />
                </button>
                <p className="text-xs text-candle-muted">Start the film together</p>
              </div>
            )}

            {/* Vidking follower — partner paused mid-movie */}
            {started && !isPandacine && pausedByHost && !gateActive && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-velvet/75 backdrop-blur-sm pointer-events-none">
                <span className="relative size-14 rounded-full flex items-center justify-center bg-petal/10 border border-petal/30">
                  <Timer className="size-5 text-petal animate-pulse" />
                </span>
                <p className="text-[10px] uppercase tracking-[0.35em] text-petal">Paused</p>
                <p className="text-sm text-candle">{partnerFirst} paused · resuming together at {fmtTime(startAt ?? 0)}</p>
              </div>
            )}


            {/* Follower waits for host to start */}
            {started && gateActive && bothReady && !iAmHost && pausedByHost && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-velvet/70 backdrop-blur-sm pointer-events-none">
                <span className="relative size-14 rounded-full flex items-center justify-center bg-petal/10 border border-petal/30">
                  <Crown className="size-5 text-petal animate-pulse" />
                </span>
                <p className="text-[10px] uppercase tracking-[0.35em] text-petal">Ready</p>
                <p className="text-sm text-candle">Waiting for {partnerFirst} to start…</p>
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

            {/* Floating reactions over the player */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              {floaties.map((f) => (
                <span
                  key={f.id}
                  className="absolute text-3xl md:text-4xl select-none"
                  style={{
                    left: `${f.x}%`,
                    bottom: "8%",
                    animation: "floaty-rise 2.4s ease-out forwards",
                    filter: "drop-shadow(0 4px 12px rgba(238,130,175,0.6))",
                  }}
                >
                  {f.emoji}
                </span>
              ))}
            </div>
          </div>

          {/* Reaction bar */}
          <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => fireReaction(emoji)}
                className="size-10 rounded-full bg-surface/60 backdrop-blur border border-border hover:border-petal/60 hover:bg-petal/10 hover:scale-110 active:scale-95 transition text-xl flex items-center justify-center shadow-lg shadow-black/20"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Together tools — right under the screen */}
          {partner && (
            <div className="mt-3 rounded-2xl border border-border bg-surface/40 backdrop-blur px-3 py-3">
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

              <div className="mb-2 flex items-center gap-2">
                {!iAmHost && !hostId ? (
                  <button
                    onClick={claimHost}
                    className="flex-1 h-10 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-petal/30"
                  >
                    <Crown className="size-3.5" /> Take the reins
                  </button>
                ) : iAmHost ? (
                  <button
                    onClick={releaseHost}
                    className="flex-1 h-10 rounded-full bg-surface border border-petal/60 text-petal text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Crown className="size-3.5 fill-petal" /> You're the host · release
                  </button>
                ) : (
                  <div className="flex-1 h-10 rounded-full bg-surface/70 border border-border text-candle-muted text-xs flex items-center justify-center gap-1.5">
                    <Crown className="size-3.5 text-petal" /> {partnerFirst} controls playback
                  </div>
                )}
              </div>


              {partnerIsHost && (
                <div className="mb-2 rounded-xl bg-petal/10 border border-petal/30 px-3 py-2 text-[11px] text-candle flex items-center gap-2">
                  <Crown className="size-3 text-petal shrink-0" />
                  <span>Auto-following {partnerFirst} — their play, pause & skips control your screen.</span>
                </div>
              )}

              {/* Equal trio: Countdown · Server · Whisper */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <button
                  onClick={() => startCountdown(4)}
                  className="h-9 rounded-full bg-surface border border-border text-[11px] text-candle flex items-center justify-center gap-1 min-w-0 px-2"
                >
                  <Timer className="size-3 shrink-0" />
                  <span className="truncate">Countdown</span>
                </button>

                <div className="relative min-w-0">
                  <button
                    onClick={() => setSourceMenuOpen((v) => !v)}
                    title={currentSource?.label ?? "Server"}
                    className="w-full h-9 rounded-full bg-surface border border-border text-[11px] text-candle flex items-center justify-center gap-1 px-2"
                  >
                    <Server className="size-3 text-petal shrink-0" />
                    <span className="truncate">{currentSource?.label ?? "Server"}</span>
                  </button>
                  {sourceMenuOpen && (
                    <div className="absolute z-20 top-full mt-2 left-1/2 -translate-x-1/2 w-[16rem] rounded-2xl bg-velvet/95 backdrop-blur-xl border border-petal/25 shadow-2xl shadow-black/60 p-2.5 space-y-2">
                      {(() => {
                        const ours = allSources.filter((s) => s.id.startsWith("vidking") || s.kind === "pandacine");
                        const mirrors = allSources.filter((s) => !s.id.startsWith("vidking") && s.kind !== "pandacine");
                        const Chip = ({ s }: { s: (typeof allSources)[number] }) => {
                          const i = allSources.indexOf(s);
                          const active = i === sourceIdx;
                          return (
                            <button
                              key={s.id}
                              onClick={() => switchSource(i)}
                              title={s.hint}
                              className={`h-5 rounded-full border text-[9.5px] px-1.5 flex items-center gap-1 shrink-0 transition ${active ? "bg-petal/25 border-petal/60 text-petal shadow-inner shadow-petal/10" : "bg-surface/60 border-border/50 text-candle hover:border-petal/40 hover:text-petal"}`}
                            >
                              {active && <span className="size-1 rounded-full bg-petal" />}
                              <span className="truncate">{s.label}</span>
                            </button>
                          );
                        };
                        return (
                          <>
                            <div>
                              <div className="px-1 mb-1 text-[8.5px] uppercase tracking-[0.3em] text-petal/70">Pandacine</div>
                              <div className="flex flex-wrap gap-1">
                                {ours.map((s) => <Chip key={s.id} s={s} />)}
                              </div>
                            </div>
                            <div className="h-px bg-gradient-to-r from-transparent via-petal/25 to-transparent" />
                            <div>
                              <div className="px-1 mb-1 text-[8.5px] uppercase tracking-[0.3em] text-candle-muted/70">Mirrors</div>
                              <div className="flex flex-wrap gap-1">
                                {mirrors.map((s) => <Chip key={s.id} s={s} />)}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>


                {partner ? (
                  <Link
                    to="/app/chat/$peerId"
                    params={{ peerId: partner.id }}
                    className="h-9 rounded-full bg-surface border border-border text-[11px] text-candle flex items-center justify-center gap-1 hover:text-petal hover:border-petal/40 transition min-w-0 px-2"
                  >
                    <MessageCircle className="size-3 shrink-0" />
                    <span className="truncate">Whisper</span>
                  </Link>
                ) : (
                  <span className="h-9 rounded-full bg-surface/40 border border-border/50 text-[11px] text-candle-muted/60 flex items-center justify-center gap-1 min-w-0 px-2">
                    <MessageCircle className="size-3 shrink-0" />
                    <span className="truncate">Whisper</span>
                  </span>
                )}
              </div>

              {/* Invite row — partner + friends */}
              <div className="grid grid-cols-2 gap-1.5">
                {partner ? (
                  <button
                    onClick={inviteToWatch}
                    className="h-10 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-petal/30 min-w-0 px-2"
                  >
                    <Send className="size-3.5 shrink-0" />
                    <span className="truncate">Invite {partnerFirst}</span>
                  </button>
                ) : (
                  <Link
                    to="/app/invite"
                    className="h-10 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-petal/30 min-w-0 px-2"
                  >
                    <Send className="size-3.5 shrink-0" />
                    <span className="truncate">Invite partner</span>
                  </Link>
                )}
                <button
                  onClick={() => setFriendPickerOpen(true)}
                  className="h-10 rounded-full bg-surface border border-petal/40 text-petal text-xs font-semibold flex items-center justify-center gap-1.5 min-w-0 px-2 hover:bg-petal/10"
                >
                  <Users className="size-3.5 shrink-0" />
                  <span className="truncate">Invite a friend</span>
                </button>
              </div>
            </div>
          )}

          {/* Up Next — under Together */}
          {isTv && nextEp && (
            <button
              onClick={() => setEpisode(nextEp.episode_number)}
              className="mt-3 w-full group relative overflow-hidden rounded-2xl border border-petal/30 bg-gradient-to-br from-velvet via-surface/80 to-velvet text-left flex items-stretch shadow-[0_20px_60px_-30px_rgba(238,130,175,0.6)] hover:border-petal/70 transition"
            >
              <div className="relative w-32 sm:w-44 aspect-video shrink-0 overflow-hidden">
                {nextEp.still_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${nextEp.still_path}`}
                    alt={nextEp.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-surface flex items-center justify-center text-candle-muted">
                    <Tv className="size-6 opacity-40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-velvet/80 via-velvet/20 to-transparent" />
                <div className="absolute top-1.5 left-1.5 h-5 px-1.5 rounded-md bg-velvet/85 text-petal text-[10px] font-semibold flex items-center">
                  S{season}·E{nextEp.episode_number}
                </div>
              </div>
              <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-petal flex items-center gap-1.5">
                  <Play className="size-3 fill-petal" /> Up next
                </p>
                <h4 className="mt-1 text-sm sm:text-base font-serif italic text-candle truncate">
                  {nextEp.name || `Episode ${nextEp.episode_number}`}
                </h4>
                {nextEp.overview && (
                  <p className="mt-0.5 text-[11px] text-candle-muted line-clamp-2">{nextEp.overview}</p>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-candle-muted">
                  {nextEp.runtime ? (
                    <span className="inline-flex items-center gap-0.5"><Clock className="size-3" />{nextEp.runtime}m</span>
                  ) : null}
                  {nextEp.air_date ? (
                    <span className="inline-flex items-center gap-0.5"><CalendarDays className="size-3" />{nextEp.air_date}</span>
                  ) : null}
                </div>
              </div>
              <div className="hidden sm:flex items-center pr-4 text-petal">
                <ChevronRight className="size-6" />
              </div>
            </button>
          )}
        </div>

        <style>{`
          @keyframes floaty-rise {
            0% { transform: translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
            15% { transform: translateY(-20px) scale(1.1) rotate(-6deg); opacity: 1; }
            100% { transform: translateY(-260px) scale(1) rotate(8deg); opacity: 0; }
          }
        `}</style>


        {/* Series — luxurious season & episode gallery */}
        {isTv && tvSeasons.length > 0 && (() => {
          const currentEp = seasonEps.find((e) => e.episode_number === episode);
          const currentIdx = seasonEps.findIndex((e) => e.episode_number === episode);
          const prevEp = currentIdx > 0 ? seasonEps[currentIdx - 1] : null;
          const nextEp = currentIdx >= 0 && currentIdx < seasonEps.length - 1 ? seasonEps[currentIdx + 1] : null;
          const totalEps = seasonEps.length;
          const fmtRuntime = (m: number | null) => (m && m > 0 ? `${m}m` : null);
          const stillUrl = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w780${p}` : null);
          return (
            <div className="mt-3 rounded-2xl bg-gradient-to-b from-surface/80 to-velvet/40 border border-border overflow-hidden">
              {/* Header: series badge + seasons */}
              <div className="px-3 pt-3 pb-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-petal/15 border border-petal/30 text-petal text-[10px] uppercase tracking-widest">
                  <Tv className="size-3" /> Series
                </span>
                <span className="text-[10px] uppercase tracking-widest text-candle-muted">
                  {totalEps} {totalEps === 1 ? "episode" : "episodes"} this season
                </span>
                <div className="ml-auto flex items-center gap-1.5 overflow-x-auto max-w-full">
                  {tvSeasons.map((s) => {
                    const active = s.season_number === season;
                    return (
                      <button
                        key={s.season_number}
                        onClick={() => setSeason(s.season_number)}
                        className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-medium transition-all border ${
                          active
                            ? "bg-petal text-velvet border-petal shadow-[0_4px_18px_-4px_rgba(238,130,175,0.55)]"
                            : "bg-velvet/70 border-border text-candle-muted hover:border-petal/40 hover:text-candle"
                        }`}
                        title={s.name}
                      >
                        S{s.season_number}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current episode spotlight card */}
              {currentEp && (
                <div className="mx-3 mb-3 rounded-xl bg-velvet/70 border border-petal/25 overflow-hidden shadow-[0_10px_30px_-18px_rgba(238,130,175,0.55)]">
                  <div className="flex gap-3">
                    <div className="relative shrink-0 w-28 sm:w-40 aspect-video bg-surface overflow-hidden">
                      {stillUrl(currentEp.still_path) ? (
                        <img
                          src={stillUrl(currentEp.still_path)!}
                          alt={currentEp.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-candle-muted">
                          <Tv className="size-6 opacity-40" />
                        </div>
                      )}
                      <div className="absolute top-1 left-1 h-5 px-1.5 rounded-md bg-velvet/85 text-petal text-[10px] font-semibold tracking-wide flex items-center">
                        S{season}·E{currentEp.episode_number}
                      </div>
                      {customEps.some((r) => r.season === season && r.episode === currentEp.episode_number) && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-petal/90 text-velvet text-[10px] font-bold flex items-center justify-center">✦</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-2 pr-2.5">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-petal/80">Now playing</p>
                      <h3 className="mt-0.5 text-sm sm:text-base font-serif italic text-candle truncate">
                        {currentEp.name || `Episode ${currentEp.episode_number}`}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] text-candle-muted">
                        {fmtRuntime(currentEp.runtime) && (
                          <span className="inline-flex items-center gap-0.5"><Clock className="size-3" />{fmtRuntime(currentEp.runtime)}</span>
                        )}
                        {currentEp.air_date && (
                          <span className="inline-flex items-center gap-0.5"><CalendarDays className="size-3" />{currentEp.air_date}</span>
                        )}
                      </div>
                      {currentEp.overview && (
                        <p className="mt-1 text-[11px] text-candle-muted line-clamp-2 sm:line-clamp-3">{currentEp.overview}</p>
                      )}
                    </div>
                  </div>
                  {/* Prev / Next controls */}
                  <div className="flex items-center justify-between border-t border-border/60 px-2 py-1.5 bg-velvet/40">
                    <button
                      disabled={!prevEp}
                      onClick={() => prevEp && setEpisode(prevEp.episode_number)}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-full text-[11px] text-candle disabled:opacity-30 disabled:cursor-not-allowed hover:text-petal transition"
                    >
                      <ChevronLeft className="size-3.5" />
                      {prevEp ? `E${prevEp.episode_number}` : "Start"}
                    </button>
                    <span className="text-[10px] uppercase tracking-widest text-candle-muted">
                      {currentIdx + 1} / {totalEps}
                    </span>
                    <button
                      disabled={!nextEp}
                      onClick={() => nextEp && setEpisode(nextEp.episode_number)}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-full text-[11px] text-candle disabled:opacity-30 disabled:cursor-not-allowed hover:text-petal transition"
                    >
                      {nextEp ? `E${nextEp.episode_number}` : "End"}
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Episode gallery */}
              <div className="px-3 pb-3">
                <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-1.5">All episodes</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 snap-x snap-mandatory scroll-smooth">
                  {seasonEps.map((ep) => {
                    const active = ep.episode_number === episode;
                    const hasOverride = customEps.some((r) => r.season === season && r.episode === ep.episode_number);
                    const img = stillUrl(ep.still_path);
                    return (
                      <button
                        key={ep.episode_number}
                        onClick={() => setEpisode(ep.episode_number)}
                        className={`group shrink-0 snap-start w-40 sm:w-44 text-left rounded-xl overflow-hidden border transition-all ${
                          active
                            ? "border-petal bg-velvet/80 shadow-[0_8px_24px_-10px_rgba(238,130,175,0.6)] scale-[1.01]"
                            : "border-border bg-velvet/40 hover:border-petal/40 hover:bg-velvet/60"
                        }`}
                        title={ep.name}
                      >
                        <div className="relative aspect-video bg-surface overflow-hidden">
                          {img ? (
                            <img
                              src={img}
                              alt={ep.name}
                              className={`w-full h-full object-cover transition-transform duration-300 ${active ? "" : "group-hover:scale-105"}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-candle-muted">
                              <Tv className="size-5 opacity-40" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-velvet/90 via-velvet/10 to-transparent" />
                          <div className="absolute top-1 left-1 h-5 px-1.5 rounded-md bg-velvet/85 text-petal text-[10px] font-semibold flex items-center">
                            E{ep.episode_number}
                          </div>
                          {hasOverride && (
                            <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-petal/90 text-velvet text-[10px] font-bold flex items-center justify-center">✦</div>
                          )}
                          {active && (
                            <div className="absolute bottom-1 right-1 h-5 px-1.5 rounded-full bg-petal text-velvet text-[9px] font-bold uppercase tracking-widest flex items-center gap-0.5">
                              <Play className="size-2.5 fill-velvet" /> Now
                            </div>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className={`text-[11px] truncate ${active ? "text-candle" : "text-candle-muted group-hover:text-candle"}`}>
                            {ep.name || `Episode ${ep.episode_number}`}
                          </p>
                          {fmtRuntime(ep.runtime) && (
                            <p className="text-[9px] text-candle-muted mt-0.5">{fmtRuntime(ep.runtime)}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}


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

      </div>

      {me && partner && movie && (
        <WatchTogetherPanel
          me={me}
          partner={partner}
          movieId={tmdbId}
          movieTitle={movie.title}
          moviePoster={movie.poster_path ? (/^https?:\/\//i.test(movie.poster_path) ? movie.poster_path : `https://image.tmdb.org/t/p/w154${movie.poster_path}`) : null}
          mediaType={isTv ? "tv" : "movie"}
        />
      )}

      {/* Waiting-for-friend overlay */}
      {waitingFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-velvet/85 backdrop-blur-lg p-6" onClick={() => setWaitingFor(null)}>
          <div
            className="w-full max-w-sm rounded-3xl bg-surface border border-petal/30 shadow-2xl p-6 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setWaitingFor(null)}
              className="absolute top-3 right-3 size-8 rounded-full bg-velvet/60 flex items-center justify-center text-candle-muted hover:text-candle"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <div className="mx-auto mb-4 relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-2 border-petal/30" />
              <div className="absolute inset-0 rounded-full border-2 border-petal border-t-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full bg-petal/20 flex items-center justify-center text-2xl">
                🍿
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-petal mb-1">Invite sent</p>
            <h3 className="font-serif italic text-xl text-candle mb-2">Waiting for {waitingFor.name}…</h3>
            <p className="text-xs text-candle-muted mb-5 leading-relaxed">
              We whispered the invite in their chat. When they open the movie, you'll watch it together in perfect sync 💞
            </p>
            <div className="flex gap-2">
              <Link
                to="/app/chat/$peerId"
                params={{ peerId: waitingFor.id }}
                className="flex-1 h-10 rounded-full bg-surface-elevated border border-border text-xs font-semibold text-candle flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="size-3.5" /> Open chat
              </Link>
              <button
                onClick={() => setWaitingFor(null)}
                className="flex-1 h-10 rounded-full bg-petal text-velvet text-xs font-semibold"
              >
                Keep watching
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friend invite picker */}
      {friendPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3" onClick={() => setFriendPickerOpen(false)}>
          <div
            className="w-full max-w-sm rounded-3xl bg-velvet border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-petal">Invite a friend</p>
                <h3 className="font-serif italic text-lg text-candle">Pick a panda 🍿</h3>
              </div>
              <button
                onClick={() => setFriendPickerOpen(false)}
                className="size-8 rounded-full bg-surface flex items-center justify-center text-candle-muted hover:text-candle"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {(() => {
                const meId = friendsQuery.data?.me;
                const profiles = friendsQuery.data?.profiles ?? {};
                const accepted = (friendsQuery.data?.friendships ?? []).filter((f) => f.status === "accepted");
                const friends = accepted
                  .map((f) => (f.requester_id === meId ? f.addressee_id : f.requester_id))
                  .filter((id): id is string => !!id && id !== partner?.id)
                  .map((id) => profiles[id])
                  .filter(Boolean);
                if (friendsQuery.isLoading) {
                  return <p className="text-center text-sm text-candle-muted py-8">Loading…</p>;
                }
                if (friends.length === 0) {
                  return (
                    <div className="py-8 px-4 text-center">
                      <p className="text-sm text-candle-muted mb-3">No friends yet 🥺</p>
                      <Link
                        to="/app/friends"
                        onClick={() => setFriendPickerOpen(false)}
                        className="inline-block px-5 py-2.5 bg-petal text-velvet rounded-full text-xs font-semibold"
                      >
                        Find friends
                      </Link>
                    </div>
                  );
                }
                return (
                  <ul className="space-y-1">
                    {friends.map((f) => (
                      <li key={f.id}>
                        <button
                          onClick={() => inviteFriend(f.id, f.display_name || f.username)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-surface transition text-left"
                        >
                          {f.avatar_url ? (
                            <AvatarImg src={f.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                          ) : (
                            <div className="size-10 rounded-full bg-petal/20 text-petal flex items-center justify-center font-serif text-sm">
                              {(f.display_name || f.username || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-candle truncate">{f.display_name || f.username}</p>
                            <p className="text-[11px] text-candle-muted truncate">@{f.username}</p>
                          </div>
                          <Send className="size-4 text-petal shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomWatch({ customId }: { customId: string }) {
  const search = Route.useSearch();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.with, realPartner?.id, friendsQuery.data?.profiles]);
  const [movie, setMovie] = useState<any>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerReady, setPlayerReady] = useState(0);
  const [customLoadIssue, setCustomLoadIssue] = useState(false);
  const [showReflection, setShowReflection] = useState(false);

  const {
    mine, peer, partnerOnline, publish, sendSeek, sendCountdown, countdown, clearCountdown,
    incomingSeek, clearIncomingSeek, hostId, claimHost, releaseHost, drift,
    peerBuffering, sendBuffering, startTogether, peerLatencyMs,
  } = useWatchSync(me?.id ?? null, partner?.id ?? null, `custom:${customId}`, "movie");


  const handleRef = useRef<CustomPlayerHandle | null>(null);
  const suppressRef = useRef(false);
  const lastAppliedPeerEventRef = useRef<number>(0);
  const lastPublishRef = useRef(0);
  // Local receipt time per peer packet — avoids clock-skew drift.
  const peerReceivedAtRef = useRef<Record<number, number>>({});


  const iAmHost = !!me && hostId === me.id;
  const partnerIsHost = !!partner && hostId === partner.id;
  // Non-host is locked whenever a partner is in the room, even before the host
  // claim resolves — stops double-audio and independent skipping.
  const followerLocked = !iAmHost && (!!hostId || !!peer);

  const handlePlayerReady = useCallback((h: CustomPlayerHandle) => {
    handleRef.current = h;
    setPlayerReady((n) => n + 1);
  }, []);

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

  const runSuppressed = useCallback((action: () => void, ms = 500) => {
    suppressRef.current = true;
    action();
    window.setTimeout(() => { suppressRef.current = false; }, ms);
  }, []);

  // Rewind-on-buffer (SyncPlay-style): while the partner is stalled, auto-pause
  // the local player. When they resume, kick a 300ms countdown so both restart
  // on the same frame.
  const autoPausedForBufferRef = useRef(false);
  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    if (peerBuffering) {
      if (!h.isPaused()) {
        autoPausedForBufferRef.current = true;
        runSuppressed(() => h.pause());
        toast.info(`${partner?.display_name?.split(" ")[0] ?? "Partner"} is buffering…`, { id: "peer-buffer", duration: 1500 });
      }
    } else if (autoPausedForBufferRef.current) {
      autoPausedForBufferRef.current = false;
      const t = h.currentTime();
      sendCountdown(0.3, t);
      window.setTimeout(() => {
        runSuppressed(() => { h.seek(t); h.play(); });
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerBuffering]);

  // Manual seek request

  useEffect(() => {
    if (!incomingSeek) return;
    if (!handleRef.current) return;
    runSuppressed(() => handleRef.current?.seek(incomingSeek.time));
    clearIncomingSeek();
  }, [incomingSeek, clearIncomingSeek, playerReady, runSuppressed]);

  // Stamp local receipt time for each new peer packet (clock-skew safe).
  useEffect(() => {
    if (!peer) return;
    if (peerReceivedAtRef.current[peer.updatedAt] != null) return;
    peerReceivedAtRef.current[peer.updatedAt] = Date.now();
    const keys = Object.keys(peerReceivedAtRef.current).map(Number).sort((a, b) => b - a);
    for (const k of keys.slice(10)) delete peerReceivedAtRef.current[k];
  }, [peer]);

  // Mutual sync — latency-compensated drift correction. Uses LOCAL receipt
  // time (not the host's wall clock) so cross-machine clock skew can't push
  // the follower into a permanent playbackRate nudge (the "auto fast" bug).
  useEffect(() => {
    if (!peer || !partner) return;
    if (peer.updatedAt <= lastAppliedPeerEventRef.current) return;
    const h = handleRef.current;
    if (!h) return;
    const evt = peer.event;
    if (evt !== "play" && evt !== "pause" && evt !== "seeked" && evt !== "timeupdate" && evt !== "ratechange") return;

    const baseRate = (typeof peer.playbackRate === "number" && peer.playbackRate > 0) ? peer.playbackRate : 1;
    const now = Date.now();
    const receivedAt = peerReceivedAtRef.current[peer.updatedAt] ?? now;
    const hostPlaying = evt !== "pause";
    const elapsed = hostPlaying ? Math.max(0, ((now - receivedAt) + peerLatencyMs) / 1000) * baseRate : 0;
    const targetTime = peer.currentTime + elapsed;
    const drift = h.currentTime() - targetTime; // >0 => follower ahead

    if (evt === "timeupdate") {
      const abs = Math.abs(drift);
      if (abs < 1.5) return; // 1-2s tolerance — no micro-nudges, no reseeks
      lastAppliedPeerEventRef.current = peer.updatedAt;
      runSuppressed(() => {
        if (abs > 3.0) {
          h.seek(targetTime);
          h.setPlaybackRate(baseRate);
          if (followerLocked && h.isPaused()) h.play();
        } else {
          // Very gentle rate nudge — closes drift over ~5s. Restored on next update.
          const nudge = Math.max(-0.08, Math.min(0.08, -drift / 5));
          h.setPlaybackRate(Math.max(0.5, baseRate + nudge));
          window.setTimeout(() => {
            handleRef.current?.setPlaybackRate(baseRate);
          }, 2500);
        }
      }, 250);
      return;

    }

    // Discrete event — align exactly, then match play/pause state.
    lastAppliedPeerEventRef.current = peer.updatedAt;
    runSuppressed(() => {
      h.setPlaybackRate(baseRate);
      if (Math.abs(h.currentTime() - targetTime) > 0.2) h.seek(targetTime);
      if (evt === "play") h.play();
      if (evt === "pause") h.pause();
    });
  }, [peer, partner, playerReady, runSuppressed, followerLocked, peerLatencyMs]);


  // Countdown → both press play together
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!countdown) { setCountdownRemaining(null); return; }
    const tick = () => {
      const rem = Math.ceil((countdown.startAt - Date.now()) / 1000);
      if (rem <= 0) {
        setCountdownRemaining(0);
        runSuppressed(() => {
          if (typeof countdown.time === "number") handleRef.current?.seek(countdown.time);
          handleRef.current?.play();
        });
        setTimeout(() => { clearCountdown(); setCountdownRemaining(null); }, 800);
      } else setCountdownRemaining(rem);
    };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
  }, [countdown, clearCountdown, runSuppressed]);

  const partnerFirst = partner?.display_name.split(" ")[0] ?? "them";
  const driftAbs = drift != null ? Math.abs(drift) : null;
  const inSync = driftAbs != null && driftAbs < 2;

  function handleEvent(evt: {
    event: "play" | "pause" | "seeked" | "timeupdate" | "ended" | "ratechange";
    currentTime: number;
    duration: number;
    playbackRate: number;
  }) {
    if (suppressRef.current) return;
    if (followerLocked) return;
    const isDiscrete = evt.event === "play" || evt.event === "pause" || evt.event === "seeked" || evt.event === "ended" || evt.event === "ratechange";
    if (evt.event === "ended" && me) setShowReflection(true);
    if (isDiscrete && partner && !hostId) claimHost();
    // Host publishes every 250ms during play (tight follower drift), instantly on discrete events.
    if (!isDiscrete && Date.now() - lastPublishRef.current < 250) return;
    lastPublishRef.current = Date.now();
    publish({ event: evt.event, currentTime: evt.currentTime, duration: evt.duration, sourceIdx: 0, playbackRate: evt.playbackRate });
  }


  const syncToPartner = () => {
    if (!peer) return;
    runSuppressed(() => handleRef.current?.seek(peer.currentTime));
  };

  const pullPartnerHere = () => {
    const now = handleRef.current?.currentTime() ?? mine.currentTime;
    sendSeek(now);
    publish({ event: "seeked", currentTime: now, duration: handleRef.current?.duration() ?? mine.duration, sourceIdx: 0 });
  };

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
            <>
              <iframe
                src={`https://www.vidking.net/embed/${movie.media_type ?? "movie"}/${movie.tmdb_id}?color=9146ff&autoPlay=true`}
                className="w-full h-full rounded-2xl bg-black"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
              {!!hostId && !iAmHost && (
                <div className="absolute inset-0 z-10 flex items-end justify-center pb-6 pointer-events-auto">
                  <div className="px-4 py-2 rounded-full bg-black/70 border border-white/10 text-white/90 text-xs tracking-wide backdrop-blur">
                    Host controls playback
                  </div>
                </div>
              )}
            </>
          ) : videoSrc ? (
            toEmbedUrl(videoSrc) ? (
              <div className="relative w-full h-full">
                <iframe
                  src={toEmbedUrl(videoSrc)!}
                  className="w-full h-full rounded-2xl bg-black"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
                <a
                  href={videoSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 z-20 px-3 py-1.5 rounded-full text-[11px] tracking-wide bg-black/70 border border-white/15 text-white/85 hover:text-white backdrop-blur"
                >
                  Open in Drive ↗
                </a>
                <div className="pointer-events-none absolute top-3 left-3 z-20 px-3 py-1.5 rounded-full text-[10px] tracking-widest uppercase bg-black/60 border border-petal/30 text-petal/90 backdrop-blur">
                  Google Drive
                </div>
              </div>
            ) : (
            <CustomMoviePlayer
              src={videoSrc}
              sources={(() => {
                const extras = Array.isArray((movie as any)?.video_qualities)
                  ? ((movie as any).video_qualities as Array<{ label: string; url: string; height?: number | null }>).filter((q) => q?.url && q?.label)
                  : [];
                if (extras.length === 0) return undefined;
                return [
                  { label: "Auto", src: videoSrc },
                  ...extras.map((q) => ({ label: q.label, src: q.url, height: q.height ?? undefined })),
                ];
              })()}
              poster={movie?.backdrop_url ?? movie?.poster_url ?? null}
                locked={followerLocked}
              onLockedAttempt={() => {
                toast.info(`Playback is controlled by ${partnerFirst}.`, { id: "locked-attempt", duration: 1800 });
              }}
              onReady={handlePlayerReady}
              onLoadIssue={() => {
                setCustomLoadIssue(true);
                setVideoSrc(null);
                toast.error("This uploaded file is not playable in the browser here.", { id: "custom-load-issue", duration: 4500 });
              }}
              onEvent={handleEvent}
              onBufferingChange={sendBuffering}
            />
            )


          ) : customLoadIssue ? (
            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center px-6 text-center text-candle-muted text-sm">
              This upload could not be played in the browser. Try another server or re-upload an MP4 encoded for web playback.
            </div>
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
              {!iAmHost && !hostId ? (
                <button
                  onClick={claimHost}
                  className="flex-1 h-10 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-petal/30"
                >
                  <Crown className="size-3.5" /> Take the reins
                </button>
              ) : iAmHost ? (
                <button
                  onClick={releaseHost}
                  className="flex-1 h-10 rounded-full bg-surface border border-petal/60 text-petal text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Crown className="size-3.5 fill-petal" /> You're the host · release
                </button>
              ) : (
                <div className="flex-1 h-10 rounded-full bg-surface/70 border border-border text-candle-muted text-xs flex items-center justify-center gap-1.5">
                  <Crown className="size-3.5 text-petal" /> {partnerFirst} controls playback
                </div>
              )}
              <button
                onClick={() => {
                  if (followerLocked) {
                    toast.info(`Playback is controlled by ${partnerFirst}.`, { id: "countdown-locked", duration: 1800 });
                    return;
                  }
                  sendCountdown(4, mine.currentTime > 5 ? mine.currentTime : undefined);
                }}
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
                onClick={syncToPartner}
                disabled={!peer}
                className="flex-1 h-9 rounded-full bg-surface-elevated text-xs text-candle disabled:opacity-40"
              >
                Jump to {partnerFirst}
              </button>
              <button
                onClick={pullPartnerHere}
                className="flex-1 h-9 rounded-full bg-surface border border-border text-xs text-candle"
              >
                Pull them here
              </button>
            </div>
          </div>
        )}
      </div>
      {showReflection && me && movie && (
        <PostMovieReflection
          movieId={customId}
          movieTitle={movie.title ?? "the film"}
          meId={me.id}
          partnerId={partner?.id ?? null}
          partnerName={partner?.display_name}
          partnerAvatar={partner?.avatar_url}
          onClose={() => setShowReflection(false)}
        />
      )}
    </div>
  );
}



