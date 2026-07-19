import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Crown, Eye, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";

type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type Participant = { user_id: string; role: "player" | "observer"; seat: number | null };

/**
 * A luxury top-bar that renders on every game when arriving from a group match.
 * Shows all seated players (with avatar + name + seat), an observers pill, and a
 * back-link to the lobby. Purely presentational; games keep their own logic.
 */
export function GroupPlayersBar({
  matchId,
  meId,
  gameName,
  currentTurnUserId,
}: {
  matchId: string;
  meId?: string | null;
  gameName: string;
  currentTurnUserId?: string | null;
}) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [hostId, setHostId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: parts }, { data: match }] = await Promise.all([
        supabase
          .from("group_match_participants" as never)
          .select("user_id,role,seat")
          .eq("match_id", matchId)
          .order("seat", { ascending: true, nullsFirst: false }),
        supabase
          .from("group_matches" as never)
          .select("created_by")
          .eq("id", matchId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const rows = (parts ?? []) as Participant[];
      setParticipants(rows);
      setHostId(((match as { created_by?: string } | null)?.created_by) ?? null);
      const ids = rows.map((r) => r.user_id);
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_url")
          .in("id", ids);
        if (cancelled) return;
        const map: Record<string, Profile> = {};
        for (const p of (profs ?? []) as Profile[]) map[p.id] = p;
        setProfiles(map);
      }
    }
    void load();
    const ch = supabase
      .channel(`group-players-bar-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_match_participants", filter: `match_id=eq.${matchId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [matchId]);

  const players = participants.filter((p) => p.role === "player");
  const observers = participants.filter((p) => p.role === "observer");

  return (
    <div className="fixed inset-x-0 top-0 z-40 w-full border-b border-candle-line/50 bg-gradient-to-r from-[#1a0f1e]/95 via-[#241026]/95 to-[#1a0f1e]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 sm:px-5 sm:py-2.5">
        <Link
          to="/app/group-match/$matchId"
          params={{ matchId }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-candle-muted transition hover:bg-white/10 hover:text-white"
          aria-label="Back to lobby"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80 sm:flex">
          <Swords className="h-3 w-3" /> {gameName}
        </div>

        <div className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
          {players.map((p) => {
            const prof = profiles[p.user_id];
            const isMe = p.user_id === meId;
            const isHost = p.user_id === hostId;
            const isTurn = p.user_id === currentTurnUserId;
            return (
              <div
                key={p.user_id}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-2 py-1 pr-3 transition ${
                  isTurn
                    ? "border-amber-300/60 bg-amber-400/10 shadow-[0_0_18px_-4px_rgba(251,191,36,0.55)]"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="relative">
                  <UserAvatar
                    src={prof?.avatar_url ?? null}
                    name={prof?.display_name ?? "Player"}
                    className="h-7 w-7"
                  />
                  {isHost && (
                    <Crown className="absolute -right-1 -top-1 h-3 w-3 text-amber-300 drop-shadow" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="max-w-[7rem] truncate text-xs font-medium text-white/90">
                    {isMe ? "You" : prof?.display_name ?? "Player"}
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.12em] text-white/40">
                    Seat {(p.seat ?? 0) + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {observers.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Watching</span>
            <div className="ml-1 flex -space-x-1.5">
              {observers.slice(0, 4).map((o) => {
                const prof = profiles[o.user_id];
                return (
                  <UserAvatar
                    key={o.user_id}
                    src={prof?.avatar_url ?? null}
                    name={prof?.display_name ?? "Watcher"}
                    className="h-5 w-5"
                  />
                );
              })}
            </div>
            {observers.length > 4 && (
              <span className="ml-1 font-semibold">+{observers.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
