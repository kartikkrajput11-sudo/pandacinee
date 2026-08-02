import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Feather, Sparkles, Heart, Gem, ChevronRight, ChevronLeft } from "lucide-react";
import { annivTitle, daysTogetherFrom, todayKey, type AnnivDay } from "@/lib/anniversary-mode";

/**
 * GoldenHourExperience — the once-a-year (or once-a-month) takeover.
 * A slow, gilded, five-act ritual. Deliberately NOT a countdown / game / movie:
 * it's a quiet ceremony — light the candle, speak a vow, gild a memory,
 * name a wish, seal the day.
 */

type Act = {
  eyebrow: string;
  title: string;
  body: string;
  Icon: typeof Heart;
  /** optional writing prompt persisted per-day in localStorage */
  prompt?: { key: string; placeholder: string; label: string };
};

export function GoldenHourExperience({
  day,
  partnerName,
  onClose,
}: {
  day: NonNullable<AnnivDay>;
  partnerName: string;
  onClose: () => void;
}) {
  const [act, setAct] = useState(0);
  const [lit, setLit] = useState(false);
  const together = daysTogetherFrom(day.anchor);
  const dkey = todayKey();

  const acts: Act[] = useMemo(
    () => [
      {
        eyebrow: "Act I",
        title: "Light the candle",
        body: `The theatre dims. Somewhere between then and now, ${together.toLocaleString()} days quietly stacked themselves into something worth keeping.`,
        Icon: Sparkles,
      },
      {
        eyebrow: "Act II",
        title: "Speak a vow",
        body: `One sentence — no poetry required. Something you promise ${partnerName} for the year ahead.`,
        Icon: Feather,
        prompt: {
          key: `pandacine.golden.${dkey}.vow`,
          label: "Today's vow",
          placeholder: `I promise ${partnerName} that…`,
        },
      },
      {
        eyebrow: "Act III",
        title: "Gild a memory",
        body: "Pick one ordinary moment from this chapter and set it in gold. Not the big one — the small one you keep returning to.",
        Icon: Gem,
        prompt: {
          key: `pandacine.golden.${dkey}.memory`,
          label: "The gilded moment",
          placeholder: "The night we…",
        },
      },
      {
        eyebrow: "Act IV",
        title: "Name a wish",
        body: "Something you want to exist by the next time this day comes around.",
        Icon: Heart,
        prompt: {
          key: `pandacine.golden.${dkey}.wish`,
          label: "A wish for next year",
          placeholder: "By this day next year, I hope we…",
        },
      },
      {
        eyebrow: "Finale",
        title: "Seal the day",
        body: "Press the seal. The gold stays on everything until midnight — the whole theatre is yours today.",
        Icon: Sparkles,
      },
    ],
    [together, partnerName, dkey],
  );

  const current = acts[act]!;
  const Icon = current.Icon;

  useEffect(() => {
    const t = window.setTimeout(() => setLit(true), 350);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dust = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        key: i,
        left: Math.random() * 100,
        delay: Math.random() * 6,
        dur: 9 + Math.random() * 9,
        size: 2 + Math.random() * 5,
      })),
    [],
  );

  const body = (
    <div className="fixed inset-0 z-[10000] overflow-y-auto golden-scope" role="dialog" aria-modal="true">
      {/* Deep gilded ground */}
      <div className="fixed inset-0 bg-[#0b0705]" />
      <div
        className="fixed inset-0 animate-golden-bloom"
        style={{
          background:
            "radial-gradient(1100px 700px at 50% -10%, rgba(201,168,76,0.30), transparent 60%), radial-gradient(900px 800px at 15% 110%, rgba(196,101,74,0.22), transparent 62%), radial-gradient(800px 700px at 100% 80%, rgba(240,215,140,0.14), transparent 60%)",
        }}
      />

      {/* Curtains parting */}
      <div aria-hidden className="fixed inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#2a0f14] to-transparent animate-golden-curtain-l" />
      <div aria-hidden className="fixed inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#2a0f14] to-transparent animate-golden-curtain-r" />

      {/* Gold dust */}
      <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none">
        {dust.map((d) => (
          <span
            key={d.key}
            className="absolute -bottom-4 rounded-full animate-golden-dust"
            style={{
              left: `${d.left}%`,
              width: d.size,
              height: d.size,
              background: "rgba(240,215,140,0.9)",
              boxShadow: "0 0 12px rgba(201,168,76,0.9)",
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.dur}s`,
            }}
          />
        ))}
      </div>

      <button
        onClick={onClose}
        aria-label="Leave the golden hour"
        className="fixed top-4 right-4 z-20 size-10 rounded-full border border-[#c9a84c]/40 bg-black/40 text-[#f0d78c] hover:bg-[#c9a84c]/20 flex items-center justify-center backdrop-blur"
      >
        <X className="size-4" />
      </button>

      <div className="relative z-10 min-h-full flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-xl">
          {/* Crest */}
          <div className="text-center mb-8">
            <div className="mx-auto relative size-20 mb-4">
              <span
                className={`absolute inset-0 rounded-full blur-2xl transition-opacity duration-1000 ${lit ? "opacity-90" : "opacity-0"}`}
                style={{ background: "radial-gradient(circle, #c9a84c, transparent 70%)" }}
              />
              <span className="relative size-20 rounded-full border border-[#c9a84c]/50 bg-black/40 flex items-center justify-center animate-golden-halo">
                <Icon className="size-8 text-[#f0d78c]" />
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.45em] text-[#c9a84c]">
              Pandacine · Golden Hour
            </p>
            <h1 className="font-serif italic text-3xl md:text-4xl text-[#f7ecd2] mt-2 leading-tight">
              {annivTitle(day)}
            </h1>
            <p className="text-xs text-[#e6d3a8]/70 mt-1">
              with {partnerName} · {together.toLocaleString()} days
            </p>
          </div>

          {/* Act card */}
          <div
            key={act}
            className="relative rounded-[28px] border border-[#c9a84c]/30 bg-gradient-to-b from-[#1a1109]/95 to-[#120b07]/95 p-7 shadow-[0_50px_140px_-50px_rgba(201,168,76,0.6)] animate-golden-act"
          >
            <span aria-hidden className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#c9a84c] mb-3">{current.eyebrow}</p>
            <h2 className="font-serif italic text-2xl text-[#f7ecd2] mb-3">{current.title}</h2>
            <p className="text-sm leading-relaxed text-[#e6d3a8]/80">{current.body}</p>

            {current.prompt && <GoldenPrompt {...current.prompt} />}

            {act === acts.length - 1 && <SealBlock dkey={dkey} />}

            <div className="mt-7 flex items-center justify-between gap-3">
              <button
                onClick={() => setAct((a) => Math.max(0, a - 1))}
                disabled={act === 0}
                className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.25em] text-[#e6d3a8]/60 disabled:opacity-25 hover:text-[#f0d78c] transition"
              >
                <ChevronLeft className="size-4" /> Back
              </button>
              <div className="flex items-center gap-1.5">
                {acts.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all ${i === act ? "w-6 bg-[#f0d78c]" : "w-1.5 bg-[#c9a84c]/35"}`}
                  />
                ))}
              </div>
              {act < acts.length - 1 ? (
                <button
                  onClick={() => setAct((a) => a + 1)}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-gradient-to-r from-[#c9a84c] to-[#f0d78c] text-[#1a1109] text-xs font-semibold uppercase tracking-[0.2em] hover:brightness-110 transition"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-gradient-to-r from-[#c9a84c] to-[#f0d78c] text-[#1a1109] text-xs font-semibold uppercase tracking-[0.2em] hover:brightness-110 transition"
                >
                  Enter the day
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-[10px] uppercase tracking-[0.35em] text-[#c9a84c]/50 mt-6">
            Since {day.anchor.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

function GoldenPrompt({ key: storageKey, label, placeholder }: { key: string; label: string; placeholder: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      setValue(localStorage.getItem(storageKey) ?? "");
    } catch {
      /* storage may be unavailable */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!value) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, value);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1400);
      } catch {
        /* ignore */
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [value, storageKey]);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#c9a84c]">{label}</p>
        {saved && <span className="text-[10px] text-[#f0d78c]/70">kept ✦</span>}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-black/40 border border-[#c9a84c]/25 focus:border-[#c9a84c]/60 outline-none px-4 py-3 text-sm text-[#f7ecd2] placeholder:text-[#e6d3a8]/30 resize-none"
      />
    </div>
  );
}

function SealBlock({ dkey }: { dkey: string }) {
  const storageKey = `pandacine.golden.${dkey}.sealed`;
  const [sealed, setSealed] = useState(false);

  useEffect(() => {
    try {
      setSealed(localStorage.getItem(storageKey) === "1");
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return (
    <div className="mt-6 flex flex-col items-center">
      <button
        onClick={() => {
          try {
            localStorage.setItem(storageKey, "1");
          } catch {
            /* ignore */
          }
          setSealed(true);
        }}
        className={`relative size-24 rounded-full border-2 border-[#c9a84c]/60 flex items-center justify-center transition-transform ${
          sealed ? "scale-100 animate-golden-seal" : "hover:scale-105 active:scale-95"
        }`}
        style={{
          background: "radial-gradient(circle at 35% 30%, #f0d78c, #b0862f 65%, #6d5119)",
          boxShadow: "0 20px 50px -18px rgba(201,168,76,0.8)",
        }}
        aria-label="Seal the day"
      >
        <Heart className="size-9 text-[#1a1109] fill-[#1a1109]/25" />
      </button>
      <p className="mt-3 text-xs text-[#e6d3a8]/70 italic font-serif">
        {sealed ? "Sealed — the day is yours." : "Press to seal"}
      </p>
    </div>
  );
}
