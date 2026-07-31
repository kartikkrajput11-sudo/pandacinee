import { toast } from "sonner";

function extFromBlob(blob: Blob, fallback: string) {
  const t = (blob.type.split(";")[0] || "").split("/")[1];
  return (t || fallback).toLowerCase();
}

/**
 * Saves a media URL to the user's device / photo gallery.
 * Tries the native share sheet first (iOS/Android expose "Save to Photos"
 * there), then falls back to a classic download.
 */
export async function saveMediaToGallery(
  url: string,
  opts: { kind?: "image" | "video"; name?: string } = {},
) {
  const kind = opts.kind ?? "image";
  const t = toast.loading(kind === "video" ? "Saving video…" : "Saving photo…");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Couldn't reach the file");
    const blob = await res.blob();
    const ext = extFromBlob(blob, kind === "video" ? "mp4" : "jpg");
    const filename = `${opts.name ?? `pandacine-${kind}-${Date.now()}`}.${ext}`;
    const file = new File([blob], filename, { type: blob.type || `${kind}/${ext}` });

    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: filename });
        toast.success("Saved", { id: t });
        return;
      } catch (err: any) {
        // User dismissed the sheet — nothing to report.
        if (err?.name === "AbortError") {
          toast.dismiss(t);
          return;
        }
        // Otherwise fall through to the download path.
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    toast.success(kind === "video" ? "Video saved to your device" : "Photo saved to your device", { id: t });
  } catch (e: any) {
    console.error("[saveMediaToGallery]", e);
    toast.error(e?.message ?? "Couldn't save this media", { id: t });
  }
}
