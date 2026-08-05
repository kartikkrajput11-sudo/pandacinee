import { useEffect, useState } from "react";
import { signMedia } from "@/lib/chat";
import { MediaLightbox } from "./MediaLightbox";

/**
 * Collect every chat photo currently in the DOM, in visual order, so the
 * lightbox can swipe through the whole conversation.
 */
function collectGallery(current: string): { paths: string[]; index: number } {
  if (typeof document === "undefined") return { paths: [current], index: 0 };
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-media-path]"));
  const paths = nodes.map((n) => n.dataset.mediaPath!).filter(Boolean);
  const index = paths.indexOf(current);
  if (index < 0 || paths.length === 0) return { paths: [current], index: 0 };
  return { paths, index };
}

export function SignedImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ paths: string[]; index: number } | null>(null);

  useEffect(() => {
    let m = true;
    signMedia(path).then((u) => m && setUrl(u));
    return () => { m = false; };
  }, [path]);

  if (!url) {
    return (
      <div
        className={`${className ?? ""} relative overflow-hidden bg-velvet/40 border border-border/50`}
        style={{ minWidth: 140, minHeight: 120 }}
      >
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-petal/15 to-transparent" />
      </div>
    );
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      <img
        src={url}
        data-media-path={path}
        className={`${className ?? ""} cursor-zoom-in transition-transform duration-300 hover:scale-[1.015]`}
        loading="lazy"
        alt=""
        onPointerDown={stop}
        onPointerUp={stop}
        onClick={(e) => { e.stopPropagation(); setGallery(collectGallery(path)); }}
      />

      {gallery && (
        <MediaLightbox
          paths={gallery.paths}
          index={gallery.index}
          onIndex={(i) => setGallery((g) => (g ? { ...g, index: i } : g))}
          onClose={() => setGallery(null)}
        />
      )}
    </>
  );
}
