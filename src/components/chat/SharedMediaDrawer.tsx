import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SignedImage } from "./SignedImage";
import { SignedVideo } from "./SignedVideo";
import { Images, Video as VideoIcon, ImageOff, Download, Play } from "lucide-react";
import { signMedia, type MessageRow } from "@/lib/chat";

type Tab = "all" | "photos" | "videos";

function fmtDur(t: number) {
  if (!isFinite(t) || t <= 0) return null;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Silent, muted video used purely to render a first-frame thumbnail. */
function VideoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [dur, setDur] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const vidRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let live = true;
    signMedia(path).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [path]);

  return (
    <div className="absolute inset-0">
      {url && (
        <video
          ref={vidRef}
          src={url + "#t=0.1"}
          muted
          playsInline
          preload="metadata"
          className={`w-full h-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
          onLoadedMetadata={(e) => {
            setDur(e.currentTarget.duration || 0);
            try { e.currentTarget.currentTime = 0.1; } catch { /* ignore */ }
          }}
          onLoadedData={() => setReady(true)}
        />
      )}
      {/* Play glyph */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="size-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center border border-white/20">
          <Play className="size-3.5 text-white fill-current translate-x-[1px]" />
        </span>
      </div>
      {dur && fmtDur(dur) && (
        <span className="absolute bottom-1 right-1 text-[9px] tabular-nums text-white bg-black/60 px-1.5 py-0.5 rounded-sm border border-white/10">
          {fmtDur(dur)}
        </span>
      )}
    </div>
  );
}

export function SharedMediaDrawer({
  open,
  onOpenChange,
  messages,
  onJumpTo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  messages: MessageRow[];
  onJumpTo?: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [preview, setPreview] = useState<MessageRow | null>(null);

  const media = useMemo(() => {
    return messages
      .filter((m) => (m.type === "image" || m.type === "video") && !!m.media_url && !(m.media_meta as any)?.view_once)
      .slice()
      .reverse();
  }, [messages]);

  const filtered = useMemo(() => {
    if (tab === "photos") return media.filter((m) => m.type === "image");
    if (tab === "videos") return media.filter((m) => m.type === "video");
    return media;
  }, [media, tab]);

  const grouped = useMemo(() => {
    const groups: { key: string; items: MessageRow[] }[] = [];
    for (const m of filtered) {
      const key = monthKey(m.created_at);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(m);
      else groups.push({ key, items: [m] });
    }
    return groups;
  }, [filtered]);

  const counts = useMemo(
    () => ({
      all: media.length,
      photos: media.filter((m) => m.type === "image").length,
      videos: media.filter((m) => m.type === "video").length,
    }),
    [media],
  );

  async function downloadPreview() {
    if (!preview?.media_url) return;
    try {
      const url = await signMedia(preview.media_url);
      const res = await fetch(url);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = preview.type === "video" ? "mp4" : "jpg";
      a.href = href;
      a.download = `pandacine-${preview.id.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1500);
    } catch { /* ignore */ }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md studio-surface backdrop-blur-xl border-l border-border text-foreground p-0"
        >
          <SheetHeader className="px-6 pt-6 pb-3 border-b border-border">
            <SheetTitle className="text-foreground text-base tracking-wide flex items-center gap-2">
              <Images className="h-4 w-4 text-petal" />
              Shared Media
            </SheetTitle>
            <div className="mt-3 flex gap-1.5">
              {(
                [
                  ["all", `All · ${counts.all}`],
                  ["photos", `Photos · ${counts.photos}`],
                  ["videos", `Videos · ${counts.videos}`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k as Tab)}
                  className={`text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border transition-colors ${
                    tab === k
                      ? "bg-petal/20 border-petal/40 text-petal"
                      : "border-border text-candle/60 hover:text-candle"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </SheetHeader>

          <div className="overflow-y-auto h-[calc(100%-7.5rem)] px-4 py-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <ImageOff className="h-10 w-10 text-candle/25" />
                <p className="text-xs text-candle/55 tracking-wide">
                  No shared {tab === "videos" ? "videos" : tab === "photos" ? "photos" : "media"} yet.
                </p>
                <p className="text-[10px] text-candle/35 tracking-wide max-w-[220px]">
                  Photos and videos you send to each other will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {grouped.map((g) => (
                  <section key={g.key}>
                    <h3 className="text-[9px] uppercase tracking-[0.28em] text-candle/50 font-semibold mb-2 px-1">
                      {g.key}
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {g.items.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setPreview(m)}
                          className="relative aspect-square overflow-hidden rounded-md bg-candle/[0.04] group ring-1 ring-border hover:ring-petal/50 transition"
                          title={new Date(m.created_at).toLocaleString()}
                        >
                          {m.type === "image" ? (
                            <SignedImage
                              path={m.media_url!}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                            />
                          ) : (
                            <VideoThumb path={m.media_url!} />
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl studio-surface border-petal/20 p-2">
          {preview?.type === "image" && preview.media_url && (
            <SignedImage path={preview.media_url} className="w-full max-h-[80vh] object-contain rounded-md" />
          )}
          {preview?.type === "video" && preview.media_url && (
            <div className="flex justify-center">
              <SignedVideo path={preview.media_url} />
            </div>
          )}
          {preview && (
            <div className="flex items-center justify-between pt-2 pb-1 px-2 gap-3">
              <span className="text-[10px] uppercase tracking-[0.25em] text-candle/55">
                {new Date(preview.created_at).toLocaleString()}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadPreview}
                  className="text-[10px] uppercase tracking-[0.25em] text-candle/70 hover:text-petal font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="size-3" /> Save
                </button>
                {onJumpTo && (
                  <button
                    onClick={() => {
                      onJumpTo(preview.id);
                      setPreview(null);
                      onOpenChange(false);
                    }}
                    className="text-[10px] uppercase tracking-[0.25em] text-petal hover:text-petal/80 font-semibold"
                  >
                    Jump to message →
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
