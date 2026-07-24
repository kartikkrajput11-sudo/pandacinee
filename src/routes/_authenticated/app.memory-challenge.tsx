import { createFileRoute, Link } from "@tanstack/react-router";
import { GameBackLink } from "@/components/games/GameBackLink";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Flame, RotateCw, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { gameSfx } from "@/lib/game-sfx";
import { GameChat } from "@/components/games/GameChat";
import { useProfile } from "@/hooks/useProfile";


export const Route = createFileRoute("/_authenticated/app/memory-challenge")({
  component: MemoryChallenge,
});

const PROMPTS = [
  "Show today's view.",
  "Share your favorite snack right now.",
  "Capture something purple.",
  "Send a childhood picture of yourself.",
  "Photograph the light where you are.",
  "Show your desk or space right now.",
  "Take a photo of something that made you smile.",
  "Capture a corner of your home.",
  "Show what you're wearing today (feet count).",
  "Photograph today's sky.",
  "Show a book you love.",
  "Capture your favorite mug.",
  "Show a plant you can see.",
  "Photograph today's meal.",
  "Show your current playlist screen.",
  "Capture a shadow you like.",
  "Show what's in your bag.",
  "Photograph your reflection in something.",
  "Show something old and loved.",
  "Capture the tiniest thing near you.",
  "Show a photo of your feet where you are.",
  "Photograph the weather today.",
  "Show what's on your nightstand.",
  "Capture a color you feel today.",
  "Photograph your hands right now.",
  "Show your favorite spot in the house.",
  "Capture something that smells nice.",
  "Photograph something warm.",
  "Show the sky from your window.",
  "Capture something that reminds you of them.",
];

const STORAGE = "pandacine-memory-challenge";
type Entry = { date: string; prompt: string; dataUrl: string };
type Store = { streak: number; lastDate: string | null; entries: Entry[] };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function todayPrompt() {
  const t = todayStr();
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return PROMPTS[h % PROMPTS.length];
}

function load(): Store {
  if (typeof window === "undefined") return { streak: 0, lastDate: null, entries: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return { streak: 0, lastDate: null, entries: [] };
    const s = JSON.parse(raw) as Store;
    if (s.lastDate && s.lastDate !== todayStr() && s.lastDate !== yesterdayStr()) s.streak = 0;
    return s;
  } catch {
    return { streak: 0, lastDate: null, entries: [] };
  }
}

async function toCompressedDataUrl(file: File, max = 900, quality = 0.75): Promise<string> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("image load failed"));
    img.src = url;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", quality);
}

function MemoryChallenge() {
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const partner = prof?.partner;

  const [store, setStore] = useState<Store>({ streak: 0, lastDate: null, entries: [] });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const prompt = useMemo(() => todayPrompt(), []);
  const completedToday = store.lastDate === todayStr();
  const todayEntry = store.entries.find((e) => e.date === todayStr());

  useEffect(() => {
    setStore(load());
  }, []);

  function persist(next: Store) {
    setStore(next);
    try {
      window.localStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {
      toast.error("Storage full — remove older memories.");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await toCompressedDataUrl(file);
      const t = todayStr();
      const streak =
        store.lastDate && new Date(t).getTime() - new Date(store.lastDate).getTime() === 86400000
          ? store.streak + 1
          : store.lastDate === t
            ? store.streak
            : 1;
      const entries = [{ date: t, prompt, dataUrl }, ...store.entries.filter((x) => x.date !== t)].slice(0, 60);
      persist({ streak, lastDate: t, entries });
      gameSfx.complete();
      toast.success("Memory saved 🐼");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't save that photo");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeToday() {
    if (!todayEntry) return;
    persist({
      streak: Math.max(0, store.streak - 1),
      lastDate: null,
      entries: store.entries.filter((e) => e.date !== todayStr()),
    });
  }

  return (
    <div className="pt-10 px-5 pb-10">
      <header className="flex items-center gap-3 mb-6">
        <GameBackLink className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </GameBackLink>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Photo prompts</p>
          <h1 className="font-serif text-2xl italic">Memory Challenge</h1>
        </div>
      </header>

      <div className="rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft to-transparent p-6 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-petal mb-3">Today's prompt</p>
        <p className="font-serif italic text-2xl text-candle leading-snug">{prompt}</p>

        {todayEntry ? (
          <div className="mt-5 space-y-3">
            <img src={todayEntry.dataUrl} alt="Today's memory" className="w-full rounded-2xl border border-border" />
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-full bg-surface border border-border py-2.5 text-sm text-candle flex items-center justify-center gap-2"
              >
                <RotateCw className="size-4" /> Replace
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(todayEntry.dataUrl);
                    const blob = await res.blob();
                    const file = new File([blob], `memory-${todayEntry.date}.jpg`, { type: blob.type });
                    const shareData: ShareData = { text: `Today's Pandacine memory: ${todayEntry.prompt} 🐼`, files: [file] };
                    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
                      await navigator.share(shareData);
                    } else {
                      await navigator.clipboard.writeText(todayEntry.prompt);
                      toast.success("Prompt copied");
                    }
                  } catch {}
                }}
                className="rounded-full bg-surface border border-border px-4 py-2.5 text-sm text-candle"
                aria-label="Share"
              >
                <Share2 className="size-4" />
              </button>
              <button
                onClick={removeToday}
                className="rounded-full bg-surface border border-border px-4 py-2.5 text-sm text-candle flex items-center gap-2"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-petal text-white px-6 py-3 text-sm font-semibold shadow-petal hover:brightness-110 disabled:opacity-60"
          >
            <Camera className="size-4" />
            {busy ? "Saving…" : "Take / choose photo"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-candle-muted mb-1">
            <Flame className="size-3.5 text-petal" /> Streak
          </div>
          <p className="font-serif text-3xl italic text-candle">{store.streak} <span className="text-sm text-candle-muted not-italic">days</span></p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-candle-muted mb-1">
            <Check className="size-3.5 text-petal" /> Memories
          </div>
          <p className="font-serif text-3xl italic text-candle">{store.entries.length}</p>
        </div>
      </div>

      {store.entries.length > 1 && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-petal mb-3">Recent memories</p>
          <div className="grid grid-cols-3 gap-2">
            {store.entries
              .filter((e) => e.date !== todayStr())
              .slice(0, 12)
              .map((e) => (
                <div key={e.date} className="rounded-xl overflow-hidden border border-border bg-surface">
                  <img src={e.dataUrl} alt={e.prompt} className="w-full aspect-square object-cover" />
                  <p className="text-[9px] text-candle-muted p-1.5 truncate">{e.date}</p>
                </div>
              ))}
          </div>
        </>
      )}

      <p className="mt-6 text-[11px] text-candle-muted text-center">
        Memories are stored privately on this device.
      </p>
    </div>
  );
}
