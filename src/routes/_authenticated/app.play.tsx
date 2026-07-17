import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { GAMES, GAME_KINDS, type GameKind } from "@/lib/games";
import { useProfile } from "@/hooks/useProfile";
import { useGamePresence } from "@/hooks/useGamePresence";
import { AvatarImg } from "@/components/AvatarImg";
import pandaPaint from "@/assets/pandas/panda-paint.png";
import pandaChess from "@/assets/pandas/panda-chess.png";
import pandaLudo from "@/assets/pandas/panda-ludo.png";
import pandaUno from "@/assets/pandas/panda-uno.png";
import pandaKnowme from "@/assets/pandas/panda-knowme.png";
import pandaScribble from "@/assets/pandas/panda-scribble.png";
import pandaTwoTruths from "@/assets/pandas/panda-twotruths.png";
import pandaHotTakes from "@/assets/pandas/panda-hottakes.png";
import pandaEmoji from "@/assets/pandas/panda-emoji.png";
import pandaDaily from "@/assets/pandas/panda-daily.png";
import pandaMemory from "@/assets/pandas/panda-memory.png";
import pandaLoveQuiz from "@/assets/pandas/panda-lovequiz.png";
import pandaTruthDare from "@/assets/pandas/panda-truthdare.png";
import pandaWyr from "@/assets/pandas/panda-wyr.png";
import pandaNhie from "@/assets/pandas/panda-nhie.png";
import pandaThisOrThat from "@/assets/pandas/panda-thisorthat.png";
import pandaGuessMe from "@/assets/pandas/panda-guessme.png";

const PANDA_STICKERS: Partial<Record<GameKind, string>> = {
  "paint-together": pandaPaint,
  "chess": pandaChess,
  "ludo": pandaLudo,
  "uno": pandaUno,
  "know-me": pandaKnowme,
  "scribble-guess": pandaScribble,
  "two-truths-lie": pandaTwoTruths,
  "hot-takes": pandaHotTakes,
  "emoji-riddle": pandaEmoji,
  "daily-challenge": pandaDaily,
  "memory-challenge": pandaMemory,
  "love-quiz": pandaLoveQuiz,
  "truth-or-dare": pandaTruthDare,
  "would-you-rather": pandaWyr,
  "never-have-i-ever": pandaNhie,
  "this-or-that": pandaThisOrThat,
  "guess-me": pandaGuessMe,
};

export const Route = createFileRoute("/_authenticated/app/play")({
  component: Play,
});

function Play() {
  const { data } = useProfile();
  const partner = data?.partner;
  const partnerGame = useGamePresence(data?.profile?.id, partner?.id, { subscribe: true });

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


      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-5xl mx-auto">

        {GAME_KINDS.map((kind) => {
          const g = GAMES[kind];
          const sticker = PANDA_STICKERS[kind];
          const partnerHere = partner && partnerGame === kind;
          const cardCls =
            `aspect-square p-4 bg-surface rounded-3xl border ${partnerHere ? "border-petal ring-2 ring-petal/40 shadow-[0_0_24px_-6px_rgba(236,72,153,0.5)]" : "border-border"} flex flex-col justify-between hover:border-petal/40 transition-colors relative overflow-hidden`;
          const inner = (
            <>
              {sticker ? (
                <img
                  src={sticker}
                  alt=""
                  loading="lazy"
                  className="w-14 h-14 object-contain -mt-1 -ml-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.25)]"
                />
              ) : (
                <span className="text-3xl">{g.emoji}</span>
              )}
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
