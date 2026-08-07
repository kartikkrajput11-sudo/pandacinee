import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { PandaLogo } from "@/components/PandaLogo";
import { Petals } from "@/components/Petals";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-couple.jpg";
import mascotImage from "@/assets/panda-mascot.png";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/app" });
    }
  },
  head: () => ({
    meta: [
      { title: "PANDACINE — Connect Together" },
      {
        name: "description",
        content:
          "Your premium space to watch movies, play games, chat, call, celebrate milestones, and cherish every moment together.",
      },
      { property: "og:title", content: "PANDACINE — Connect Together" },
      {
        property: "og:description",
        content: "Your premium space to watch movies, play games, chat, call, celebrate milestones, and cherish every moment together.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen velvet-bg overflow-x-hidden">
      <Petals />

      {/* Nav */}
      <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <PandaLogo />
        <Link
          to="/auth"
          className="text-sm font-medium text-candle-muted hover:text-candle transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="px-6 pt-12 pb-20">
          <div className="max-w-2xl mx-auto text-center animate-fade-up">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border text-[11px] uppercase tracking-[0.2em] text-petal mb-8">
              <span className="size-1.5 rounded-full bg-petal animate-pulse-soft" />
              Made for two
            </span>
            <h1 className="font-serif text-6xl sm:text-7xl md:text-8xl leading-[0.95] tracking-tight mb-6">
              Watch. Chat. <em className="text-petal">Connect.</em>
            </h1>
            <p className="text-lg text-candle-muted max-w-[42ch] mx-auto mb-10 leading-relaxed">
              Your digital front row seat for movie nights, slow conversations, and every memory in
              between.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/auth"
                className="px-7 py-4 bg-petal text-velvet font-semibold rounded-full text-base petal-glow hover:brightness-110 transition-all active:scale-95"
              >
                Start your first date
              </Link>
              <a
                href="#features"
                className="px-7 py-4 bg-surface border border-border text-candle font-medium rounded-full text-base hover:bg-surface-elevated transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Hero image */}
          <div className="mt-20 max-w-md mx-auto animate-fade-up [animation-delay:200ms]">
            <div className="relative rounded-3xl overflow-hidden border border-border petal-glow">
              <PandasWatching className="w-full aspect-[4/5] block" />

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-velvet via-velvet/60 to-transparent p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-petal mb-1">
                      Now Playing
                    </p>
                    <p className="font-serif italic text-xl">Casablanca</p>
                  </div>
                  <span className="text-xs text-candle-muted animate-pulse-soft">● Together</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-6 py-20 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] uppercase tracking-[0.25em] text-petal mb-3">What's inside</p>
            <h2 className="font-serif text-4xl sm:text-5xl tracking-tight">
              Every moment, <em>together.</em>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 bg-surface rounded-3xl border border-border hover:border-petal/40 transition-colors"
              >
                <div className="size-10 rounded-2xl bg-petal-soft border border-petal/20 flex items-center justify-center mb-4 text-petal">
                  {f.icon}
                </div>
                <h3 className="font-serif text-2xl italic mb-2">{f.title}</h3>
                <p className="text-sm text-candle-muted leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Wrapped teaser */}
        <section className="px-6 py-20 max-w-3xl mx-auto">
          <div className="relative p-8 sm:p-12 rounded-[2rem] overflow-hidden border border-border">
            <div
              className="absolute inset-0 opacity-60"
              style={{ background: "var(--gradient-petal)" }}
            />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.25em] text-petal mb-3">
                Signature feature
              </p>
              <h3 className="font-serif text-4xl sm:text-5xl italic mb-4">Relationship Wrapped</h3>
              <p className="text-candle-muted max-w-[50ch] mb-8">
                Every month, see how your story is unfolding — messages exchanged, hours on calls,
                movies watched, favorite emojis, and the moments that made you laugh.
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-sm">
                <Stat label="Movies" value="142" />
                <Stat label="Call hrs" value="840" />
                <Stat label="Days" value="365" />
              </div>
            </div>
          </div>
        </section>

        {/* Mascot moment */}
        <section className="px-6 py-20 text-center">
          <img
            src={mascotImage}
            alt="PANDACINE panda mascot"
            className="w-48 sm:w-64 mx-auto mb-6 drop-shadow-2xl"
            loading="lazy"
          />
          <h3 className="font-serif text-3xl italic mb-3">Ready when you are.</h3>
          <Link
            to="/auth"
            className="inline-block mt-4 px-7 py-4 bg-petal text-velvet font-semibold rounded-full petal-glow hover:brightness-110 transition-all"
          >
            Create your PANDACINE
          </Link>
        </section>

        <footer className="border-t border-border mt-12 py-10 text-center">
          <p className="text-xs text-candle-muted">
            Made for the quiet nights · © {new Date().getFullYear()} PANDACINE
          </p>
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-serif text-3xl italic text-candle">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-candle-muted mt-1">{label}</p>
    </div>
  );
}

const features = [
  {
    icon: "🎬",
    title: "Watch Together",
    body: "Synced playback for any video. Pause for a kiss, rewind for a quote — your partner sees it instantly.",
  },
  {
    icon: "💬",
    title: "Private Chat",
    body: "Real-time messages built only for the two of you. No followers, no feeds, no noise.",
  },
  {
    icon: "🎮",
    title: "Couple Games",
    body: "Truth or dare, conversation cards, this-or-that — quick ways to keep learning each other.",
  },
  {
    icon: "❤️",
    title: "Shared Memories",
    body: "A scrapbook of your watch history, photos, voice notes, and milestones in one place.",
  },
  {
    icon: "📅",
    title: "Anniversary Mode",
    body: "The whole app transforms on your special day. Floating petals, golden recap, custom letter.",
  },
  {
    icon: "🌙",
    title: "Sleep Together",
    body: "Stay on call overnight with rain sounds and a soft good-night sticker.",
  },
];
