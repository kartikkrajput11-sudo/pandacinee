import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Moon, Feather, Film, Wine, Check } from "lucide-react";
import { annivTitle, daysTogetherFrom, todayKey, type AnnivDay } from "@/lib/anniversary-mode";

/**
 * AnniversaryWorld — a wholly separate interface that replaces the app for a day.
 * No cards, no rails, no bottom tab bar: four "rooms" on a night-sky stage,
 * moved through with an orbital dock. Nocturne palette (ink + gold + petal),
 * intentionally unlike every other surface in Pandacine.
 */

type RoomKey = "sky" | "letter" | "reel" | "toast";

const ROOMS: { key: RoomKey; label: string; Icon: typeof Moon }[] = [
  { key: "sky", label: "Tonight", Icon: Moon },
  { key: "letter", label: "Letter", Icon: Feather },
  { key: "reel", label: "The reel", Icon: Film },
  { key: "toast", label: "Toast", Icon: Wine },
];

function useLocal(key: string, initial = "") {
  const [v, setV] = useState(initial);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s !== null) setV(s);
    } catch {
      /* storage optional */
    }
  }, [key]);
  const set = (next: string) => {
    setV(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* ignore */
    }
  };
  return [v, set] as const;
}

export function AnniversaryWorld({
  day,
  partnerName,
  onClose,
  test,
}: {
  day: NonNullable<AnnivDay>;
  partnerName: string;
  onClose: () => void;
  test?: boolean;
}) {
  const [room, setRoom] = useState<RoomKey>("sky");
  const idx = ROOMS.findIndex((r) => r.key === room);
  const together = daysTogetherFrom(day.anchor);
  const dkey = todayKey();

  // Stars are stable for the session.
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        key: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 1 + Math.random() * 2.4,
        delay: Math.random() * 5,
        gold: i % 5 === 0,
      })),
    [],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-hidden text-[#f7ecd2] select-none">
      {/* Night stage */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, #2a1330 0%, #170a1d 45%, #0b0510 100%)",
        }}
      />
      <div aria-hidden className="absolute inset-0">
        {stars.map((s) => (
          <span
            key={s.key}
            className="absolute rounded-full animate-anniv-star"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              background: s.gold ? "#f0d78c" : "#fff",
              opacity: 0.7,
              boxShadow: s.gold ? "0 0 8px #c9a84c" : "0 0 6px rgba(255,255,255,0.6)",
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
        style={{
          background:
            "radial-gradient(80% 100% at 50% 120%, rgba(236,72,153,0.28), transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.42em] text-[#c9a84c]">
            {test ? "Preview · " : ""}Pandacine Nocturne
          </p>
          <p className="font-serif italic text-lg truncate">{annivTitle(day)}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Leave"
          className="size-9 rounded-full border border-[#c9a84c]/35 bg-white/5 flex items-center justify-center hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Rooms */}
      <main className="relative z-10 h-[calc(100%-190px)] mt-4 px-5 overflow-y-auto">
        <div key={room} className="animate-anniv-room max-w-xl mx-auto pb-8">
          {room === "sky" && <SkyRoom together={together} partnerName={partnerName} day={day} />}
          {room === "letter" && <LetterRoom dkey={dkey} partnerName={partnerName} />}
          {room === "reel" && <ReelRoom day={day} together={together} />}
          {room === "toast" && <ToastRoom dkey={dkey} partnerName={partnerName} />}
        </div>
      </main>

      {/* Orbital dock */}
      <nav className="absolute inset-x-0 bottom-0 z-20 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-5">
        <div className="mx-auto flex w-fit items-end gap-5 rounded-full border border-[#c9a84c]/25 bg-[#120716]/80 px-6 py-3 backdrop-blur-xl shadow-[0_30px_80px_-40px_rgba(201,168,76,0.9)]">
          {ROOMS.map((r, i) => {
            const active = r.key === room;
            return (
              <button
                key={r.key}
                onClick={() => setRoom(r.key)}
                className="flex flex-col items-center gap-1.5"
                aria-label={r.label}
              >
                <span
                  className={`grid place-items-center rounded-full border transition-all duration-300 ${
                    active
                      ? "size-12 border-[#f0d78c] bg-gradient-to-br from-[#c9a84c] to-[#f0d78c] text-[#170a1d] shadow-[0_0_28px_rgba(240,215,140,0.55)]"
                      : "size-9 border-white/15 bg-white/5 text-[#e6d3a8]/70"
                  }`}
                  style={{ transform: `translateY(${active ? -6 : 0}px)` }}
                >
                  <r.Icon className={active ? "size-5" : "size-4"} />
                </span>
                <span
                  className={`text-[9px] uppercase tracking-[0.22em] ${
                    active ? "text-[#f0d78c]" : "text-[#e6d3a8]/40"
                  }`}
                >
                  {r.label}
                </span>
                {i === idx && <span className="sr-only">current</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>,
    document.body,
  );
}

/* ---------------- Rooms ---------------- */

function SkyRoom({
  together,
  partnerName,
  day,
}: {
  together: number;
  partnerName: string;
  day: NonNullable<AnnivDay>;
}) {
  const digits = together.toLocaleString().split("");
  return (
    <section className="text-center pt-6">
      <div className="relative mx-auto mb-8 size-32">
        <span className="absolute inset-0 rounded-full bg-[#f0d78c]/25 blur-3xl animate-anniv-moon" />
        <span className="absolute inset-2 rounded-full bg-gradient-to-br from-[#f7ecd2] to-[#c9a84c] shadow-[inset_-14px_-10px_30px_rgba(23,10,29,0.55)]" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.4em] text-[#c9a84c] mb-3">Tonight only</p>
      <h1 className="font-serif italic text-4xl leading-tight mb-5">
        You & {partnerName}
      </h1>
      <div className="flex justify-center gap-1.5 mb-3">
        {digits.map((d, i) => (
          <span
            key={i}
            className="animate-anniv-digit rounded-xl border border-[#c9a84c]/30 bg-white/5 px-3 py-2 font-serif text-2xl tabular-nums"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            {d}
          </span>
        ))}
      </div>
      <p className="text-xs uppercase tracking-[0.32em] text-[#e6d3a8]/60 mb-8">days together</p>
      <p className="text-sm text-[#e6d3a8]/75 leading-relaxed">
        Everything else in Pandacine is closed for the night. Move through the rooms below —
        write a letter, walk the reel, and end with a toast.
      </p>
      <p className="mt-6 text-[10px] uppercase tracking-[0.28em] text-[#c9a84c]/70">
        since{" "}
        {day.anchor.toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </section>
  );
}

function LetterRoom({ dkey, partnerName }: { dkey: string; partnerName: string }) {
  const [text, setText] = useLocal(`pandacine.nocturne.${dkey}.letter`);
  const [sealed, setSealed] = useLocal(`pandacine.nocturne.${dkey}.letter.sealed`, "");
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <section className="pt-4">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[#c9a84c] mb-2">Room II</p>
      <h2 className="font-serif italic text-3xl mb-4">A letter for {partnerName}</h2>
      {sealed === "1" ? (
        <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#1a0f20]/70 p-6">
          <p className="whitespace-pre-wrap font-serif italic text-[15px] leading-relaxed text-[#f7ecd2]/90">
            {text || "…"}
          </p>
          <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#c9a84c]">
            <Check className="size-3.5" /> sealed tonight
          </div>
        </div>
      ) : (
        <>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder={`Tonight I want ${partnerName} to know…`}
            className="w-full rounded-3xl border border-[#c9a84c]/25 bg-[#1a0f20]/70 p-5 font-serif italic text-[15px] leading-relaxed placeholder:text-[#e6d3a8]/30 outline-none focus:border-[#f0d78c]/60"
          />
          <button
            disabled={!text.trim()}
            onClick={() => setSealed("1")}
            className="mt-4 w-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#f0d78c] py-3 text-sm font-semibold tracking-wide text-[#170a1d] disabled:opacity-40"
          >
            Seal the letter
          </button>
        </>
      )}
    </section>
  );
}

function ReelRoom({ day, together }: { day: NonNullable<AnnivDay>; together: number }) {
  const chapters = useMemo(() => {
    const marks = [1, 7, 30, 100, 200, 365, 500, 730, 1000].filter((m) => m <= together);
    return marks.map((m) => ({
      days: m,
      date: new Date(day.anchor.getTime() + m * 86400000),
    }));
  }, [day.anchor, together]);

  return (
    <section className="pt-4">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[#c9a84c] mb-2">Room III</p>
      <h2 className="font-serif italic text-3xl mb-6">The reel so far</h2>
      <ol className="relative border-l border-[#c9a84c]/25 pl-6 space-y-6">
        {chapters.map((c, i) => (
          <li key={c.days} className="animate-anniv-room" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#f0d78c] shadow-[0_0_14px_rgba(240,215,140,0.7)]" />
            <p className="font-serif italic text-xl">
              {c.days === 1 ? "Day one" : `${c.days.toLocaleString()} days`}
            </p>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#e6d3a8]/50">
              {c.date.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </li>
        ))}
        <li>
          <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full bg-[#ec4899] shadow-[0_0_14px_rgba(236,72,153,0.8)]" />
          <p className="font-serif italic text-xl">Tonight</p>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#e6d3a8]/50">
            {together.toLocaleString()} days · still going
          </p>
        </li>
      </ol>
    </section>
  );
}

function ToastRoom({ dkey, partnerName }: { dkey: string; partnerName: string }) {
  const [done, setDone] = useLocal(`pandacine.nocturne.${dkey}.toast`, "");
  const [clink, setClink] = useState(false);

  const raise = () => {
    setClink(true);
    window.setTimeout(() => {
      setDone("1");
      setClink(false);
    }, 1200);
  };

  return (
    <section className="pt-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[#c9a84c] mb-2">Room IV</p>
      <h2 className="font-serif italic text-3xl mb-8">Raise a glass</h2>
      <div className="relative mx-auto mb-10 flex h-40 w-56 items-end justify-center">
        <span
          className={`absolute bottom-0 left-6 text-6xl ${clink ? "animate-anniv-clink-l" : ""}`}
        >
          🥂
        </span>
        <span
          className={`absolute bottom-0 right-6 text-6xl scale-x-[-1] ${clink ? "animate-anniv-clink-r" : ""}`}
        >
          🥂
        </span>
        {clink && (
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-2xl animate-anniv-digit">
            ✨
          </span>
        )}
      </div>
      {done === "1" ? (
        <p className="font-serif italic text-lg text-[#f0d78c]">
          Toasted. To you and {partnerName} — and to the next chapter.
        </p>
      ) : (
        <>
          <p className="mb-6 text-sm text-[#e6d3a8]/75">
            One tap, and tonight is officially on the record.
          </p>
          <button
            onClick={raise}
            className="rounded-full bg-gradient-to-r from-[#ec4899] to-[#f0d78c] px-10 py-3.5 text-sm font-semibold tracking-wide text-[#170a1d]"
          >
            To us
          </button>
        </>
      )}
    </section>
  );
}
