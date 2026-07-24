import { createFileRoute, Link } from "@tanstack/react-router";
import { GameBackLink } from "@/components/games/GameBackLink";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Flame, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { gameSfx } from "@/lib/game-sfx";
import { GameChat } from "@/components/games/GameChat";
import { useProfile } from "@/hooks/useProfile";


export const Route = createFileRoute("/_authenticated/app/daily-challenge")({
  component: DailyChallenge,
});

const CHALLENGES = [
  "Draw your partner in one minute.",
  "Tell them three reasons you appreciate them.",
  "Send today's funniest selfie.",
  "Recreate a moment from your first date.",
  "Share a song that reminds you of them.",
  "Take a photo of something purple together.",
  "Write a tiny love note and send it.",
  "Cook or order the same meal tonight.",
  "Share your favorite memory of the week.",
  "Send a voice note singing your song.",
  "Compliment three things about them.",
  "Show today's view from where you are.",
  "Recreate your first photo together.",
  "Tell them a secret you've never shared.",
  "Ask them a question you're curious about.",
  "Send a childhood picture of yourself.",
  "Rate today's mood with an emoji, and why.",
  "Draw a heart on paper and send the photo.",
  "Plan one small thing for next weekend.",
  "Share the best thing that happened today.",
  "Send a poem — bad rhymes fully welcome.",
  "Tell them your favorite feature of theirs.",
  "Show your desk / space right now.",
  "Send a photo of something that made you smile.",
  "Say 'I love you' in three languages.",
  "Share one dream you have together.",
  "Send today's sky wherever you are.",
  "Tell them what you're proud of them for.",
  "Pick a movie for your next watch night.",
  "Share your top 3 emojis about them.",
  "Send a memory that made you laugh out loud.",
];

const STORAGE = "pandacine-daily-challenge";

type State = {
  streak: number;
  lastDate: string | null; // yyyy-mm-dd of last completion
  completedToday: boolean;
  history: string[]; // dates completed
};

function today() {
  return new Date().toISOString().slice(0, 10);
}
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}
function loadState(): State {
  if (typeof window === "undefined") return { streak: 0, lastDate: null, completedToday: false, history: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return { streak: 0, lastDate: null, completedToday: false, history: [] };
    const s = JSON.parse(raw) as State;
    // recompute completedToday
    s.completedToday = s.lastDate === today();
    // break streak if missed a day
    if (s.lastDate && s.lastDate !== today() && s.lastDate !== yesterday()) s.streak = 0;
    return s;
  } catch {
    return { streak: 0, lastDate: null, completedToday: false, history: [] };
  }
}

function todayChallenge() {
  // deterministic index per day so both partners see the same prompt
  const t = today();
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return CHALLENGES[h % CHALLENGES.length];
}

const ACHIEVEMENTS: { at: number; label: string; emoji: string }[] = [
  { at: 1, label: "First spark", emoji: "✨" },
  { at: 3, label: "3-day glow", emoji: "🌸" },
  { at: 7, label: "One week strong", emoji: "🔥" },
  { at: 14, label: "Fortnight fire", emoji: "💫" },
  { at: 30, label: "One month of love", emoji: "🏆" },
  { at: 100, label: "Century of care", emoji: "💎" },
];

function DailyChallenge() {
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const partner = prof?.partner;

  const [state, setState] = useState<State>({ streak: 0, lastDate: null, completedToday: false, history: [] });
  const [celebrate, setCelebrate] = useState(false);
  const challenge = useMemo(() => todayChallenge(), []);

  useEffect(() => {
    setState(loadState());
  }, []);

  function complete() {
    setState((prev) => {
      if (prev.completedToday) return prev;
      const t = today();
      let streak = prev.streak;
      if (prev.lastDate && daysBetween(prev.lastDate, t) === 1) streak += 1;
      else streak = 1;
      const next: State = {
        streak,
        lastDate: t,
        completedToday: true,
        history: [...prev.history, t].slice(-365),
      };
      window.localStorage.setItem(STORAGE, JSON.stringify(next));
      return next;
    });
    setCelebrate(true);
    gameSfx.complete();
    toast.success("Done! Streak counted 🐼");
    setTimeout(() => setCelebrate(false), 1600);
  }

  const unlocked = ACHIEVEMENTS.filter((a) => state.streak >= a.at);
  const next = ACHIEVEMENTS.find((a) => state.streak < a.at);

  return (
    <div className="pt-10 px-5 pb-10 relative">
      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="text-[8rem] animate-scale-in">🎉</div>
        </div>
      )}

      <header className="flex items-center gap-3 mb-6">
        <GameBackLink className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </GameBackLink>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Every day</p>
          <h1 className="font-serif text-2xl italic">Daily Challenge</h1>
        </div>
      </header>

      <div className="rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft to-transparent p-6 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-petal mb-3">Today</p>
        <p className="font-serif italic text-2xl text-candle leading-snug">{challenge}</p>
        <div className="mt-6 flex gap-2">
          <button
            onClick={complete}
            disabled={state.completedToday}
            className={`flex-1 rounded-full py-3 font-semibold transition ${
              state.completedToday
                ? "bg-surface text-candle-muted border border-border"
                : "bg-petal text-white shadow-petal hover:brightness-110"
            }`}
          >
            {state.completedToday ? (
              <span className="inline-flex items-center gap-2"><Check className="size-4" /> Completed today</span>
            ) : (
              "Mark as done"
            )}
          </button>
          <button
            onClick={async () => {
              const text = `Today's Pandacine challenge: "${challenge}" 🐼 · streak ${state.streak}d`;
              try {
                if (navigator.share) await navigator.share({ text });
                else { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
              } catch {}
            }}
            className="rounded-full bg-surface border border-border px-4 py-3 text-sm text-candle"
            aria-label="Share"
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-candle-muted mb-1">
            <Flame className="size-3.5 text-petal" /> Streak
          </div>
          <p className="font-serif text-3xl italic text-candle">{state.streak} <span className="text-sm text-candle-muted not-italic">days</span></p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-candle-muted mb-1">
            <Trophy className="size-3.5 text-petal" /> Total
          </div>
          <p className="font-serif text-3xl italic text-candle">{state.history.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-[10px] uppercase tracking-widest text-petal mb-3">Achievements</p>
        <div className="grid grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const on = state.streak >= a.at;
            return (
              <div
                key={a.at}
                className={`aspect-square rounded-2xl border flex flex-col items-center justify-center text-center p-2 ${
                  on ? "border-petal/40 bg-petal-soft" : "border-border bg-surface-elevated opacity-50"
                }`}
              >
                <span className="text-2xl mb-1">{a.emoji}</span>
                <span className="text-[10px] text-candle">{a.label}</span>
                <span className="text-[9px] text-candle-muted">{a.at}d</span>
              </div>
            );
          })}
        </div>
        {next && (
          <p className="mt-3 text-xs text-candle-muted text-center">
            {next.at - state.streak} more day{next.at - state.streak === 1 ? "" : "s"} to unlock “{next.label}” {next.emoji}
          </p>
        )}
        {unlocked.length === ACHIEVEMENTS.length && (
          <p className="mt-3 text-xs text-petal text-center">All achievements unlocked ✨</p>
        )}
      </div>
    </div>
  );
}
