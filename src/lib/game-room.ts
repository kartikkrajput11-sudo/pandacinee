/**
 * Shared helpers for "one card → one room" game invites.
 *
 * Every game invite carries a unique `room` id. Both the sender and the
 * recipient open the invite card and land on the exact same realtime channel,
 * so a room is never guessed from user ids alone (two people can now have
 * several parallel rooms, and a friend room never collides with a partner one).
 */

export function newGameRoomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * Resolves the realtime channel key for a game surface.
 * Priority: explicit invite room → group match → deterministic pair key.
 */
export function gameRoomKey(opts: {
  room?: string | null;
  matchId?: string | null;
  meId?: string | null;
  otherId?: string | null;
}) {
  if (opts.room) return `r:${opts.room}`;
  if (opts.matchId) return opts.matchId;
  if (opts.meId && opts.otherId) return [opts.meId, opts.otherId].sort().join(":");
  return "solo";
}

/** True when the opponent in this room is the user's paired partner. */
export function isPartnerRoom(otherId?: string | null, partnerId?: string | null) {
  return !!otherId && !!partnerId && otherId === partnerId;
}
