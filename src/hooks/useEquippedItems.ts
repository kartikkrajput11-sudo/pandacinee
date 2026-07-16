import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";

/**
 * Central hook for reading a user's equipped shop items + owned perks/packs.
 * All shop cosmetics + gated features read from this single source.
 */

export type ChatThemeMeta = {
  bubble_me?: string;
  bubble_them?: string;
  wallpaper?: string;
};

export type SiteThemeMeta = {
  accent?: string;
  bg?: string;
};

export type FlairMeta = {
  ring?: "aurora" | "gold" | string;
  name_gradient?: "sunset" | string;
  badge?: "supporter" | string;
};

export type EquippedItems = {
  chatTheme: ChatThemeMeta | null;
  siteTheme: SiteThemeMeta | null;
  flairRing: FlairMeta | null;
  flairNameGradient: FlairMeta | null;
  flairBadge: FlairMeta | null;
  ownedPerks: Set<string>; // e.g. "kiss_gold", "hug_warm", "confetti", "petal_rain", "wax_seal"
  ownedPackMoods: Set<string>; // moods unlocked via ai_sticker_pack purchases
  loaded: boolean;
  refresh: () => Promise<void>;
};

const CHANNEL_KEY = "equipped-items-broadcast";

// tiny in-tab pub/sub so multiple mounted consumers share updates
const listeners = new Set<() => void>();
function broadcast() {
  for (const l of listeners) l();
}

export function useEquippedItems(): EquippedItems {
  const { data } = useProfile();
  const me = data?.profile;

  const [chatTheme, setChatTheme] = useState<ChatThemeMeta | null>(null);
  const [siteTheme, setSiteTheme] = useState<SiteThemeMeta | null>(null);
  const [flairRing, setFlairRing] = useState<FlairMeta | null>(null);
  const [flairNameGradient, setFlairNameGradient] = useState<FlairMeta | null>(null);
  const [flairBadge, setFlairBadge] = useState<FlairMeta | null>(null);
  const [ownedPerks, setOwnedPerks] = useState<Set<string>>(new Set());
  const [ownedPackMoods, setOwnedPackMoods] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!me?.id) return;
    const { data: rows, error } = await (supabase as any)
      .from("user_inventory")
      .select("equipped, shop_items:item_id(category, metadata)")
      .eq("user_id", me.id);
    if (error) return;

    let ct: ChatThemeMeta | null = null;
    let st: SiteThemeMeta | null = null;
    let fRing: FlairMeta | null = null;
    let fName: FlairMeta | null = null;
    let fBadge: FlairMeta | null = null;
    const perks = new Set<string>();
    const moods = new Set<string>();

    for (const r of (rows ?? []) as any[]) {
      const item = r.shop_items;
      if (!item) continue;
      const meta = item.metadata ?? {};
      if (item.category === "ai_sticker_pack" && Array.isArray(meta.moods)) {
        for (const m of meta.moods) moods.add(String(m));
      }
      if (item.category === "chat_perk" && meta.effect) {
        perks.add(String(meta.effect));
      }
      if (!r.equipped) continue;
      if (item.category === "chat_theme") ct = meta;
      else if (item.category === "site_theme") st = meta;
      else if (item.category === "profile_flair") {
        if (meta.ring) fRing = meta;
        if (meta.name_gradient) fName = meta;
        if (meta.badge) fBadge = meta;
      }
    }

    setChatTheme(ct);
    setSiteTheme(st);
    setFlairRing(fRing);
    setFlairNameGradient(fName);
    setFlairBadge(fBadge);
    setOwnedPerks(perks);
    setOwnedPackMoods(moods);
    setLoaded(true);
  }, [me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Cross-consumer sync: any consumer that triggers a refresh notifies others.
  useEffect(() => {
    const l = () => load();
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [load]);

  // Also refresh when window regains focus (user just came back from Shop).
  useEffect(() => {
    if (!me?.id) return;
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [me?.id, load]);

  const refresh = useCallback(async () => {
    await load();
    broadcast();
  }, [load]);

  return {
    chatTheme,
    siteTheme,
    flairRing,
    flairNameGradient,
    flairBadge,
    ownedPerks,
    ownedPackMoods,
    loaded,
    refresh,
  };
}

// Utility to notify all mounted consumers from anywhere (e.g. shop after equip)
export function invalidateEquippedItems() {
  broadcast();
}

// Suppress unused warning for CHANNEL_KEY (kept for future BroadcastChannel usage)
void CHANNEL_KEY;
