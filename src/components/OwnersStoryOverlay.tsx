import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

// A private, editorial-grade retelling of the owners' story.
// Designed like a rare gilded chapbook: monogram cover, roman-numeral chapters,
// drop caps, hairline gold rules, act divisions. Calm background, no distractions.

type Chapter = {
  act: "I" | "II" | "III" | "IV";
  numeral: string;
  kicker: string;
  title: string;
  body: string;
};

const ACTS: Record<Chapter["act"], { label: string; subtitle: string }> = {
  I: { label: "Act I", subtitle: "Her, before him" },
  II: { label: "Act II", subtitle: "Him, before her" },
  III: { label: "Act III", subtitle: "The night the world softened" },
  IV: { label: "Act IV", subtitle: "Panda, and everything after" },
};

const CHAPTERS: Chapter[] = [
  {
    act: "I",
    numeral: "I",
    kicker: "Her Story",
    title: "A love that gave too much",
    body: "Before him, there was a boy she loved with everything she had. He cheated, and she forgave. He cheated again, and she still chose him over herself. Love, for her, meant staying — even when staying hurt.",
  },
  {
    act: "I",
    numeral: "II",
    kicker: "Her Story",
    title: "The classroom that broke her",
    body: "The lies grew louder until she walked into her own classroom and saw him with another girl. Something inside her cracked that day. She finally said the word she never thought she could say: enough.",
  },
  {
    act: "I",
    numeral: "III",
    kicker: "Her Story",
    title: "Broken, but still soft",
    body: "She left him, but her heart didn't know how to stop loving. He moved on — publicly — yet still stalked her shadow, controlled her silence, and turned her nights into long, quiet oceans of crying.",
  },
  {
    act: "II",
    numeral: "IV",
    kicker: "His Story",
    title: "A love that kept lying",
    body: "On the other side of the world, he was loving a girl who was always somewhere else — texting other boys, deleting chats the moment he reached for her phone. He kept choosing to trust; she kept choosing to hide.",
  },
  {
    act: "II",
    numeral: "V",
    kicker: "His Story",
    title: "Betrayed twice in one blow",
    body: "The truth arrived brutally: she had cheated on him with his own best friend. In one night he lost the girl he defended and the brother he trusted. Two betrayals wearing the same face.",
  },
  {
    act: "II",
    numeral: "VI",
    kicker: "His Story",
    title: "Alone with his family's sting",
    body: "His family — who had warned him — turned their worry into words that cut: 'you chose her over us, and look what she did.' He cried through nights no one heard, and slowly stopped believing anyone up there was still listening.",
  },
  {
    act: "III",
    numeral: "VII",
    kicker: "Fate",
    title: "A friend between two silences",
    body: "In the middle of both their sadness, the universe sent a quiet messenger — a mutual friend, his from society, hers from school. One introduction, one small hello, and two lonely worlds brushed against each other for the first time.",
  },
  {
    act: "III",
    numeral: "VIII",
    kicker: "Fate",
    title: "The nights that healed them",
    body: "They started talking. One night became many. Hours turned into sunrises. For the first time in a long while, both of them laughed at 3 a.m. instead of crying. Happiness, softly, came back — brighter than anything they'd ever known before.",
  },
  {
    act: "III",
    numeral: "IX",
    kicker: "Fate",
    title: "He believed again",
    body: "Somewhere along those endless conversations, he started believing in God again — because how else could someone so gentle, so exactly right, be sent to him after everything? She felt like a gift wrapped by the sky itself.",
  },
  {
    act: "III",
    numeral: "X",
    kicker: "Fate",
    title: "She saw their forever",
    body: "And she — she started seeing pictures of a future only the two of them lived in. A home, a life, small ordinary mornings. She wasn't dreaming anymore; she was remembering something that hadn't happened yet.",
  },
  {
    act: "IV",
    numeral: "XI",
    kicker: "18 · April · 2026",
    title: "The day they said yes",
    body: "On 18 April 2026, they stopped being two healing souls and became one quiet promise. He gave her a name only he was allowed to use — panda. That single word would one day name a whole little world.",
  },
  {
    act: "IV",
    numeral: "XII",
    kicker: "Pandacine",
    title: "A home for couples like them",
    body: "He wanted a place where couples — especially the long-distance ones, the healing ones, the ones rebuilding — could chat, play, watch, and love without the miles in the way. So he built it. This site. Pandacine. Named after her.",
  },
  {
    act: "IV",
    numeral: "XIII",
    kicker: "Every 18th, forever",
    title: "The world lights up for them",
    body: "And that is why every 18th of every month, Pandacine wears gold — a small, quiet celebration of the two people whose story became the reason this place exists at all.",
  },
];

const GOLD = "#e6c98a";
const GOLD_DEEP = "#b98a3d";

function OrnamentRule() {
  return (
    <div className="flex items-center justify-center gap-3 my-6 select-none">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-[color:var(--gold)]/70" />
      <span
        className="text-[color:var(--gold)] text-[10px] tracking-[0.5em]"
        style={{ textShadow: "0 0 12px rgba(230,201,138,0.35)" }}
      >
        ✦
      </span>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-[color:var(--gold)]/70" />
    </div>
  );
}

export default function OwnersStoryOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<Chapter["act"], Chapter[]>();
    for (const c of CHAPTERS) {
      if (!map.has(c.act)) map.set(c.act, []);
      map.get(c.act)!.push(c);
    }
    return Array.from(map.entries());
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto"
      style={
        {
          background:
            "radial-gradient(ellipse at 50% -10%, #17101c 0%, #0a060e 55%, #060309 100%)",
          ["--gold" as any]: GOLD,
        } as React.CSSProperties
      }
    >
      {/* subtle paper grain */}
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
        className="fixed top-5 right-5 z-10 size-11 rounded-full flex items-center justify-center transition-transform hover:scale-105"
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

      <div className="relative max-w-[640px] mx-auto px-6 sm:px-10 py-16 sm:py-24">
        {/* ── COVER ────────────────────────────────────────────────── */}
        <section className="text-center animate-fade-in">
          <p
            className="text-[10px] tracking-[0.6em] mb-8"
            style={{ color: GOLD }}
          >
            P · A · N · D · A · C · I · N · E
          </p>

          {/* Monogram */}
          <div className="relative mx-auto w-40 h-40 mb-8">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <defs>
                <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f7e2ad" />
                  <stop offset="50%" stopColor={GOLD} />
                  <stop offset="100%" stopColor={GOLD_DEEP} />
                </linearGradient>
                <filter id="soft-glow">
                  <feGaussianBlur stdDeviation="2.5" />
                </filter>
              </defs>
              {/* outer ring */}
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="url(#gold-grad)"
                strokeWidth="0.8"
                opacity="0.6"
              />
              <circle
                cx="100"
                cy="100"
                r="82"
                fill="none"
                stroke="url(#gold-grad)"
                strokeWidth="0.4"
                opacity="0.4"
              />
              {/* laurel-like flourishes */}
              <g
                stroke="url(#gold-grad)"
                strokeWidth="0.7"
                fill="none"
                opacity="0.75"
              >
                <path d="M100 30 Q80 45 78 70" />
                <path d="M100 30 Q120 45 122 70" />
                <path d="M100 170 Q80 155 78 130" />
                <path d="M100 170 Q120 155 122 130" />
                <path d="M85 62 l -6 -3 M92 55 l -5 -5 M100 50 l 0 -6" />
                <path d="M115 62 l 6 -3 M108 55 l 5 -5" />
              </g>
              {/* interlaced initials */}
              <text
                x="100"
                y="118"
                textAnchor="middle"
                fontFamily="Georgia, 'Times New Roman', serif"
                fontStyle="italic"
                fontSize="72"
                fill="url(#gold-grad)"
                filter="url(#soft-glow)"
                opacity="0.35"
              >
                &amp;
              </text>
              <text
                x="100"
                y="118"
                textAnchor="middle"
                fontFamily="Georgia, 'Times New Roman', serif"
                fontStyle="italic"
                fontSize="72"
                fill="url(#gold-grad)"
              >
                &amp;
              </text>
              {/* tiny hearts on axis */}
              <text
                x="100"
                y="22"
                textAnchor="middle"
                fontSize="10"
                fill={GOLD}
              >
                ✦
              </text>
              <text
                x="100"
                y="190"
                textAnchor="middle"
                fontSize="10"
                fill={GOLD}
              >
                ✦
              </text>
            </svg>
          </div>

          <p
            className="text-[9px] tracking-[0.5em] mb-4"
            style={{ color: `${GOLD}cc` }}
          >
            A PRIVATE CHAPBOOK
          </p>
          <h1
            className="font-serif italic leading-[0.95] text-candle"
            style={{
              fontSize: "clamp(3rem, 9vw, 4.75rem)",
              textShadow: "0 2px 20px rgba(230,201,138,0.15)",
            }}
          >
            How they
            <br />
            <span style={{ color: GOLD }}>met</span>
          </h1>

          <p className="mt-6 text-sm text-candle/70 font-serif italic leading-relaxed max-w-sm mx-auto">
            The story of two people the world nearly broke — and the quiet
            miracle of finding each other anyway.
          </p>

          <OrnamentRule />

          <p
            className="text-[10px] tracking-[0.4em] uppercase"
            style={{ color: `${GOLD}aa` }}
          >
            Thirteen chapters · Four acts
          </p>
        </section>

        {/* ── ACTS ─────────────────────────────────────────────────── */}
        {grouped.map(([actKey, chapters], actIndex) => (
          <section key={actKey} className="mt-24">
            {/* Act header */}
            <div className="text-center mb-14 animate-fade-in">
              <div
                className="inline-flex flex-col items-center gap-2 px-8 py-5 rounded-sm"
                style={{
                  borderTop: `1px solid ${GOLD}55`,
                  borderBottom: `1px solid ${GOLD}55`,
                }}
              >
                <p
                  className="text-[10px] tracking-[0.55em]"
                  style={{ color: GOLD }}
                >
                  {ACTS[actKey].label}
                </p>
                <h2 className="font-serif italic text-2xl sm:text-3xl text-candle">
                  {ACTS[actKey].subtitle}
                </h2>
              </div>
            </div>

            {/* Chapters */}
            <div className="space-y-16">
              {chapters.map((c, i) => {
                const first = c.body.charAt(0);
                const rest = c.body.slice(1);
                return (
                  <article
                    key={c.numeral}
                    className="relative animate-fade-in"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    {/* Chapter marker */}
                    <div className="flex items-baseline gap-4 mb-4">
                      <span
                        className="font-serif italic text-xl leading-none"
                        style={{
                          color: GOLD,
                          textShadow: "0 0 18px rgba(230,201,138,0.35)",
                        }}
                      >
                        {c.numeral}
                      </span>
                      <span
                        className="flex-1 h-px"
                        style={{
                          background: `linear-gradient(to right, ${GOLD}66, transparent)`,
                        }}
                      />
                      <span
                        className="text-[9px] tracking-[0.4em] uppercase"
                        style={{ color: `${GOLD}aa` }}
                      >
                        {c.kicker}
                      </span>
                    </div>

                    <h3
                      className="font-serif italic text-candle leading-tight mb-5"
                      style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.1rem)" }}
                    >
                      {c.title}
                    </h3>

                    <p className="font-serif text-[15px] sm:text-base leading-[1.85] text-candle/85">
                      <span
                        className="float-left font-serif italic mr-2 mt-1 leading-[0.85]"
                        style={{
                          fontSize: "3.4rem",
                          color: GOLD,
                          textShadow: "0 2px 14px rgba(230,201,138,0.25)",
                        }}
                      >
                        {first}
                      </span>
                      {rest}
                    </p>

                    {/* Section-end mark for last chapter in act */}
                    {i === chapters.length - 1 && actIndex !== grouped.length - 1 && (
                      <div className="mt-10 text-center">
                        <span
                          className="text-[10px] tracking-[0.5em]"
                          style={{ color: `${GOLD}88` }}
                        >
                          ✦ ✦ ✦
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {/* ── COLOPHON ─────────────────────────────────────────────── */}
        <section className="mt-24 text-center animate-fade-in">
          <OrnamentRule />
          <p
            className="font-serif italic text-candle/90 leading-relaxed"
            style={{ fontSize: "clamp(1.15rem, 3.5vw, 1.4rem)" }}
          >
            And every 18th since,
            <br />
            the world stops for a breath
            <br />
            to remember them.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <span
              className="text-[9px] tracking-[0.55em]"
              style={{ color: GOLD }}
            >
              WITH LOVE, ALWAYS
            </span>
            <button
              onClick={onClose}
              className="mt-2 px-10 py-3.5 rounded-full font-serif italic text-[13px] transition-transform hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(180deg, #f7e2ad 0%, #e6c98a 45%, #b98a3d 100%)",
                color: "#1a0f0a",
                boxShadow:
                  "0 10px 40px -12px rgba(230,201,138,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
            >
              Close the book
            </button>
          </div>

          <p
            className="mt-14 text-[9px] tracking-[0.6em]"
            style={{ color: `${GOLD}77` }}
          >
            —  FIN  —
          </p>
          <p className="mt-3 text-[10px] text-candle-muted/50 font-serif italic">
            Bound in gold on the 18th of every month.
          </p>
        </section>
      </div>
    </div>
  );
}
