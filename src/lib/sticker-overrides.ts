import { supabase } from "@/integrations/supabase/client";

export type StickerOverrideRow = {
  id: string;
  kind: "hide" | "custom";
  sticker_id: string;
  label: string | null;
  category: string | null;
  image_url: string | null;
  created_at: string;
};

export type CustomSticker = {
  id: string;              // e.g. "custom-abc"
  url: string;             // resolved (signed or absolute)
  label: string;
  category: string;        // any PandaStickerCategory or "custom"
};

// module-level cache
const state = {
  hidden: new Set<string>(),
  customs: [] as CustomSticker[],
  customMap: new Map<string, string>(), // sticker_id -> url
  loaded: false,
};

const listeners = new Set<() => void>();
const urlCache = new Map<string, string>();

function isAbsolute(u: string | null | undefined) {
  return !!u && /^(https?:|data:|blob:)/i.test(u);
}

async function resolveImageUrl(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  if (isAbsolute(raw)) return raw;
  const hit = urlCache.get(raw);
  if (hit) return hit;
  const { data } = await supabase.storage.from("stickers").createSignedUrl(raw, 60 * 60 * 24);
  if (data?.signedUrl) {
    urlCache.set(raw, data.signedUrl);
    return data.signedUrl;
  }
  return null;
}

export function getHiddenStickerIds(): Set<string> { return state.hidden; }
export function getCustomStickers(): CustomSticker[] { return state.customs; }
export function isStickerHidden(id: string): boolean { return state.hidden.has(id); }
export function getCustomStickerUrl(id: string): string | null { return state.customMap.get(id) ?? null; }
export function isOverridesLoaded(): boolean { return state.loaded; }

export function subscribeStickerOverrides(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() { listeners.forEach((l) => l()); }

export async function refreshStickerOverrides() {
  const { data, error } = await supabase
    .from("sticker_admin")
    .select("id, kind, sticker_id, label, category, image_url, created_at")
    .order("created_at", { ascending: false });
  if (error) { state.loaded = true; emit(); return; }
  const hidden = new Set<string>();
  const customs: CustomSticker[] = [];
  const customMap = new Map<string, string>();
  for (const row of (data ?? []) as StickerOverrideRow[]) {
    if (row.kind === "hide") hidden.add(row.sticker_id);
    else if (row.kind === "custom") {
      const url = await resolveImageUrl(row.image_url);
      if (!url) continue;
      customs.push({
        id: row.sticker_id,
        url,
        label: row.label || row.sticker_id,
        category: row.category || "custom",
      });
      customMap.set(row.sticker_id, url);
    }
  }
  state.hidden = hidden;
  state.customs = customs;
  state.customMap = customMap;
  state.loaded = true;
  emit();
}

let realtimeInit = false;
export function initStickerOverridesRealtime() {
  if (realtimeInit) return;
  realtimeInit = true;
  refreshStickerOverrides();
  supabase
    .channel("sticker_admin_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "sticker_admin" }, () => {
      refreshStickerOverrides();
    })
    .subscribe();
}
