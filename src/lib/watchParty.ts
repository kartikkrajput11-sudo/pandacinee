import { supabase } from "@/integrations/supabase/client";

export type WatchParty = {
  id: string;
  code: string;
  host_id: string;
  media_kind: "movie" | "tv" | "custom";
  media_id: string;
  media_title: string | null;
  media_poster: string | null;
  season: number | null;
  episode: number | null;
  source_idx: number;
  position_seconds: number;
  is_playing: boolean;
  last_actor_id: string | null;
  last_event: string | null;
  created_at: string;
  updated_at: string;
};

export type WatchPartyMessage = {
  id: string;
  party_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function createWatchParty(input: {
  media_kind: "movie" | "tv" | "custom";
  media_id: string;
  media_title?: string | null;
  media_poster?: string | null;
  season?: number | null;
  episode?: number | null;
  source_idx?: number;
}): Promise<WatchParty> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in");

  // Retry a few times on the unlikely code collision.
  let lastErr: unknown = null;
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    const { data, error } = await supabase
      .from("watch_parties")
      .insert({
        code,
        host_id: uid,
        media_kind: input.media_kind,
        media_id: input.media_id,
        media_title: input.media_title ?? null,
        media_poster: input.media_poster ?? null,
        season: input.season ?? null,
        episode: input.episode ?? null,
        source_idx: input.source_idx ?? 0,
        position_seconds: 0,
        is_playing: false,
      })
      .select("*")
      .single();
    if (!error && data) {
      // Ensure host is a member.
      await supabase
        .from("watch_party_members")
        .upsert({ party_id: data.id, user_id: uid }, { onConflict: "party_id,user_id" });
      return data as WatchParty;
    }
    lastErr = error;
  }
  throw lastErr ?? new Error("Failed to create party");
}

export async function joinWatchPartyByCode(code: string): Promise<WatchParty> {
  const { data, error } = await supabase.rpc("join_watch_party", {
    _code: code.toUpperCase().trim(),
  });
  if (error) throw error;
  return data as unknown as WatchParty;
}

export async function leaveWatchParty(partyId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return;
  await supabase.from("watch_party_members").delete().eq("party_id", partyId).eq("user_id", uid);
}

export async function publishPartyState(
  partyId: string,
  patch: Partial<
    Pick<
      WatchParty,
      | "position_seconds"
      | "is_playing"
      | "source_idx"
      | "season"
      | "episode"
      | "last_event"
    >
  >,
) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return;
  await supabase
    .from("watch_parties")
    .update({ ...patch, last_actor_id: uid, updated_at: new Date().toISOString() })
    .eq("id", partyId);
}

export async function sendPartyMessage(partyId: string, body: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in");
  const trimmed = body.trim();
  if (!trimmed) return;
  await supabase.from("watch_party_messages").insert({
    party_id: partyId,
    sender_id: uid,
    body: trimmed.slice(0, 2000),
  });
}

export function buildEmbedUrl(p: {
  media_kind: "movie" | "tv" | "custom";
  media_id: string;
  season: number | null;
  episode: number | null;
  position_seconds: number;
}): string {
  const t = Math.floor(p.position_seconds || 0);
  const progress = t > 0 ? `&progress=${t}` : "";
  if (p.media_kind === "tv" && p.season != null && p.episode != null) {
    return `https://www.vidking.net/embed/tv/${p.media_id}/${p.season}/${p.episode}?color=9146ff&autoPlay=true${progress}`;
  }
  return `https://www.vidking.net/embed/movie/${p.media_id}?color=9146ff&autoPlay=true${progress}`;
}
