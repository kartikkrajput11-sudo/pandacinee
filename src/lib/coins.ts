import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EarnReason =
  | "daily_checkin"
  | "streak_bonus"
  | "first_message"
  | "achievement"
  | "watch_party"
  | "game_won";

const LABEL: Record<EarnReason, string> = {
  daily_checkin: "Daily check-in",
  streak_bonus: "Streak bonus",
  first_message: "First message today",
  achievement: "Achievement unlocked",
  watch_party: "Watch party finished",
  game_won: "Game won",
};

/**
 * Grants Panda Coins to the current user. Server-side is idempotent on
 * (user_id, reason, ref_id) so a refId that identifies the earn event (day,
 * streak-N, message-id, game-id, party-id) is critical — never omit it.
 */
export async function grantPandaCoins(
  reason: EarnReason,
  amount: number,
  refId: string,
  opts: { silent?: boolean } = {},
): Promise<number | null> {
  if (!refId) return null;
  try {
    const { data, error } = await (supabase as any).rpc("grant_coins", {
      _reason: reason,
      _amount: amount,
      _ref_id: refId,
    });
    if (error) return null;

    // Detect first-time award (not a no-op replay) via ledger check.
    const { data: rows } = await (supabase as any)
      .from("coin_ledger")
      .select("id, created_at")
      .eq("reason", reason)
      .eq("ref_id", refId)
      .limit(1);
    const row = (rows ?? [])[0];
    const isFresh =
      !!row && Date.now() - new Date(row.created_at).getTime() < 15_000;

    if (isFresh && !opts.silent) {
      toast.success(`+${amount} 🐼 Panda Coins`, {
        description: LABEL[reason],
      });
    }
    return data as number;
  } catch {
    return null;
  }
}

export const todayKey = () => new Date().toISOString().slice(0, 10);
