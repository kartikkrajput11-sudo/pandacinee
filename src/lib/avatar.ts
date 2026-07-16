import { supabase } from "@/integrations/supabase/client";

// Cache signed URLs per raw value to avoid re-signing.
const cache = new Map<string, string>();

/**
 * Resolve a `profiles.avatar_url` field to a URL usable in <img src>.
 * - Absolute URLs (http/https, data:, blob:) are returned as-is.
 * - Empty / null → null.
 * - Anything else is treated as an object path inside the private `avatars` bucket
 *   and turned into a signed URL.
 */
export function resolveAvatarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  return cache.get(raw) ?? null;
}

export async function ensureAvatarUrl(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const hit = cache.get(raw);
  if (hit) return hit;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(raw, 60 * 60);
  if (data?.signedUrl) {
    cache.set(raw, data.signedUrl);
    return data.signedUrl;
  }
  return null;
}
