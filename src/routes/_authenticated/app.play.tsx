import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/play")({
  component: Play,
});

const games = [
  { name: "Truth or Dare", body: "Romantic, funny, or deep.", emoji: "🎯" },
  { name: "This or That", body: "Quick taste comparisons.", emoji: "⚖️" },
  { name: "Conversation Cards", body: "Slow questions for two.", emoji: "💭" },
  { name: "Guess Me", body: "How well do you know me?", emoji: "🐼" },
];

function Play() {
  return (
    <div className="pt-10 px-5">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Couple games</p>
          <h1 className="font-serif text-2xl italic">Play together</h1>
        </div>
      </header>

      <div className="p-5 mb-6 rounded-3xl border border-border bg-surface flex items-center gap-3">
        <Sparkles className="size-5 text-petal" />
        <p className="text-sm text-candle-muted">
          Games are launching soon. Here's the lineup we're cooking up.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {games.map((g) => (
          <div
            key={g.name}
            className="aspect-square p-4 bg-surface rounded-3xl border border-border flex flex-col justify-between"
          >
            <span className="text-3xl">{g.emoji}</span>
            <div>
              <p className="font-serif italic text-lg leading-tight">{g.name}</p>
              <p className="text-[11px] text-candle-muted mt-1">{g.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
