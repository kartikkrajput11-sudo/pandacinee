import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { HeartHandshake, MessageCircle, Mic, Reply, Smartphone, Sticker, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Chat3DEffect } from "./Chat3DPhoneScene";

const LazyPhoneScene = lazy(() =>
  import("./Chat3DPhoneScene").then((module) => ({ default: module.Chat3DPhoneScene })),
);

const ACTIONS: Array<{ kind: Chat3DEffect; label: string; Icon: typeof HeartHandshake }> = [
  { kind: "nudge", label: "Nudge", Icon: Waves },
  { kind: "hug", label: "Hug", Icon: HeartHandshake },
  { kind: "kiss", label: "Spark", Icon: MessageCircle },
  { kind: "sticker", label: "Sticker", Icon: Sticker },
  { kind: "voice", label: "Voice", Icon: Mic },
  { kind: "reply", label: "Reply", Icon: Reply },
];

function cleanName(name?: string | null) {
  const trimmed = (name ?? "").trim();
  return trimmed || "You";
}

export function Chat3DPhoneDemo({ meName, peerName }: { meName?: string | null; peerName?: string | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [effect, setEffect] = useState<Chat3DEffect>("nudge");
  const [effectTick, setEffectTick] = useState(0);

  useEffect(() => setMounted(true), []);

  const names = useMemo(
    () => ({ me: cleanName(meName).slice(0, 18), peer: cleanName(peerName).slice(0, 18) }),
    [meName, peerName],
  );

  const trigger = (kind: Chat3DEffect) => {
    setEffect(kind);
    setEffectTick((value) => value + 1);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="size-auto p-0 text-candle/55 hover:bg-transparent hover:text-petal"
        aria-label="Open 3D chat demo"
        title="3D chat demo"
      >
        <Smartphone className="size-[18px]" strokeWidth={1.5} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[50%] flex h-[86dvh] w-[calc(100vw-1.25rem)] max-w-5xl flex-col overflow-hidden rounded-3xl border-petal/20 bg-velvet/95 p-0 shadow-velvet backdrop-blur-2xl sm:rounded-3xl">
          <DialogTitle className="sr-only">3D chat phone demo</DialogTitle>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-petal">3D chat</p>
              <h2 className="font-serif text-xl italic text-candle">Phone demo</h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="rounded-full text-candle-muted hover:text-petal"
              aria-label="Close 3D demo"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-petal-soft/20 via-velvet to-background">
            <div className="absolute inset-x-0 top-0 z-10 flex justify-center px-3 pt-3">
              <div className="rounded-full border border-border bg-velvet/70 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-candle-muted backdrop-blur-md">
                Mock chat · {names.me} + {names.peer}
              </div>
            </div>

            {mounted ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-candle-muted">
                    Loading 3D phones…
                  </div>
                }
              >
                <LazyPhoneScene meName={names.me} peerName={names.peer} effect={effect} effectTick={effectTick} />
              </Suspense>
            ) : (
              <div className="h-full" />
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-velvet to-transparent" />
          </div>

          <div className="border-t border-border bg-surface/40 p-3">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ACTIONS.map(({ kind, label, Icon }) => (
                <Button
                  key={kind}
                  type="button"
                  variant="secondary"
                  onClick={() => trigger(kind)}
                  className="h-12 rounded-2xl border border-border bg-surface/70 px-2 text-[11px] text-candle hover:border-petal/40 hover:text-petal"
                >
                  <Icon className="size-4" />
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}