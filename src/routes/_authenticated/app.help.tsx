import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/help")({
  component: HelpPage,
});

type Topic = { q: string; a: string; tags: string[] };

const TOPICS: Topic[] = [
  {
    q: "How do I create a movie room?",
    a: "Go to Movies, pick a title, and tap Watch. If your partner is paired, the room is created automatically and both of you can join from the same title.",
    tags: ["room", "movie", "create"],
  },
  {
    q: "How do I join my partner's room?",
    a: "Open the same movie from the Movies tab. Playback stays in sync using our real-time engine — if drift happens, tap 'Sync to partner'.",
    tags: ["room", "join", "sync"],
  },
  {
    q: "How does synchronized playback work?",
    a: "Play, pause, and seek events are broadcast between both devices in real time. Small drift is tolerated; large gaps trigger a sync prompt.",
    tags: ["sync", "playback", "movie"],
  },
  {
    q: "How does chat work?",
    a: "Chat opens next to the movie or as its own tab. You can send text, emojis, stickers, voice notes, images, and drawings. Reactions and replies are supported.",
    tags: ["chat", "message", "emoji"],
  },
  {
    q: "How do I invite my partner?",
    a: "Open Settings → Partner, or tap Invite from the home screen. Share your invite code — once your partner enters it, you're paired.",
    tags: ["invite", "partner", "pair"],
  },
  {
    q: "How do couple games work?",
    a: "From the Play tab, pick a game. AI-powered games (Truth or Dare, Would You Rather, etc.) generate new prompts every round. Multiplayer games sync live.",
    tags: ["games", "play", "couple"],
  },
  {
    q: "How do I save memories?",
    a: "Open Memories to add photos, notes, and daily questions. Everything is private to you and your partner.",
    tags: ["memories", "save", "timeline"],
  },
  {
    q: "How do I change the theme?",
    a: "Open Settings → Appearance. Choose Dark, Light Purple, or follow your system.",
    tags: ["theme", "dark", "light", "appearance"],
  },
  {
    q: "Trouble signing in?",
    a: "Use Google or Apple if you signed up that way. If email isn't arriving, check spam and try again in a minute.",
    tags: ["login", "auth", "sign in", "trouble"],
  },
  {
    q: "Contact support",
    a: "Email us at support@pandacine.com — we usually reply within a day.",
    tags: ["support", "contact", "help"],
  },
];

function HelpPage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return TOPICS;
    return TOPICS.filter(
      (t) =>
        t.q.toLowerCase().includes(s) ||
        t.a.toLowerCase().includes(s) ||
        t.tags.some((tag) => tag.includes(s)),
    );
  }, [q]);

  return (
    <div className="pt-10 px-5 pb-10">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app/me" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Help center</p>
          <h1 className="font-serif text-2xl italic">Guide & FAQ</h1>
        </div>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-candle-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help topics"
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-surface border border-border text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/50"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((t) => (
          <details
            key={t.q}
            className="group rounded-2xl bg-surface border border-border p-4 open:border-petal/40 transition-colors"
          >
            <summary className="cursor-pointer font-medium text-candle list-none flex items-center justify-between">
              <span>{t.q}</span>
              <span className="text-petal group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-candle-muted leading-relaxed">{t.a}</p>
          </details>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-candle-muted">
            <div className="text-5xl mb-3">🐼</div>
            <p className="text-sm">No results. Try another word.</p>
          </div>
        )}
      </div>
    </div>
  );
}
