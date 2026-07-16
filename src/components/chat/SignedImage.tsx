import { useEffect, useState } from "react";
import { X, Maximize2 } from "lucide-react";
import { signMedia } from "@/lib/chat";

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full text-left"
        aria-label="Open image"
      >
        <img src={url} className={className} loading="lazy" alt="" />
        <span className="absolute top-2 right-2 size-7 rounded-full bg-black/45 backdrop-blur-sm text-white/90 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="size-3.5" />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute top-4 right-4 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center backdrop-blur"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <span className="absolute top-4 left-4 text-[9px] uppercase tracking-[0.28em] text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
            Pandacine
          </span>
          <img
            src={url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-xl shadow-[0_20px_60px_-20px_rgba(236,72,153,0.5)]"
          />
        </div>
      )}
    </>
  );
}
