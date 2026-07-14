import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Trophy, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { generateLoveQuiz } from "@/lib/games.functions";

export const Route = createFileRoute("/_authenticated/app/love-quiz")({
  component: LoveQuiz,
});

type Q = { q: string; options: string[]; answer: number };

function LoveQuiz() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  async function fresh() {
    setLoading(true);
    setPicked(null);
    setScore(0);
    setIdx(0);
    setDone(false);
    try {
      const hints = [
        me?.display_name && `Player: ${me.display_name}`,
        partner?.display_name && `Partner: ${partner.display_name}`,
        me?.favorite_emoji && `Favorite emoji: ${me.favorite_emoji}`,
        me?.bio && `Bio: ${me.bio}`,
      ]
        .filter(Boolean)
        .join(". ");
      const res = await generateLoveQuiz({ data: { hints: hints || undefined } });
      setQuestions(res.quiz.questions);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't generate quiz");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (me) fresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  function pick(i: number) {
    if (picked !== null || !questions[idx]) return;
    setPicked(i);
    if (i === questions[idx].answer) setScore((s) => s + 1);
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        setDone(true);
      } else {
        setIdx((n) => n + 1);
        setPicked(null);
      }
    }, 900);
  }

  const q = questions[idx];

  return (
    <div className="pt-10 px-5 pb-10">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app/play" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">AI · couple</p>
          <h1 className="font-serif text-2xl italic">Love Quiz</h1>
        </div>
      </header>

      {loading && (
        <div className="rounded-3xl border border-border bg-surface p-8 text-center">
          <Sparkles className="size-6 text-petal mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-candle">Crafting a quiz just for you…</p>
        </div>
      )}

      {!loading && !done && q && (
        <>
          <div className="flex items-center justify-between mb-3 text-xs text-candle-muted">
            <span>Q {idx + 1} / {questions.length}</span>
            <span className="flex items-center gap-1"><Trophy className="size-3 text-petal" /> {score}</span>
          </div>
          <div className="rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft to-transparent p-6 mb-4">
            <p className="font-serif italic text-2xl text-candle leading-snug">{q.q}</p>
          </div>
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const isPicked = picked === i;
              const isRight = picked !== null && i === q.answer;
              const isWrong = isPicked && i !== q.answer;
              return (
                <button
                  key={i}
                  disabled={picked !== null}
                  onClick={() => pick(i)}
                  className={`w-full text-left rounded-2xl border px-4 py-3.5 text-sm transition ${
                    isRight
                      ? "border-petal bg-petal-soft text-candle"
                      : isWrong
                        ? "border-destructive/40 bg-destructive/10 text-candle"
                        : "border-border bg-surface text-candle hover:border-petal/40"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      )}

      {done && (
        <div className="rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft to-transparent p-8 text-center">
          <div className="text-7xl mb-4">
            {score >= 4 ? "💖" : score >= 2 ? "🐼" : "🌱"}
          </div>
          <p className="font-serif italic text-3xl text-candle mb-2">
            {score} / {questions.length}
          </p>
          <p className="text-sm text-candle-muted mb-6">
            {score >= 4 ? "You know them by heart." : score >= 2 ? "A few surprises — nice!" : "Time to ask more questions ✨"}
          </p>
          <button
            onClick={fresh}
            className="inline-flex items-center gap-2 rounded-full bg-petal text-white px-6 py-3 text-sm font-semibold shadow-petal hover:brightness-110"
          >
            <RotateCw className="size-4" /> New quiz
          </button>
        </div>
      )}
    </div>
  );
}
