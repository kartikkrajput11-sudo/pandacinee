import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { GAMES, GAME_KINDS, type GameKind } from "@/lib/games";
import { EditorialPageHeader } from "@/components/editorial/SectionHeader";
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
import pandaHideSeek from "@/assets/pandas/panda-hideseek.png";

const PANDA_STICKERS: Partial<Record<GameKind, string>> = {
  "paint-together": pandaPaint,
  "chess": pandaChess,
  "ludo": pandaLudo,
  "uno": pandaUno,
  "hide-seek": pandaHideSeek,
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
      <div data-tour="play-hero">
      <EditorialPageHeader
        eyebrow="Couple games"
        title="Play together"
        subtitle="An arcade for two — pick a game, invite your panda, and let the night unfold."
        leading={
          <Link to="/app" className="text-candle-muted p-2 -ml-2 rounded-full hover:bg-surface transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
        }
      />
      </div>

      {!partner && (
        <div className="p-5 mb-5 rounded-3xl border border-petal/30 bg-petal-soft">
          <p className="text-sm text-candle">
            Pair with your partner to play live. <Link to="/app/invite" className="text-petal underline">Invite them →</Link>
          </p>
        </div>
      )}


      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-5xl mx-auto" data-tour="play-grid">


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
              {partnerHere && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-velvet/80 backdrop-blur border border-petal/50 pl-1 pr-2 py-0.5 shadow-lg animate-pulse">
                  <span className="relative inline-block size-5 rounded-full overflow-hidden ring-1 ring-petal/70">
                    {partner?.avatar_url ? (
                      <AvatarImg src={partner.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center bg-petal-soft text-petal text-[10px]">
                        {partner?.username?.[0]?.toUpperCase() ?? "•"}
                      </span>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-1 ring-velvet" />
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-petal font-medium">Here</span>
                </div>
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
