import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "pandacine-onboarded-v1";

type Screen = {
  emoji: string;
  title: string;
  body: string;
};

const SCREENS: Screen[] = [
  {
    emoji: "🐼",
    title: "Welcome to PANDACINE",
    body: "Watch movies, chat, play games, and create memories together.",
  },
  {
    emoji: "🎬",
    title: "Movie Rooms",
    body: "Create or join a private room to enjoy synchronized movie nights with your partner.",
  },
  {
    emoji: "🎨",
    title: "Games together",
    body: "Play multiplayer games, complete daily challenges, and unlock achievements as a couple.",
  },
  {
    emoji: "💬",
    title: "Live chat",
    body: "Chat while watching, react instantly, share stickers, emojis, drawings, and memories.",
  },
  {
    emoji: "📸",
    title: "Memories",
    body: "Keep your favorite moments forever inside your private memory timeline.",
  },
];

export function OnboardingFlow() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(KEY)) setVisible(true);
  }, []);

  function finish() {
    window.localStorage.setItem(KEY, new Date().toISOString());
    setVisible(false);
  }

  if (!visible) return null;
  const isFinal = step >= SCREENS.length;
  const s = SCREENS[Math.min(step, SCREENS.length - 1)];

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-fade-in">
      <button
        onClick={finish}
        className="absolute top-5 right-5 text-xs uppercase tracking-widest text-candle-muted hover:text-candle"
      >
        Skip
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {!isFinal ? (
          <>
            <div className="text-8xl mb-8 animate-scale-in" key={step}>
              {s.emoji}
            </div>
            <h1 className="font-serif italic text-4xl text-candle mb-4">{s.title}</h1>
            <p className="text-candle-muted max-w-sm leading-relaxed">{s.body}</p>

            <div className="flex gap-2 mt-10">
              {SCREENS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-8 bg-petal" : "w-1.5 bg-border"
                  }`}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-9xl mb-6 animate-scale-in">🐼</div>
            <h1 className="font-serif italic text-4xl text-candle mb-3">
              You're all set <span className="text-petal">❤️</span>
            </h1>
            <p className="text-candle-muted max-w-sm">Invite your partner and start your night.</p>
          </>
        )}
      </div>

      <div className="p-6 pb-10 flex flex-col gap-3 items-center">
        {!isFinal ? (
          <>
            <button
              onClick={() => setStep((s) => s + 1)}
              className="w-full max-w-xs rounded-full bg-petal px-6 py-3.5 text-sm font-semibold text-white shadow-petal hover:brightness-110 transition"
            >
              {step === 0 ? "Get started" : "Next"}
            </button>
            {step === 0 && (
              <button
                onClick={finish}
                className="text-xs text-candle-muted hover:text-candle"
              >
                Skip intro
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Link
              onClick={finish}
              to="/app/invite"
              className="rounded-full bg-petal px-6 py-3.5 text-center text-sm font-semibold text-white shadow-petal"
            >
              Invite partner
            </Link>
            <button
              onClick={finish}
              className="rounded-full border border-border bg-surface px-6 py-3.5 text-sm font-medium text-candle"
            >
              Explore the app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
