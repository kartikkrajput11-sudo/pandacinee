import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GroupMatchRow = {
  id: string;
  group_id: string;
  game: string;
  created_by: string;
  max_players: number;
  status: "lobby" | "live" | "ended";
  external_ref: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type MatchParticipant = {
  match_id: string;
  user_id: string;
  role: "player" | "observer";
  seat: number | null;
  joined_at: string;
};

export type MatchMessage = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

/** Games playable from the group-match lobby. `maxPlayers` seats; everyone
 *  else joins as an observer with their own private chat. */
export const DUEL_GAMES = [
  { id: "chess",           name: "Chess",              emoji: "♟️", href: "/app/chess",            maxPlayers: 4 },
  { id: "ludo",            name: "Ludo",               emoji: "🎲", href: "/app/ludo",             maxPlayers: 4 },
  { id: "uno",             name: "Uno",                emoji: "🃏", href: "/app/uno",              maxPlayers: 4 },
  { id: "pool",            name: "8-Ball Pool",        emoji: "🎱", href: "/app/pool",             maxPlayers: 4 },
  { id: "know-me",         name: "How Well Do You Know Me?", emoji: "💌", href: "/app/knowme",     maxPlayers: 4 },
  { id: "hide-seek",       name: "Hide & Seek",        emoji: "🫣", href: "/app/hideseek",         maxPlayers: 4 },
  { id: "scribble-guess",  name: "Scribble & Guess",   emoji: "✏️", href: "/app/scribble",         maxPlayers: 4 },
  { id: "paint-together",  name: "Paint Together",     emoji: "🎨", href: "/app/paint",            maxPlayers: 8 },
  { id: "love-quiz",       name: "Love Quiz",          emoji: "💘", href: "/app/love-quiz",        maxPlayers: 4 },
  { id: "memory-challenge",name: "Memory Challenge",   emoji: "📸", href: "/app/memory-challenge", maxPlayers: 4 },
  { id: "daily-challenge", name: "Daily Challenge",    emoji: "🌞", href: "/app/daily-challenge",  maxPlayers: 4 },
  { id: "puzzle-together", name: "Puzzle Together",    emoji: "🧩", href: "/app/puzzle",           maxPlayers: 4 },

];

export async function createGroupMatch(groupId: string, game: string, maxPlayers = 2): Promise<GroupMatchRow> {
  const { data, error } = await supabase.rpc("create_group_match" as never, {
    _group_id: groupId,
    _game: game,
    _max_players: maxPlayers,
  } as never);
  if (error) throw error;
  return data as unknown as GroupMatchRow;
}

export async function joinGroupMatch(matchId: string): Promise<"player" | "observer"> {
  const { data, error } = await supabase.rpc("join_group_match" as never, { _match_id: matchId } as never);
  if (error) throw error;
  return data as "player" | "observer";
}

export async function startGroupMatch(matchId: string): Promise<GroupMatchRow> {
  const { data, error } = await supabase.rpc("start_group_match" as never, { _match_id: matchId } as never);
  if (error) throw error;
  return data as unknown as GroupMatchRow;
}

export function useGroupMatch(matchId: string | null, meId: string | null) {
  const [match, setMatch] = useState<GroupMatchRow | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [observerMessages, setObserverMessages] = useState<MatchMessage[]>([]);
  const [playerMessages, setPlayerMessages] = useState<MatchMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!matchId) return;
    const [m, p, o, pl] = await Promise.all([
      supabase.from("group_matches" as never).select("*").eq("id", matchId).maybeSingle(),
      supabase.from("group_match_participants" as never).select("*").eq("match_id", matchId),
      supabase.from("observer_messages" as never).select("*").eq("match_id", matchId).order("created_at"),
      supabase.from("match_player_messages" as never).select("*").eq("match_id", matchId).order("created_at"),
    ]);
    setMatch((m.data as unknown as GroupMatchRow) ?? null);
    setParticipants(((p.data ?? []) as unknown) as MatchParticipant[]);
    setObserverMessages(((o.data ?? []) as unknown) as MatchMessage[]);
    setPlayerMessages(((pl.data ?? []) as unknown) as MatchMessage[]);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Debounce reloads triggered by realtime changes so a burst of participant
  // seat/role updates (join, seat swap, role change) doesn't fan out into a
  // stampede of 4-query refetches.
  const reloadTimerRef = useRef<number | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current !== null) return;
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      void load();
    }, 200);
  }, [load]);

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase
      .channel(`gm-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_matches", filter: `id=eq.${matchId}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_match_participants", filter: `match_id=eq.${matchId}` }, scheduleReload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "observer_messages", filter: `match_id=eq.${matchId}` }, (payload) => {
        setObserverMessages((prev) => {
          const row = payload.new as MatchMessage;
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row];
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_player_messages", filter: `match_id=eq.${matchId}` }, (payload) => {
        setPlayerMessages((prev) => {
          const row = payload.new as MatchMessage;
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row];
        });
      })
      .subscribe();
    return () => {
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      supabase.removeChannel(ch);
    };
  }, [matchId, scheduleReload]);

  const myRole = meId ? participants.find((p) => p.user_id === meId)?.role ?? null : null;
  const players = participants.filter((p) => p.role === "player").sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  const observers = participants.filter((p) => p.role === "observer");

  const sendObserver = useCallback(async (content: string) => {
    if (!meId || !matchId) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("observer_messages" as never).insert({
      match_id: matchId, sender_id: meId, content: trimmed,
    } as never);
    if (error) throw error;
  }, [meId, matchId]);

  const sendPlayer = useCallback(async (content: string) => {
    if (!meId || !matchId) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("match_player_messages" as never).insert({
      match_id: matchId, sender_id: meId, content: trimmed,
    } as never);
    if (error) throw error;
  }, [meId, matchId]);

  return {
    match, participants, players, observers,
    observerMessages, playerMessages,
    myRole, loading,
    sendObserver, sendPlayer,
    refresh: load,
  };
}
