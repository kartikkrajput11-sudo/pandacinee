import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * When arriving at a game route from a group-match lobby with `?matchId=…`,
 * resolve the seated opponent (first other player, for duel games) so the
 * game can auto-enter partner mode and skip its mode picker.
 * Returns `{ opponentId, allPlayerIds, ready }`.
 */
export function useMatchOpponent(matchId: string | undefined, meId: string | undefined | null) {
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [allPlayerIds, setAllPlayerIds] = useState<string[]>([]);
  const [ready, setReady] = useState<boolean>(!matchId);

  useEffect(() => {
    if (!matchId || !meId) {
      setReady(!matchId);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("group_match_participants" as never)
        .select("user_id,role,seat")
        .eq("match_id", matchId)
        .eq("role", "player")
        .order("seat", { ascending: true });
      if (cancelled) return;
      const players = ((rows ?? []) as { user_id: string }[]).map((r) => r.user_id);
      setAllPlayerIds(players);
      setOpponentId(players.find((id) => id !== meId) ?? null);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [matchId, meId]);

  return { opponentId, allPlayerIds, ready };
}
