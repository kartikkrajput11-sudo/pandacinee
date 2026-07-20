import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const today = () => new Date().toISOString().slice(0, 10);

function epochDayIndex() {
  return Math.floor(Date.now() / 86400000);
}

export function useDailyQuestion(meId: string | null, partnerId: string | null) {
  const qc = useQueryClient();

  const q = useQuery({
    enabled: !!meId,
    queryKey: ["daily-question", meId, partnerId, today()],
    queryFn: async () => {
      const { data: questions } = await supabase
        .from("daily_questions")
        .select("id,day_index,prompt")
        .order("day_index", { ascending: true });
      if (!questions || questions.length === 0) {
        return { question: null, myAnswer: null, partnerAnswer: null };
      }
      const idx = epochDayIndex() % questions.length;
      const question = questions[idx];

      const { data: mine } = await supabase
        .from("daily_answers")
        .select("answer,created_at")
        .eq("user_id", meId!)
        .eq("date", today())
        .maybeSingle();

      let partnerAnswer: { answer: string; created_at: string } | null = null;
      if (partnerId && mine) {
        const { data: theirs } = await supabase
          .from("daily_answers")
          .select("answer,created_at")
          .eq("user_id", partnerId)
          .eq("date", today())
          .maybeSingle();
        partnerAnswer = (theirs as any) ?? null;
      }
      return { question, myAnswer: mine ?? null, partnerAnswer };
    },
  });

  const submit = useMutation({
    mutationFn: async (answer: string) => {
      if (!meId) throw new Error("Not signed in");
      const question = q.data?.question;
      if (!question) throw new Error("No question");
      const { error } = await supabase.from("daily_answers").insert({
        user_id: meId,
        partner_id: partnerId,
        question_id: question.id,
        date: today(),
        answer,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-question"] }),
  });

  useEffect(() => {
    if (!meId) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        qc.invalidateQueries({ queryKey: ["daily-question"] });
      }, 300);
    };
    const chMe = supabase
      .channel(`answers-me-${meId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_answers", filter: `user_id=eq.${meId}` },
        schedule,
      )
      .subscribe();
    const chPartner = partnerId
      ? supabase
          .channel(`answers-partner-${partnerId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "daily_answers", filter: `user_id=eq.${partnerId}` },
            schedule,
          )
          .subscribe()
      : null;
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(chMe);
      if (chPartner) supabase.removeChannel(chPartner);
    };
  }, [meId, partnerId, qc]);

  return {
    question: q.data?.question ?? null,
    myAnswer: q.data?.myAnswer ?? null,
    partnerAnswer: q.data?.partnerAnswer ?? null,
    isLoading: q.isLoading,
    submit,
  };
}
