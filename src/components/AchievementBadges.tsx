import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TAG_BY_KEY } from "@/lib/achievements";

export function AchievementBadges({ userId, equippedOnly = true }: { userId: string; equippedOnly?: boolean }) {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (equippedOnly) {
        const { data } = await (supabase as any)
          .from("profiles")
          .select("equipped_tags")
          .eq("id", userId)
          .maybeSingle();
        if (!cancelled) setKeys(((data?.equipped_tags ?? []) as string[]));
      } else {
        const { data } = await (supabase as any)
          .from("profile_achievements")
          .select("tag_key,acquired_at")
          .eq("user_id", userId)
          .order("acquired_at", { ascending: true });
        if (!cancelled) setKeys(((data ?? []) as any[]).map((r) => r.tag_key));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, equippedOnly]);

  if (keys.length === 0) return null;

  return (
    <div className="mt-4 p-4 rounded-2xl border border-petal/20 bg-petal-soft/10">
      <p className="text-[10px] uppercase tracking-[0.25em] text-petal mb-3">Achievements</p>
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => {
          const t = TAG_BY_KEY[k];
          if (!t) return null;
          return (
            <div
              key={k}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${t.hue}30, ${t.hue}10)`,
                border: `1px solid ${t.hue}55`,
                color: t.hue,
                boxShadow: `0 0 12px -4px ${t.hue}`,
              }}
              title={t.blurb}
            >
              <span className="text-sm">{t.emoji}</span>
              <span>{t.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
