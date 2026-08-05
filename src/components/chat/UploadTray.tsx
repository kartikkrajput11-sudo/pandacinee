import { useSyncExternalStore } from "react";
import { X, RotateCcw, FileText, Mic, Film } from "lucide-react";
import {
  subscribeUploads,
  getUploadSnapshot,
  cancelUpload,
  retryUpload,
} from "@/lib/upload-manager";

function bytes(n: number) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Premium in-thread progress cards for media that is still uploading. */
export function UploadTray({ scope }: { scope: string }) {
  const tasks = useSyncExternalStore(subscribeUploads, getUploadSnapshot, () => []);
  const mine = tasks.filter((t) => t.scope === scope);
  if (mine.length === 0) return null;

  return (
    <div className="px-3 mt-2 space-y-2">
      {mine.map((t) => {
        const pct = Math.round(t.progress * 100);
        const failed = t.status === "error";
        return (
          <div key={t.id} className="flex justify-end">
            <div className="relative w-[240px] rounded-2xl rounded-br-md overflow-hidden border border-petal/25 bg-surface-elevated shadow-[0_18px_50px_-30px_rgba(236,72,153,0.7)]">
              {t.previewUrl && t.kind !== "file" ? (
                <div className="relative h-[150px] bg-velvet/60">
                  {t.kind === "image" ? (
                    <img src={t.previewUrl} alt="" className="size-full object-cover opacity-70" />
                  ) : (
                    <video src={t.previewUrl} muted className="size-full object-cover opacity-70" />
                  )}
                  <div className="absolute inset-0 bg-velvet/45 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                    {failed ? (
                      <p className="text-[11px] text-petal px-3 text-center">{t.error}</p>
                    ) : (
                      <>
                        <div className="relative size-12">
                          <svg viewBox="0 0 44 44" className="size-12 -rotate-90">
                            <circle cx="22" cy="22" r="19" className="stroke-white/15" strokeWidth="3" fill="none" />
                            <circle
                              cx="22" cy="22" r="19"
                              className="stroke-petal transition-[stroke-dashoffset] duration-200"
                              strokeWidth="3" fill="none" strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 19}
                              strokeDashoffset={2 * Math.PI * 19 * (1 - t.progress)}
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-candle tabular-nums">
                            {pct}%
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.22em] text-candle-muted">
                          {t.status === "processing" ? "Finishing" : "Sending"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-3 flex items-center gap-3">
                  <span className="size-9 rounded-xl bg-petal/15 text-petal flex items-center justify-center shrink-0">
                    {t.kind === "voice" ? <Mic className="size-4" /> : t.kind === "video" ? <Film className="size-4" /> : <FileText className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-candle truncate">{t.name}</p>
                    <p className="text-[10px] text-candle-muted">
                      {failed ? t.error : `${pct}% · ${bytes(t.size)}`}
                    </p>
                  </div>
                </div>
              )}

              {!failed && (
                <div className="h-[3px] bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-petal to-petal/60 transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                {failed && (
                  <button
                    onClick={() => retryUpload(t.id)}
                    className="size-7 rounded-full bg-velvet/80 border border-border text-candle flex items-center justify-center hover:text-petal"
                    aria-label="Retry upload"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                )}
                <button
                  onClick={() => cancelUpload(t.id)}
                  className="size-7 rounded-full bg-velvet/80 border border-border text-candle flex items-center justify-center hover:text-petal"
                  aria-label="Cancel upload"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
