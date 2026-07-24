import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, Scissors, Wand2, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

type Props = {
  file: File;
  onCancel: () => void;
  onConfirm: (finalFile: File, previewUrl: string) => void;
};

export default function StickerEditor({ file, onCancel, onConfirm }: Props) {
  const [srcUrl] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFile, setResultFile] = useState<File | null>(null);

  const onCropComplete = useCallback((_c: Area, pixels: Area) => setArea(pixels), []);

  async function apply(removeBg: boolean) {
    if (!area) return toast.error("Adjust crop first");
    setProcessing(true);
    try {
      let blob = await getCroppedBlob(srcUrl, area);
      if (removeBg) {
        const { removeBackground } = await import("@imgly/background-removal");
        blob = await removeBackground(blob);
      }
      const url = URL.createObjectURL(blob);
      const f = new File([blob], "sticker.png", { type: "image/png" });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(url);
      setResultFile(f);
    } catch (e: any) {
      toast.error(e?.message ?? "Processing failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-3 space-y-3">
      {!resultUrl ? (
        <>
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/50">
            <Cropper
              image={srcUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-petal"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => apply(false)}
              disabled={processing}
              className="flex-1 h-10 px-3 rounded-xl bg-surface border border-border text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processing ? <Loader2 className="size-4 animate-spin" /> : <Scissors className="size-4" />}
              Crop only
            </button>
            <button
              onClick={() => apply(true)}
              disabled={processing}
              className="flex-1 h-10 px-3 rounded-xl bg-petal text-velvet text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processing ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Crop + Remove BG
            </button>
            <button onClick={onCancel} className="h-10 px-3 rounded-xl border border-border text-sm">
              Cancel
            </button>
          </div>
          {processing && <p className="text-[11px] text-candle-muted text-center">Removing background locally — first run downloads the model (~40MB).</p>}
        </>
      ) : (
        <>
          <div className="w-full aspect-square rounded-xl bg-[conic-gradient(#0002_25%,transparent_0_50%,#0002_0_75%,transparent_0)] bg-[length:20px_20px] flex items-center justify-center overflow-hidden">
            <img src={resultUrl} alt="result" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { if (resultUrl) URL.revokeObjectURL(resultUrl); setResultUrl(null); setResultFile(null); }}
              className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold flex items-center justify-center gap-2"
            >
              <RotateCcw className="size-4" /> Redo
            </button>
            <button
              onClick={() => resultFile && resultUrl && onConfirm(resultFile, resultUrl)}
              className="flex-1 h-10 rounded-xl bg-petal text-velvet text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Check className="size-4" /> Use this
            </button>
          </div>
        </>
      )}
    </div>
  );
}
