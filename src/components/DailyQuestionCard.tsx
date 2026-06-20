import { useState } from "react";
import { Sparkles, Send, Lock } from "lucide-react";
import { useDailyQuestion } from "@/hooks/useDailyQuestion";

export function DailyQuestionCard({
  meId,
  partnerId,
  partnerName,
}: {
  meId: string;
  partnerId: string | null;
  partnerName: string;
}) {
  const { question, myAnswer, partnerAnswer, submit } = useDailyQuestion(meId, partnerId);
  const [text, setText] = useState("");

  if (!question) return null;

  const bothAnswered = !!(myAnswer && partnerAnswer);

  return (
    <div className="p-5 rounded-3xl border border-border bg-surface">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-petal" />
        <p className="text-[10px] uppercase tracking-widest text-petal">Today's question</p>
      </div>
      <p className="font-serif text-lg italic mb-4">{question.prompt}</p>

      {!myAnswer ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            submit.mutate(text.trim());
            setText("");
          }}
          className="flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="your answer…"
            maxLength={200}
            className="flex-1 px-3 py-2.5 bg-velvet border border-border rounded-xl text-sm placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
          />
          <button
            type="submit"
            disabled={submit.isPending || !text.trim()}
            className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <div className="p-3 rounded-2xl bg-velvet/40 border border-border">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-1">You</p>
            <p className="text-sm text-candle whitespace-pre-wrap">{myAnswer.answer}</p>
          </div>
          {partnerId ? (
            partnerAnswer ? (
              <div className="p-3 rounded-2xl bg-petal-soft border border-petal/30">
                <p className="text-[10px] uppercase tracking-widest text-petal mb-1">{partnerName}</p>
                <p className="text-sm text-candle whitespace-pre-wrap">{partnerAnswer.answer}</p>
              </div>
            ) : (
              <div className="p-3 rounded-2xl border border-border bg-velvet/30 flex items-center gap-2 text-xs text-candle-muted">
                <Lock className="size-3.5" /> {partnerName} hasn't answered yet — their answer reveals when they do.
              </div>
            )
          ) : (
            <p className="text-xs text-candle-muted italic">Pair with a partner to swap answers.</p>
          )}
        </div>
      )}
    </div>
  );
}
