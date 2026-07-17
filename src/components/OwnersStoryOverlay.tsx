import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import ch1 from "@/assets/story/ch1.png";
import ch2 from "@/assets/story/ch2.png";
import ch3 from "@/assets/story/ch3.png";
import ch4 from "@/assets/story/ch4.png";
import ch5 from "@/assets/story/ch5.png";
import ch6 from "@/assets/story/ch6.png";
import ch7 from "@/assets/story/ch7.png";
import ch8 from "@/assets/story/ch8.png";
import ch9 from "@/assets/story/ch9.png";
import ch10 from "@/assets/story/ch10.png";
import ch11 from "@/assets/story/ch11.png";
import ch12 from "@/assets/story/ch12.png";
import ch13 from "@/assets/story/ch13.png";

const CHAPTER_ART = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, ch10, ch11, ch12, ch13];

// Slide-based cinematic retelling: one chapter at a time, with big stickers
// and entrance animations. Auto-advance plays through like a picture book.

type Chapter = {
  act: "I" | "II" | "III" | "IV";
  numeral: string;
  kicker: string;
  title: string;
  body: string;
  sticker: string;
};

const ACTS: Record<Chapter["act"], { label: string; subtitle: string; sticker: string }> = {
  I:   { label: "Act I",   subtitle: "Her, before him",              sticker: "🥀" },
  II:  { label: "Act II",  subtitle: "Him, before her",              sticker: "🕯️" },
  III: { label: "Act III", subtitle: "The night the world softened", sticker: "🌙" },
  IV:  { label: "Act IV",  subtitle: "Panda, and everything after",  sticker: "🐼" },
};

const CHAPTERS: Chapter[] = [
  { act: "I",   numeral: "I",    kicker: "Her Story",         title: "A love that gave too much",       body: "Before him, there was a boy she loved with everything she had. He cheated, and she forgave. He cheated again, and she still chose him over herself. Love, for her, meant staying — even when staying hurt.", sticker: "🥀" },
  { act: "I",   numeral: "II",   kicker: "Her Story",         title: "The classroom that broke her",    body: "The lies grew louder until she walked into her own classroom and saw him with another girl. Something inside her cracked that day. She finally said the word she never thought she could say: enough.", sticker: "💔" },
  { act: "I",   numeral: "III",  kicker: "Her Story",         title: "Broken, but still soft",          body: "She left him, but her heart didn't know how to stop loving. He moved on — publicly — yet still stalked her shadow, controlled her silence, and turned her nights into long, quiet oceans of crying.", sticker: "🌧️" },
  { act: "II",  numeral: "IV",   kicker: "His Story",         title: "A love that kept lying",          body: "On the other side of the world, he was loving a girl who was always somewhere else — texting other boys, deleting chats the moment he reached for her phone. He kept choosing to trust; she kept choosing to hide.", sticker: "📱" },
  { act: "II",  numeral: "V",    kicker: "His Story",         title: "Betrayed twice in one blow",      body: "The truth arrived brutally: she had cheated on him with his own best friend. In one night he lost the girl he defended and the brother he trusted. Two betrayals wearing the same face.", sticker: "🗡️" },
  { act: "II",  numeral: "VI",   kicker: "His Story",         title: "Alone with his family's sting",   body: "His family — who had warned him — turned their worry into words that cut: 'you chose her over us, and look what she did.' He cried through nights no one heard, and slowly stopped believing anyone up there was still listening.", sticker: "🕯️" },
  { act: "III", numeral: "VII",  kicker: "Fate",              title: "A friend between two silences",   body: "In the middle of both their sadness, the universe sent a quiet messenger — a mutual friend, his from society, hers from school. One introduction, one small hello, and two lonely worlds brushed against each other for the first time.", sticker: "🧵" },
  { act: "III", numeral: "VIII", kicker: "Fate",              title: "The nights that healed them",     body: "They started talking. One night became many. Hours turned into sunrises. For the first time in a long while, both of them laughed at 3 a.m. instead of crying. Happiness, softly, came back — brighter than anything they'd ever known before.", sticker: "🌙" },
  { act: "III", numeral: "IX",   kicker: "Fate",              title: "He believed again",               body: "Somewhere along those endless conversations, he started believing in God again — because how else could someone so gentle, so exactly right, be sent to him after everything? She felt like a gift wrapped by the sky itself.", sticker: "✨" },
  { act: "III", numeral: "X",    kicker: "Fate",              title: "She saw their forever",           body: "And she — she started seeing pictures of a future only the two of them lived in. A home, a life, small ordinary mornings. She wasn't dreaming anymore; she was remembering something that hadn't happened yet.", sticker: "🔮" },
  { act: "IV",  numeral: "XI",   kicker: "18 · April · 2026", title: "The day they said yes",           body: "On 18 April 2026, they stopped being two healing souls and became one quiet promise. He gave her a name only he was allowed to use — panda. That single word would one day name a whole little world.", sticker: "💍" },
  { act: "IV",  numeral: "XII",  kicker: "Pandacine",         title: "A home for couples like them",    body: "He wanted a place where couples — especially the long-distance ones, the healing ones, the ones rebuilding — could chat, play, watch, and love without the miles in the way. So he built it. This site. Pandacine. Named after her.", sticker: "🐼" },
  { act: "IV",  numeral: "XIII", kicker: "Every 18th, forever", title: "The world lights up for them", body: "And that is why every 18th of every month, Pandacine wears gold — a small, quiet celebration of the two people whose story became the reason this place exists at all.", sticker: "💛" },
];

const GOLD = "#e6c98a";
const GOLD_DEEP = "#b98a3d";

// Slides = cover + one per chapter + colophon
type Slide =
  | { kind: "cover" }
  | { kind: "act"; act: Chapter["act"] }
  | { kind: "chapter"; idx: number }
  | { kind: "end" };

function buildSlides(): Slide[] {
  const slides: Slide[] = [{ kind: "cover" }];
  let lastAct: Chapter["act"] | null = null;
  CHAPTERS.forEach((c, idx) => {
    if (c.act !== lastAct) {
      slides.push({ kind: "act", act: c.act });
      lastAct = c.act;
    }
    slides.push({ kind: "chapter", idx });
  });
  slides.push({ kind: "end" });
  return slides;
}

export default function OwnersStoryOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const slides = useMemo(buildSlides, []);
  const [i, setI] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setI(0);
    setAutoPlay(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const next = useCallback(() => setI((v) => Math.min(slides.length - 1, v + 1)), [slides.length]);
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  // Auto-advance
  useEffect(() => {
    if (!open || !autoPlay) return;
    const current = slides[i];
    const dwell =
      current.kind === "cover" ? 3800 :
      current.kind === "act"   ? 3200 :
      current.kind === "end"   ? 5000 :
      6500; // chapter
    timerRef.current = window.setTimeout(() => {
      if (i >= slides.length - 1) { setAutoPlay(false); return; }
      setI((v) => v + 1);
    }, dwell);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [autoPlay, i, open, slides]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { prev(); }
      else if (e.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, onClose]);

  if (!open) return null;

  const current = slides[i];
  const progress = (i + 1) / slides.length;

  return (
    <div
      className="fixed inset-0 z-[110]"
      style={{
        background: "radial-gradient(ellipse at 50% -10%, #17101c 0%, #0a060e 55%, #060309 100%)",
        ["--gold" as any]: GOLD,
      } as React.CSSProperties}
    >
      <style>{`
        @keyframes slide-in-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sticker-pop {
          0%   { opacity: 0; transform: scale(0.5) rotate(-15deg); }
          60%  { opacity: 1; transform: scale(1.15) rotate(6deg); }
          100% { opacity: 1; transform: scale(1) rotate(-3deg); }
        }
        @keyframes sticker-drift {
          0%,100% { transform: translateY(0) rotate(-3deg); }
          50%     { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes drop-cap-in {
          from { opacity: 0; transform: translateY(8px) scale(0.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cover-breathe {
          0%,100% { transform: scale(1);    filter: drop-shadow(0 0 20px rgba(230,201,138,0.35)); }
          50%     { transform: scale(1.03); filter: drop-shadow(0 0 32px rgba(230,201,138,0.55)); }
        }
        .slide-enter    { animation: slide-in-up 700ms cubic-bezier(.2,.7,.2,1) both; }
        .slide-enter-2  { animation: slide-in-up 700ms 120ms cubic-bezier(.2,.7,.2,1) both; }
        .slide-enter-3  { animation: slide-in-up 700ms 220ms cubic-bezier(.2,.7,.2,1) both; }
        .slide-enter-4  { animation: slide-in-up 700ms 340ms cubic-bezier(.2,.7,.2,1) both; }
        .sticker-hero   { animation: sticker-pop 900ms cubic-bezier(.2,.9,.2,1.4) both, sticker-drift 5.5s 1s ease-in-out infinite; }
        .drop-cap-anim  { display: inline-block; animation: drop-cap-in 900ms 400ms both cubic-bezier(.2,.9,.2,1.2); }
        .cover-monogram { animation: cover-breathe 6s ease-in-out infinite; }
      `}</style>

      {/* paper grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close story"
        className="fixed top-5 right-5 z-30 size-11 rounded-full flex items-center justify-center transition-transform hover:scale-105"
        style={{
          background: "rgba(15,10,20,0.8)",
          border: `1px solid ${GOLD}55`,
          backdropFilter: "blur(10px)",
          color: GOLD,
          boxShadow: `0 8px 32px -12px ${GOLD}44`,
        }}
      >
        <X className="size-4" />
      </button>

      {/* Auto-play toggle */}
      <button
        onClick={() => setAutoPlay((v) => !v)}
        aria-label={autoPlay ? "Pause" : "Play story"}
        className="fixed top-5 left-5 z-30 h-11 pl-3 pr-4 rounded-full flex items-center gap-2 transition-transform hover:scale-[1.03]"
        style={{
          background: autoPlay
            ? "linear-gradient(180deg, #f7e2ad 0%, #e6c98a 45%, #b98a3d 100%)"
            : "rgba(15,10,20,0.8)",
          border: `1px solid ${GOLD}55`,
          backdropFilter: "blur(10px)",
          color: autoPlay ? "#1a0f0a" : GOLD,
          boxShadow: `0 8px 32px -12px ${GOLD}55`,
        }}
      >
        {autoPlay ? <Pause className="size-4" /> : <Play className="size-4" />}
        <span className="text-[10px] tracking-[0.35em] uppercase font-serif italic">
          {autoPlay ? "Playing" : "Play story"}
        </span>
      </button>

      {/* Top progress */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-20" style={{ background: `${GOLD}22` }}>
        <div
          className="h-full transition-[width] duration-500"
          style={{
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${GOLD}, ${GOLD_DEEP}, ${GOLD})`,
            boxShadow: `0 0 12px ${GOLD}88`,
          }}
        />
      </div>

      {/* Stage */}
      <div className="absolute inset-0 flex items-center justify-center px-6 sm:px-10">
        <div key={i} className="w-full max-w-[640px] max-h-full overflow-y-auto py-16 sm:py-20">
          {current.kind === "cover" && <CoverSlide />}
          {current.kind === "act" && <ActSlide act={current.act} />}
          {current.kind === "chapter" && <ChapterSlide c={CHAPTERS[current.idx]} art={CHAPTER_ART[current.idx]} />}
          {current.kind === "end" && <EndSlide onClose={onClose} />}
        </div>
      </div>

      {/* Prev / Next */}
      {i > 0 && (
        <button
          onClick={prev}
          aria-label="Previous"
          className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 size-12 rounded-full flex items-center justify-center transition-transform hover:scale-105"
          style={{
            background: "rgba(15,10,20,0.8)",
            border: `1px solid ${GOLD}44`,
            backdropFilter: "blur(10px)",
            color: GOLD,
          }}
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {i < slides.length - 1 && (
        <button
          onClick={next}
          aria-label="Next"
          className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 size-12 rounded-full flex items-center justify-center transition-transform hover:scale-105"
          style={{
            background: "linear-gradient(180deg, #f7e2ad 0%, #e6c98a 45%, #b98a3d 100%)",
            border: `1px solid ${GOLD}88`,
            color: "#1a0f0a",
            boxShadow: `0 10px 30px -12px ${GOLD}88`,
          }}
        >
          <ChevronRight className="size-5" />
        </button>
      )}

      {/* Slide counter */}
      <div
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full text-[10px] tracking-[0.4em] font-serif italic"
        style={{
          background: "rgba(15,10,20,0.7)",
          border: `1px solid ${GOLD}33`,
          color: `${GOLD}cc`,
          backdropFilter: "blur(10px)",
        }}
      >
        {String(i + 1).padStart(2, "0")} <span style={{ color: `${GOLD}55` }}>/</span> {String(slides.length).padStart(2, "0")}
      </div>
    </div>
  );
}

/* ─────────────────── Slide components ─────────────────── */

function CoverSlide() {
  return (
    <section className="text-center">
      <p className="slide-enter text-[10px] tracking-[0.6em] mb-8" style={{ color: GOLD }}>
        P · A · N · D · A · C · I · N · E
      </p>
      <div className="relative mx-auto w-40 h-40 mb-8 cover-monogram slide-enter-2">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f7e2ad" />
              <stop offset="50%" stopColor={GOLD} />
              <stop offset="100%" stopColor={GOLD_DEEP} />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="88" fill="none" stroke="url(#gold-grad)" strokeWidth="0.8" opacity="0.6" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="url(#gold-grad)" strokeWidth="0.4" opacity="0.4" />
          <text x="100" y="122" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="80" fill="url(#gold-grad)">&amp;</text>
        </svg>
      </div>
      <p className="slide-enter-2 text-[9px] tracking-[0.5em] mb-4" style={{ color: `${GOLD}cc` }}>
        A PRIVATE CHAPBOOK
      </p>
      <h1
        className="slide-enter-3 font-serif italic leading-[0.95] text-candle"
        style={{ fontSize: "clamp(3rem, 9vw, 4.75rem)", textShadow: "0 2px 20px rgba(230,201,138,0.15)" }}
      >
        How they
        <br />
        <span style={{ color: GOLD }}>met</span>
      </h1>
      <p className="slide-enter-4 mt-6 text-sm text-candle/70 font-serif italic leading-relaxed max-w-sm mx-auto">
        The story of two people the world nearly broke — and the quiet miracle of finding each other anyway.
      </p>
      <p className="slide-enter-4 mt-10 text-[10px] tracking-[0.4em] uppercase font-serif italic" style={{ color: `${GOLD}88` }}>
        Tap → to begin
      </p>
    </section>
  );
}

function ActSlide({ act }: { act: Chapter["act"] }) {
  const a = ACTS[act];
  return (
    <section className="text-center">
      <div className="slide-enter text-[90px] sm:text-[110px] leading-none sticker-hero inline-block">
        {a.sticker}
      </div>
      <div
        className="slide-enter-2 mt-10 inline-flex flex-col items-center gap-3 px-8 py-6 rounded-sm"
        style={{ borderTop: `1px solid ${GOLD}55`, borderBottom: `1px solid ${GOLD}55` }}
      >
        <p className="text-[10px] tracking-[0.55em]" style={{ color: GOLD }}>{a.label}</p>
        <h2 className="font-serif italic text-2xl sm:text-3xl text-candle">{a.subtitle}</h2>
      </div>
    </section>
  );
}

function ChapterSlide({ c }: { c: Chapter }) {
  const first = c.body.charAt(0);
  const rest = c.body.slice(1);
  return (
    <article className="relative">
      {/* Hero sticker */}
      <div className="text-center mb-8">
        <div
          className="sticker-hero inline-block text-[76px] sm:text-[92px] leading-none select-none"
          style={{
            padding: "16px 22px",
            borderRadius: "26px",
            background: "linear-gradient(180deg, rgba(30,20,35,0.7), rgba(15,10,20,0.9))",
            border: `1px solid ${GOLD}44`,
            boxShadow: `0 30px 70px -20px ${GOLD}66, inset 0 1px 0 rgba(255,255,255,0.06)`,
          }}
          aria-hidden
        >
          {c.sticker}
        </div>
      </div>

      {/* Chapter marker */}
      <div className="slide-enter-2 flex items-baseline gap-4 mb-4">
        <span
          className="font-serif italic text-xl leading-none"
          style={{ color: GOLD, textShadow: "0 0 18px rgba(230,201,138,0.35)" }}
        >
          {c.numeral}
        </span>
        <span className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${GOLD}66, transparent)` }} />
        <span className="text-[9px] tracking-[0.4em] uppercase" style={{ color: `${GOLD}aa` }}>
          {c.kicker}
        </span>
      </div>

      <h3
        className="slide-enter-2 font-serif italic text-candle leading-tight mb-5"
        style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.1rem)" }}
      >
        {c.title}
      </h3>

      <p className="slide-enter-3 font-serif text-[15px] sm:text-base leading-[1.85] text-candle/85">
        <span
          className="drop-cap-anim float-left font-serif italic mr-2 mt-1 leading-[0.85]"
          style={{ fontSize: "3.4rem", color: GOLD, textShadow: "0 2px 14px rgba(230,201,138,0.25)" }}
        >
          {first}
        </span>
        {rest}
      </p>
    </article>
  );
}

function EndSlide({ onClose }: { onClose: () => void }) {
  return (
    <section className="text-center">
      <div className="slide-enter flex items-center justify-center gap-3 my-6 select-none">
        <span className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${GOLD}bb)` }} />
        <span className="text-[10px] tracking-[0.5em]" style={{ color: GOLD, textShadow: "0 0 12px rgba(230,201,138,0.35)" }}>✦</span>
        <span className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${GOLD}bb)` }} />
      </div>
      <p
        className="slide-enter-2 font-serif italic text-candle/90 leading-relaxed"
        style={{ fontSize: "clamp(1.15rem, 3.5vw, 1.4rem)" }}
      >
        And every 18th since,
        <br />
        the world stops for a breath
        <br />
        to remember them.
      </p>
      <div className="slide-enter-3 mt-10 flex flex-col items-center gap-3">
        <span className="text-[9px] tracking-[0.55em]" style={{ color: GOLD }}>WITH LOVE, ALWAYS</span>
        <button
          onClick={onClose}
          className="mt-2 px-10 py-3.5 rounded-full font-serif italic text-[13px] transition-transform hover:scale-[1.02]"
          style={{
            background: "linear-gradient(180deg, #f7e2ad 0%, #e6c98a 45%, #b98a3d 100%)",
            color: "#1a0f0a",
            boxShadow: "0 10px 40px -12px rgba(230,201,138,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
          }}
        >
          Close the book
        </button>
      </div>
      <p className="slide-enter-4 mt-14 text-[9px] tracking-[0.6em]" style={{ color: `${GOLD}77` }}>—  FIN  —</p>
    </section>
  );
}
