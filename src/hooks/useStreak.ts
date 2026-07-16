import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { grantPandaCoins, todayKey } from "@/lib/coins";

const today = () => new Date().toISOString().slice(0, 10);

export function useStreak(meId: string | null, partnerId: string | null) {
  const qc = useQueryClient();

  const q = useQuery({
    enabled: !!meId,
    queryKey: ["streak", meId, partnerId],
    queryFn: async () => {
      if (!meId) return { streak: 0, meChecked: false, partnerChecked: false };
      const [streakRes, mineRes, theirsRes] = await Promise.all([
        partnerId
          ? supabase.rpc("couple_streak" as any, { _me: meId, _partner: partnerId })
          : Promise.resolve({ data: 0, error: null }),
        supabase
          .from("daily_checkins")
          .select("id")
          .eq("user_id", meId)
          .eq("date", today())
          .maybeSingle(),
        partnerId
          ? supabase
              .from("daily_checkins")
              .select("id")
              .eq("user_id", partnerId)
              .eq("date", today())
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      return {
        streak: ((streakRes as any).data as number) ?? 0,
        meChecked: !!mineRes.data,
        partnerChecked: !!theirsRes.data,
      };
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      if (!meId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("daily_checkins")
        .insert({ user_id: meId, partner_id: partnerId, date: today() } as any);
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["streak"] }),
  });

  useEffect(() => {
    if (!meId) return;
    const ch = supabase
      .channel(`checkins-${meId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_checkins" },
        () => qc.invalidateQueries({ queryKey: ["streak"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [meId, qc]);

  return {
    streak: q.data?.streak ?? 0,
    meChecked: q.data?.meChecked ?? false,
    partnerChecked: q.data?.partnerChecked ?? false,
    isLoading: q.isLoading,
    checkIn,
  };
}
