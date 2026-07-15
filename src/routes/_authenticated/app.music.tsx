import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Music2, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Trash2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/music")({
  component: MusicPage,
  head: () => ({
    meta: [
      { title: "Music · Pandacine" },
      { name: "description", content: "Your personal music player — save YouTube tracks and playlists and play them right inside Pandacine." },
    ],
  }),
});

type Track = {
  id: string;      // youtube video or playlist id
  kind: "video" | "playlist";
  title: string;
  addedAt: number;
};

const STORAGE_KEY = "pandacine.music.library.v1";

function parseYouTube(input: string): { id: string; kind: "video" | "playlist" } | null {
  const raw = input.trim();
  if (!raw) return null;
  // plain 11-char video id
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return { id: raw, kind: "video" };
  // playlist id
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
      // shorts / embed
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

function MusicPage() {
  const [library, setLibrary] = useState<Track[]>([]);
  const [input, setInput] = useState("");
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load library
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLibrary(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);
  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    } catch {
      /* noop */
    }
  }, [library]);

  const current = currentIdx != null ? library[currentIdx] : null;

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
    const track: Track = { id: parsed.id, kind: parsed.kind, title, addedAt: Date.now() };
    setLibrary((prev) => [track, ...prev]);
    setInput("");
    setAdding(false);
    if (currentIdx == null) {
      setCurrentIdx(0);
      setIsPlaying(true);
    }
    toast.success(parsed.kind === "playlist" ? "Playlist added" : "Track added");
  }

  function playIndex(i: number) {
    setCurrentIdx(i);
    setIsPlaying(true);
  }

  function playByLibraryIndex(t: Track) {
    const idx = library.findIndex((x) => x.id === t.id);
    if (idx >= 0) playIndex(idx);
  }

  function remove(id: string) {
    setLibrary((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (currentIdx != null && idx === currentIdx) {
        setCurrentIdx(next.length ? Math.min(idx, next.length - 1) : null);
      } else if (currentIdx != null && idx < currentIdx) {
        setCurrentIdx(currentIdx - 1);
      }
      return next;
    });
  }

  function next() {
    if (!library.length || currentIdx == null) return;
    if (shuffle && library.length > 1) {
      let n = currentIdx;
      while (n === currentIdx) n = Math.floor(Math.random() * library.length);
      setCurrentIdx(n);
    } else {
      setCurrentIdx((currentIdx + 1) % library.length);
    }
    setIsPlaying(true);
  }

  function prev() {
    if (!library.length || currentIdx == null) return;
    setCurrentIdx((currentIdx - 1 + library.length) % library.length);
    setIsPlaying(true);
  }

  function togglePlay() {
    if (currentIdx == null && library.length) {
      setCurrentIdx(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((p) => !p);
  }

  // Build iframe src. autoplay + enablejsapi so the play/pause toggle can post messages.
  const iframeSrc = useMemo(() => {
    if (!current) return null;
    const autoplay = isPlaying ? 1 : 0;
    const loopParam = loop ? 1 : 0;
    if (current.kind === "playlist") {
      return `https://www.youtube.com/embed/videoseries?list=${current.id}&autoplay=${autoplay}&loop=${loopParam}&enablejsapi=1`;
    }
    return `https://www.youtube.com/embed/${current.id}?autoplay=${autoplay}&loop=${loopParam}&playlist=${current.id}&enablejsapi=1&rel=0`;
  }, [current, isPlaying, loop]);

  // Send postMessage play/pause command when toggling without changing track
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !current) return;
    const cmd = isPlaying ? "playVideo" : "pauseVideo";
    win.postMessage(JSON.stringify({ event: "command", func: cmd, args: [] }), "*");
  }, [isPlaying, current]);

  return (
    <div className="pt-10 px-5 pb-8">
      <header className="flex items-center gap-3 mb-6">
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

      {/* Player */}
      <div className="rounded-3xl overflow-hidden border border-border bg-surface mb-4">
        <div className="aspect-video bg-black">
          {iframeSrc ? (
            <iframe
              ref={iframeRef}
              key={current?.id}
              src={iframeSrc}
              title={current?.title ?? "Music player"}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-candle-muted gap-2">
              <Music2 className="size-8 opacity-60" />
              <p className="text-xs">Add a YouTube link to start</p>
            </div>
          )}
        </div>
        <div className="p-4">
          <p className="font-serif italic truncate">{current?.title ?? "Nothing playing"}</p>
          <p className="text-[11px] text-candle-muted mt-0.5">
            {current ? (current.kind === "playlist" ? "Playlist" : "Single track") : "Silence"}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setShuffle((s) => !s)}
              className={`size-9 rounded-full flex items-center justify-center transition ${
                shuffle ? "bg-petal-soft text-petal" : "text-candle-muted"
              }`}
              aria-label="Shuffle"
            >
              <Shuffle className="size-4" />
            </button>
            <button onClick={prev} className="size-10 rounded-full text-candle hover:text-petal" aria-label="Previous">
              <SkipBack className="size-5 mx-auto" />
            </button>
            <button
              onClick={togglePlay}
              className="size-14 rounded-full bg-petal text-velvet flex items-center justify-center petal-glow active:scale-95 transition"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="size-6" /> : <Play className="size-6 ml-0.5" />}
            </button>
            <button onClick={next} className="size-10 rounded-full text-candle hover:text-petal" aria-label="Next">
              <SkipForward className="size-5 mx-auto" />
            </button>
            <button
              onClick={() => setLoop((l) => !l)}
              className={`size-9 rounded-full flex items-center justify-center transition ${
                loop ? "bg-petal-soft text-petal" : "text-candle-muted"
              }`}
              aria-label="Loop"
            >
              <Repeat className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add */}
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
      <p className="text-[11px] text-candle-muted mb-5 leading-relaxed">
        Tip: paste a track (<code className="text-petal">youtu.be/...</code>) or an entire playlist
        (<code className="text-petal">youtube.com/playlist?list=...</code>).
      </p>

      {/* Library */}
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
            {filtered.map((t) => {
              const active = current?.id === t.id;
              return (
                <li
                  key={t.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition ${
                    active ? "border-petal/60 bg-petal-soft/40" : "border-border bg-surface"
                  }`}
                >
                  <button
                    onClick={() => playByLibraryIndex(t)}
                    className="size-9 rounded-full bg-petal/10 text-petal flex items-center justify-center shrink-0"
                    aria-label="Play"
                  >
                    {active && isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
                  </button>
                  <button
                    onClick={() => playByLibraryIndex(t)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm truncate">{t.title}</p>
                    <p className="text-[10px] uppercase tracking-widest text-candle-muted mt-0.5">
                      {t.kind === "playlist" ? "Playlist" : "Track"}
                    </p>
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    className="size-8 rounded-full text-candle-muted hover:text-red-400 flex items-center justify-center"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
