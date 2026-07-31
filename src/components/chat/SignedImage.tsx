import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download } from "lucide-react";
import { signMedia } from "@/lib/chat";
import { saveMediaToGallery } from "@/lib/save-media";

export function SignedImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let m = true;
    signMedia(path).then((u) => m && setUrl(u));
    return () => { m = false; };
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!url) return <div className={`${className} bg-velvet/30 animate-pulse`} />;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      <img
        src={url}
        className={`${className ?? ""} cursor-zoom-in`}
        loading="lazy"
        alt=""
        onPointerDown={stop}
        onPointerUp={stop}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      />

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          onPointerDown={stop}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute top-4 right-4 size-11 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center backdrop-blur"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <span className="absolute top-5 left-4 text-[9px] uppercase tracking-[0.28em] text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
            Pandacine
          </span>
          <img
            src={url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-xl shadow-[0_20px_60px_-20px_rgba(236,72,153,0.5)]"
          />
        </div>,
        document.body,
      )}
    </>
  );
}
