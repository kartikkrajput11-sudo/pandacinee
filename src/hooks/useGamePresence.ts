import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { GAMES, GAME_KINDS, type GameKind } from "@/lib/games";

/** Build the couple-scoped presence channel name (or null if unpaired). */
function coupleChannel(meId: string | null | undefined, partnerId: string | null | undefined) {
  if (!meId || !partnerId) return null;
  const [a, b] = [meId, partnerId].sort();
  return `game-presence:${a}:${b}`;
}

/** Resolve a route pathname to a GameKind, if any. */
function pathToGameKind(pathname: string): GameKind | null {
  // Exact match against known GAMES.href
  for (const kind of GAME_KINDS) {
    const href = GAMES[kind].href;
    if (href && (pathname === href || pathname.startsWith(href + "/"))) return kind;
  }
  // Generic games route /app/games/:game
  const m = pathname.match(/^\/app\/games\/([^/]+)/);
  if (m && (GAME_KINDS as string[]).includes(m[1])) return m[1] as GameKind;
  return null;
}

/**
 * Broadcasts my current pathname to the couple presence channel and
 * (optionally) reports back the partner's currently-active game.
 *
 * Mount once in the app shell so partner presence is always up-to-date.
 */
export function useGamePresence(meId: string | null | undefined, partnerId: string | null | undefined, opts?: { subscribe?: boolean }): GameKind | null {
  const { pathname } = useLocation();
  const [partnerGame, setPartnerGame] = useState<GameKind | null>(null);
  const subscribe = opts?.subscribe ?? false;

  useEffect(() => {
    const name = coupleChannel(meId, partnerId);
    if (!name || !meId) return;

    // Ensure any stale channel with the same topic is removed so we can
    // attach presence callbacks before subscribing (Supabase forbids adding
    // callbacks after subscribe()).
    for (const c of supabase.getChannels()) {
      if (c.topic === `realtime:${name}`) supabase.removeChannel(c);
    }

    const channel = supabase.channel(name, {
      config: { presence: { key: meId } },
    });

    const readPartner = () => {
      if (!subscribe) return;
      const state = channel.presenceState() as Record<string, Array<{ path?: string }>>;
      const entries = state[partnerId!] || [];
      const latest = entries[entries.length - 1];
      setPartnerGame(latest?.path ? pathToGameKind(latest.path) : null);
    };

    channel
      .on("presence", { event: "sync" }, readPartner)
      .on("presence", { event: "join" }, readPartner)
      .on("presence", { event: "leave" }, readPartner)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ path: pathname, at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, partnerId, subscribe]);


  // Update tracked path whenever the user navigates.
  useEffect(() => {
    const name = coupleChannel(meId, partnerId);
    if (!name || !meId) return;
    const ch = supabase.getChannels().find((c) => c.topic === `realtime:${name}`);
    if (ch && ch.state === "joined") {
      ch.track({ path: pathname, at: Date.now() });
    }
  }, [pathname, meId, partnerId]);

  return partnerGame;
}
