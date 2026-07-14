import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { GAMES, GAME_KINDS } from "@/lib/games";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/play")({
  component: Play,
});

function Play() {
  const { data } = useProfile();
  const partner = data?.partner;

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

      {!partner && (
        <div className="p-5 mb-5 rounded-3xl border border-petal/30 bg-petal-soft">
          <p className="text-sm text-candle">
            Pair with your partner to play live. <Link to="/app/invite" className="text-petal underline">Invite them →</Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {GAME_KINDS.map((kind) => {
          const g = GAMES[kind];
          const cardCls =
            "aspect-square p-4 bg-surface rounded-3xl border border-border flex flex-col justify-between hover:border-petal/40 transition-colors relative overflow-hidden";
          const inner = (
            <>
              <span className="text-3xl">{g.emoji}</span>
              <div>
                <p className="font-serif italic text-lg leading-tight">{g.name}</p>
                <p className="text-[11px] text-candle-muted mt-1">{g.body}</p>
              </div>
              {g.comingSoon && (
                <span className="absolute top-2 right-2 text-[9px] uppercase tracking-widest bg-petal-soft text-petal px-2 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </>
          );
          if (g.comingSoon) {
            return (
              <button
                key={kind}
                type="button"
                onClick={() => import("sonner").then(({ toast }) => toast("Coming soon — we're painting this one in."))}
                className={cardCls + " text-left opacity-90"}
              >
                {inner}
              </button>
            );
          }
          if (g.href) {
            return (
              <Link key={kind} to={g.href} className={cardCls}>
                {inner}
              </Link>
            );
          }
          return (
            <Link
              key={kind}
              to="/app/games/$game"
              params={{ game: kind }}
              className={cardCls}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
