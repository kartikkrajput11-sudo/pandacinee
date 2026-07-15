import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft,
  Music2,
  Play,
  Trash2,
  Plus,
  Search,
  LogOut,
} from "lucide-react";

import { toast } from "sonner";
import {
  completeSpotifyLogin,
  getMe,
  getMyPlaylists,
  getTopTracks,
  isSpotifyConnected,
  searchTracks,
  spotifyDisconnect,
  startSpotifyLogin,
  type SpotifyMe,
  type SpotifyPlaylist,
  type SpotifyTrack,
} from "@/lib/spotify";

export const Route = createFileRoute("/_authenticated/app/music")({
  component: MusicPage,
  head: () => ({
    meta: [
      { title: "Music · Pandacine" },
      {
        name: "description",
        content:
          "Your personal music player — Spotify + YouTube. Play your playlists, top tracks, or paste any link.",
      },
    ],
  }),
});

/* -------------------------------------------------------------------------- */
/*  YouTube library                                                            */
/* -------------------------------------------------------------------------- */

type YTTrack = {
  id: string;
  kind: "video" | "playlist";
  title: string;
  addedAt: number;
};

const STORAGE_KEY = "pandacine.music.library.v1";

function parseYouTube(input: string): { id: string; kind: "video" | "playlist" } | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return { id: raw, kind: "video" };
  if (/^PL[a-zA-Z0-9_-]{10,}$/.test(raw)) return { id: raw, kind: "playlist" };
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return { id, kind: "video" };
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const list = url.searchParams.get("list");
      if (list && /^PL[a-zA-Z0-9_-]{10,}$/.test(list)) return { id: list, kind: "playlist" };
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { id: v, kind: "video" };
      const m = url.pathname.match(/\/(shorts|embed)\/([a-zA-Z0-9_-]{11})/);
      if (m) return { id: m[2], kind: "video" };
    }
  } catch {
    /* noop */
  }
  return null;
}

async function fetchTitle(kind: "video" | "playlist", id: string): Promise<string> {
  const url =
    kind === "video"
      ? `https://www.youtube.com/watch?v=${id}`
      : `https://www.youtube.com/playlist?list=${id}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { title?: string };
    return data.title ?? (kind === "playlist" ? "YouTube playlist" : "YouTube track");
  } catch {
    return kind === "playlist" ? "YouTube playlist" : "YouTube track";
  }
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

type PlayingSource =
  | { kind: "youtube"; id: string; type: "video" | "playlist"; title: string }
  | { kind: "spotify"; type: "track" | "playlist"; id: string; title: string };

function MusicPage() {
  const [tab, setTab] = useState<"spotify" | "youtube">("spotify");
  const [playing, setPlaying] = useState<PlayingSource | null>(null);

  return (
    <div className="pt-10 px-5 pb-8">
      <header className="flex items-center gap-3 mb-5">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Sound</p>
          <h1 className="font-serif text-2xl italic">Your music</h1>
        </div>
        <div className="size-10 rounded-full bg-petal-soft text-petal flex items-center justify-center">
          <Music2 className="size-5" />
        </div>
      </header>

      <NowPlaying playing={playing} onClose={() => setPlaying(null)} />

      <div className="grid grid-cols-2 gap-2 mb-5 p-1 bg-surface rounded-full border border-border">
        <button
          onClick={() => setTab("spotify")}
          className={`py-2 rounded-full text-xs font-semibold transition ${
            tab === "spotify" ? "bg-petal text-velvet petal-glow" : "text-candle-muted"
          }`}
        >
          Spotify
        </button>
        <button
          onClick={() => setTab("youtube")}
          className={`py-2 rounded-full text-xs font-semibold transition ${
            tab === "youtube" ? "bg-petal text-velvet petal-glow" : "text-candle-muted"
          }`}
        >
          YouTube
        </button>
      </div>

      {tab === "spotify" ? (
        <SpotifyPanel onPlay={setPlaying} />
      ) : (
        <YouTubePanel onPlay={setPlaying} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Now playing (embed players)                                                */
/* -------------------------------------------------------------------------- */

function NowPlaying({ playing, onClose }: { playing: PlayingSource | null; onClose: () => void }) {
  if (!playing) {
    return (
      <div className="rounded-3xl overflow-hidden border border-border bg-surface mb-4">
        <div className="aspect-video bg-black flex flex-col items-center justify-center gap-2 text-candle-muted">
          <Music2 className="size-8 opacity-60" />
          <p className="text-xs">Pick something to play</p>
        </div>
      </div>
    );
  }

  let src = "";
  if (playing.kind === "spotify") {
    src = `https://open.spotify.com/embed/${playing.type}/${playing.id}?utm_source=pandacine`;
  } else {
    src =
      playing.type === "playlist"
        ? `https://www.youtube.com/embed/videoseries?list=${playing.id}&autoplay=1`
        : `https://www.youtube.com/embed/${playing.id}?autoplay=1&rel=0`;
  }

  return (
    <div className="rounded-3xl overflow-hidden border border-border bg-surface mb-4">
      <div className={playing.kind === "spotify" ? "h-[352px] bg-black" : "aspect-video bg-black"}>
        <iframe
          key={`${playing.kind}-${playing.id}`}
          src={src}
          title={playing.title}
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <div className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-candle-muted uppercase tracking-widest">
            {playing.kind === "spotify" ? "Spotify" : "YouTube"} · {playing.type}
          </p>
          <p className="font-serif italic truncate text-sm">{playing.title}</p>
        </div>
        <button
          onClick={onClose}
          className="size-8 rounded-full text-candle-muted hover:text-red-400 flex items-center justify-center"
          aria-label="Stop"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Spotify panel                                                              */
/* -------------------------------------------------------------------------- */

function SpotifyPanel({ onPlay }: { onPlay: (s: PlayingSource) => void }) {
  const [connected, setConnected] = useState(false);
  const [me, setMe] = useState<SpotifyMe | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [top, setTop] = useState<SpotifyTrack[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"library" | "top" | "search">("library");

  // Handle OAuth callback (?code=...)
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (error) {
      toast.error(`Spotify: ${error}`);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + url.search);
      return;
    }
    if (code) {
      completeSpotifyLogin(code)
        .then(() => {
          setConnected(true);
          toast.success("Spotify connected");
        })
        .catch((e) => toast.error(e.message ?? "Spotify login failed"))
        .finally(() => {
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, "", url.pathname + url.search);
        });
    } else {
      setConnected(isSpotifyConnected());
    }
  }, []);

  const loadEverything = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, pls, tops] = await Promise.all([getMe(), getMyPlaylists(), getTopTracks()]);
      setMe(meRes);
      setPlaylists(pls);
      setTop(tops);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load Spotify data";
      toast.error(msg);
      if (msg.toLowerCase().includes("reconnect") || msg.includes("401")) {
        setConnected(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) void loadEverything();
  }, [connected, loadEverything]);

  // Debounced search
  useEffect(() => {
    if (view !== "search" || !query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchTracks(query.trim())
        .then(setResults)
        .catch((e) => toast.error(e.message ?? "Search failed"));
    }, 350);
    return () => clearTimeout(t);
  }, [query, view]);

  if (!connected) {
    return (
      <div className="p-6 rounded-3xl border border-petal/30 bg-petal-soft/40 text-center">
        <div className="size-14 mx-auto mb-3 rounded-full bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center text-2xl">
          🎧
        </div>
        <h2 className="font-serif italic text-lg mb-1">Connect Spotify</h2>
        <p className="text-xs text-candle-muted mb-4 leading-relaxed">
          Sign in with your Spotify account to see your playlists, top tracks and search everything.
        </p>
        <button
          onClick={startSpotifyLogin}
          className="w-full py-3 rounded-full bg-[#1DB954] text-black font-semibold text-sm active:scale-95 transition"
        >
          Connect Spotify
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Account row */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-surface rounded-2xl border border-border">
        {me?.images?.[0]?.url ? (
          <img src={me.images[0].url} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="size-10 rounded-full bg-petal-soft" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{me?.display_name ?? "Spotify user"}</p>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">
            {me?.product === "premium" ? "Premium" : "Free"}
          </p>
        </div>
        <button
          onClick={() => {
            spotifyDisconnect();
            setConnected(false);
            setMe(null);
            setPlaylists([]);
            setTop([]);
            toast("Disconnected");
          }}
          className="size-9 rounded-full text-candle-muted hover:text-red-400 flex items-center justify-center"
          aria-label="Disconnect"
        >
          <LogOut className="size-4" />
        </button>
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 mb-4 text-[11px] uppercase tracking-widest">
        {(["library", "top", "search"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-full transition ${
              view === v ? "bg-petal text-velvet" : "bg-surface text-candle-muted border border-border"
            }`}
          >
            {v === "library" ? "Playlists" : v === "top" ? "Top" : "Search"}
          </button>
        ))}
      </div>

      {view === "search" && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-2xl bg-surface border border-border">
          <Search className="size-4 text-candle-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Spotify…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-candle-muted"
          />
        </div>
      )}

      {loading && <p className="text-center text-xs text-candle-muted py-6">Loading…</p>}

      {view === "library" && !loading && (
        <ul className="grid grid-cols-2 gap-3">
          {playlists.map((p) => (
            <li key={p.id}>
              <button
                onClick={() =>
                  onPlay({ kind: "spotify", type: "playlist", id: p.id, title: p.name })
                }
                className="w-full text-left group"
              >
                <div className="aspect-square rounded-2xl overflow-hidden bg-surface border border-border mb-2">
                  {p.images?.[0]?.url ? (
                    <img
                      src={p.images[0].url}
                      alt=""
                      className="w-full h-full object-cover group-active:scale-95 transition"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-candle-muted">
                      <Music2 className="size-8" />
                    </div>
                  )}
                </div>
                <p className="text-sm truncate font-medium">{p.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-candle-muted">
                  {p.tracks.total} tracks
                </p>
              </button>
            </li>
          ))}
          {playlists.length === 0 && (
            <p className="col-span-2 text-center text-xs text-candle-muted py-6">
              No playlists yet on this account.
            </p>
          )}
        </ul>
      )}

      {view === "top" && !loading && <TrackList tracks={top} onPlay={onPlay} />}
      {view === "search" && !loading && <TrackList tracks={results} onPlay={onPlay} />}
    </div>
  );
}

function TrackList({
  tracks,
  onPlay,
}: {
  tracks: SpotifyTrack[];
  onPlay: (s: PlayingSource) => void;
}) {
  if (!tracks.length) {
    return <p className="text-center text-xs text-candle-muted py-6">Nothing to show yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {tracks.map((t) => {
        const cover = t.album.images?.[t.album.images.length - 1]?.url;
        return (
          <li key={t.id}>
            <button
              onClick={() =>
                onPlay({
                  kind: "spotify",
                  type: "track",
                  id: t.id,
                  title: `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`,
                })
              }
              className="w-full flex items-center gap-3 p-2 rounded-2xl border border-border bg-surface hover:border-petal/40 transition text-left"
            >
              {cover ? (
                <img src={cover} alt="" className="size-11 rounded-xl object-cover" />
              ) : (
                <div className="size-11 rounded-xl bg-petal-soft" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{t.name}</p>
                <p className="text-[11px] text-candle-muted truncate">
                  {t.artists.map((a) => a.name).join(", ")}
                </p>
              </div>
              <Play className="size-4 text-petal shrink-0" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  YouTube panel (personal library, saved in localStorage)                    */
/* -------------------------------------------------------------------------- */

function YouTubePanel({ onPlay }: { onPlay: (s: PlayingSource) => void }) {
  const [library, setLibrary] = useState<YTTrack[]>([]);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLibrary(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    } catch {
      /* noop */
    }
  }, [library]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library;
    return library.filter((t) => t.title.toLowerCase().includes(q));
  }, [library, query]);

  async function addTrack() {
    const parsed = parseYouTube(input);
    if (!parsed) {
      toast.error("Paste a YouTube link or ID");
      return;
    }
    if (library.some((t) => t.id === parsed.id)) {
      toast("Already in your library");
      return;
    }
    setAdding(true);
    const title = await fetchTitle(parsed.kind, parsed.id);
    setLibrary((prev) => [{ id: parsed.id, kind: parsed.kind, title, addedAt: Date.now() }, ...prev]);
    setInput("");
    setAdding(false);
    onPlay({ kind: "youtube", type: parsed.kind, id: parsed.id, title });
    toast.success(parsed.kind === "playlist" ? "Playlist added" : "Track added");
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTrack();
          }}
          placeholder="Paste YouTube link or playlist URL"
          className="flex-1 px-4 py-3 bg-surface border border-border rounded-2xl text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
        />
        <button
          onClick={addTrack}
          disabled={adding || !input.trim()}
          className="px-4 rounded-2xl bg-petal text-velvet font-semibold text-sm petal-glow disabled:opacity-50 flex items-center gap-1.5"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>

      {library.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Search className="size-4 text-candle-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-candle-muted"
            />
            <span className="text-[10px] uppercase tracking-widest text-candle-muted">
              {library.length} {library.length === 1 ? "item" : "items"}
            </span>
          </div>
          <ul className="space-y-2">
            {filtered.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-surface"
              >
                <button
                  onClick={() =>
                    onPlay({ kind: "youtube", type: t.kind, id: t.id, title: t.title })
                  }
                  className="size-9 rounded-full bg-petal/10 text-petal flex items-center justify-center shrink-0"
                  aria-label="Play"
                >
                  <Play className="size-4 ml-0.5" />
                </button>
                <button
                  onClick={() =>
                    onPlay({ kind: "youtube", type: t.kind, id: t.id, title: t.title })
                  }
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm truncate">{t.title}</p>
                  <p className="text-[10px] uppercase tracking-widest text-candle-muted mt-0.5">
                    {t.kind === "playlist" ? "Playlist" : "Track"}
                  </p>
                </button>
                <button
                  onClick={() => setLibrary((prev) => prev.filter((x) => x.id !== t.id))}
                  className="size-8 rounded-full text-candle-muted hover:text-red-400 flex items-center justify-center"
                  aria-label="Remove"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
