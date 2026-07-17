import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SignedImage } from "./SignedImage";
import { SignedVideo } from "./SignedVideo";
import { Images, Video as VideoIcon, ImageOff } from "lucide-react";
import type { MessageRow } from "@/lib/chat";

type Tab = "all" | "photos" | "videos";

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

  const counts = useMemo(
    () => ({
      all: media.length,
      photos: media.filter((m) => m.type === "image").length,
      videos: media.filter((m) => m.type === "video").length,
    }),
    [media],
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-velvet/95 backdrop-blur-xl border-l border-petal/15 text-candle p-0"
        >
          <SheetHeader className="px-6 pt-6 pb-3 border-b border-border">
            <SheetTitle className="text-candle text-base tracking-wide flex items-center gap-2">
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
                      : "border-white/10 text-candle/60 hover:text-candle"
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
                <ImageOff className="h-10 w-10 text-candle/20" />
                <p className="text-xs text-candle/50 tracking-wide">
                  No shared {tab === "videos" ? "videos" : tab === "photos" ? "photos" : "media"} yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPreview(m)}
                    className="relative aspect-square overflow-hidden rounded-md bg-black/40 group ring-1 ring-white/5 hover:ring-petal/40 transition"
                  >
                    {m.type === "image" ? (
                      <SignedImage
                        path={m.media_url!}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-petal/20 to-velvet">
                        <VideoIcon className="h-7 w-7 text-petal/80 drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl bg-velvet border-petal/20 p-2">
          {preview?.type === "image" && preview.media_url && (
            <SignedImage path={preview.media_url} className="w-full max-h-[80vh] object-contain rounded-md" />
          )}
          {preview?.type === "video" && preview.media_url && (
            <SignedVideo path={preview.media_url} />
          )}
          {preview && onJumpTo && (
            <div className="flex justify-end pt-2 pb-1 px-2">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
