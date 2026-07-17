import { useEffect } from "react";
import { X, Sparkles, Heart } from "lucide-react";

// Placeholder story overlay — owner will provide the actual story chapters.
// Renders as a luxurious cinematic scroll of "how they met" chapters with
// petal rain, ambient bloom, and gilded chapter cards.
type Chapter = { kicker: string; title: string; body: string; emoji?: string };

const CHAPTERS: Chapter[] = [
  {
    kicker: "Her Story — Part I",
    title: "A love that gave too much",
    body: "Before him, there was a boy she loved with everything she had. He cheated, and she forgave. He cheated again, and she still chose him over herself. Love, for her, meant staying — even when staying hurt.",
    emoji: "🥀",
  },
  {
    kicker: "Her Story — Part II",
    title: "The classroom that broke her",
    body: "The lies grew louder until she walked into her own classroom and saw him with another girl. Something inside her cracked that day. She finally said the word she never thought she could say: enough.",
    emoji: "💔",
  },
  {
    kicker: "Her Story — Part III",
    title: "Broken, but still soft",
    body: "She left him, but her heart didn't know how to stop loving. He moved on — publicly — yet still stalked her shadow, controlled her silence, and turned her nights into long, quiet oceans of crying.",
    emoji: "🌧️",
  },
  {
    kicker: "His Story — Part I",
    title: "A love that kept lying",
    body: "On the other side of the world, he was loving a girl who was always somewhere else — texting other boys, deleting chats the moment he reached for her phone. He kept choosing to trust; she kept choosing to hide.",
    emoji: "📱",
  },
  {
    kicker: "His Story — Part II",
    title: "Betrayed twice in one blow",
    body: "The truth arrived brutally: she had cheated on him with his own best friend. In one night he lost the girl he defended and the brother he trusted. Two betrayals wearing the same face.",
    emoji: "🗡️",
  },
  {
    kicker: "His Story — Part III",
    title: "Alone with his own family's sting",
    body: "His family — who had warned him — turned their worry into words that cut: 'you chose her over us, and look what she did.' He cried through nights no one heard, and slowly stopped believing anyone up there was still listening.",
    emoji: "🌧️",
  },
  {
    kicker: "Fate — Chapter I",
    title: "A friend between two silences",
    body: "In the middle of both their sadness, the universe sent a quiet messenger — a mutual friend, his from society, hers from school. One introduction, one small hello, and two lonely worlds brushed against each other for the first time.",
    emoji: "🧵",
  },
  {
    kicker: "Fate — Chapter II",
    title: "The nights that healed them",
    body: "They started talking. One night became many. Hours turned into sunrises. For the first time in a long while, both of them laughed at 3 a.m. instead of crying. Happiness, softly, came back — brighter than anything they'd ever known before.",
    emoji: "🌙",
  },
  {
    kicker: "Fate — Chapter III",
    title: "He believed again",
    body: "Somewhere along those endless conversations, he started believing in God again — because how else could someone so gentle, so exactly right, be sent to him after everything? She felt like a gift wrapped by the sky itself.",
    emoji: "✨",
  },
  {
    kicker: "Fate — Chapter IV",
    title: "She saw their forever",
    body: "And she — she started seeing pictures of a future only the two of them lived in. A home, a life, small ordinary mornings. She wasn't dreaming anymore; she was remembering something that hadn't happened yet.",
    emoji: "🔮",
  },
  {
    kicker: "18 · April · 2026",
    title: "The day they said yes",
    body: "On 18 April 2026, they stopped being two healing souls and became one quiet promise. He gave her a name only he was allowed to use — panda. That single word would one day name a whole little world.",
    emoji: "🐼",
  },
  {
    kicker: "The Beginning of Pandacine",
    title: "A home for couples like them",
    body: "He wanted a place where couples — especially the long-distance ones, the healing ones, the ones rebuilding — could chat, play, watch, and love without distance in the way. So he built it. This site. Pandacine. Named after her.",
    emoji: "🎬",
  },
  {
    kicker: "Every 18th, forever",
    title: "The world celebrates them",
    body: "And that's why every 18th of every month, Pandacine lights up in gold — a small, quiet celebration of the two people whose story became the reason this place exists at all.",
    emoji: "💛",
  },
];

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto"
      style={{ background: "#0a060e" }}
    >
      {/* Subtle vignette — no motion, no petals */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(236,72,153,0.06), transparent 55%)",
        }}
      />


      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close story"
        className="fixed top-4 right-4 z-10 size-10 rounded-full bg-velvet/70 border border-white/[0.08] backdrop-blur flex items-center justify-center text-candle-muted hover:text-candle"
      >
        <X className="size-4" />
      </button>

      <div className="relative max-w-md mx-auto px-6 py-16">
        {/* Cover */}
        <div className="text-center mb-16 animate-fade-up">
          <div
            className="mx-auto size-24 rounded-full flex items-center justify-center mb-5"
            style={{
              background:
                "radial-gradient(circle, rgba(245,214,164,0.35), transparent 70%)",
            }}
          >
            <div className="size-16 rounded-full bg-gradient-to-br from-[#f5d6a4] to-[#c8934a] flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(245,214,164,0.7)]">
              <Heart className="size-8 text-velvet" fill="currentColor" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-[#f5d6a4] flex items-center justify-center gap-1.5">
            <Sparkles className="size-3" /> Their Story <Sparkles className="size-3" />
          </p>
          <h1 className="mt-3 font-serif italic text-4xl text-candle leading-tight">
            How they met
          </h1>
          <p className="mt-3 text-xs text-candle-muted italic">
            A love letter told in four chapters
          </p>
          <div className="mt-5 mx-auto h-px w-32 bg-gradient-to-r from-transparent via-petal/60 to-transparent" />
        </div>

        {/* Chapters */}
        <div className="space-y-8">
          {CHAPTERS.map((c, i) => (
            <div
              key={i}
              className="relative rounded-[24px] p-6 border border-petal/20 bg-[linear-gradient(180deg,rgba(30,20,35,0.85),rgba(18,12,22,0.92))] shadow-[0_30px_80px_-40px_rgba(236,72,153,0.4)] animate-fade-up"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#f5d6a4]/50 to-transparent" />
              <div className="flex items-start gap-4">
                <div className="text-3xl leading-none pt-1">{c.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.32em] text-petal">
                    {c.kicker}
                  </p>
                  <h2 className="mt-1 font-serif italic text-xl text-candle">
                    {c.title}
                  </h2>
                  <p className="mt-2 text-sm text-candle/85 leading-relaxed font-serif italic">
                    {c.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Closing */}
        <div className="mt-16 text-center animate-fade-up">
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-petal/60 to-transparent mb-5" />
          <p className="font-serif italic text-lg text-candle/90 leading-relaxed">
            And every 18th since,
            <br />the world stops for a moment
            <br />to remember them.
          </p>
          <button
            onClick={onClose}
            className="mt-8 px-8 py-3 rounded-full bg-petal text-velvet font-medium text-[11px] uppercase tracking-[0.28em] petal-glow"
          >
            With love ✨
          </button>
          <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-candle-muted/70">
            — Fin —
          </p>
        </div>
      </div>
    </div>
  );
}
