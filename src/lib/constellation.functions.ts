import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Auto-detects constellation-worthy moments from the couple's recent activity
 * and inserts them as source='ai' rows. Rate-limited to at most one AI batch
 * every 12 hours per user to avoid runaway inserts.
 */
export const autoDetectConstellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Resolve partner.
    const { data: meRow } = await supabase
      .from("profiles")
      .select("id,partner_id,display_name,anniversary_date,paired_at")
      .eq("id", userId)
      .maybeSingle();
    const partnerId = (meRow as any)?.partner_id as string | undefined;
    if (!partnerId) return { inserted: 0, skipped: "no-partner" as const };

    // Rate limit: last AI insert within 12h → skip.
    const twelveHoursAgo = new Date(Date.now() - 12 * 3600_000).toISOString();
    const { data: recentAi } = await supabase
      .from("constellation_notes")
      .select("id,created_at")
      .eq("source", "ai")
      .or(`author_id.eq.${userId},partner_id.eq.${userId}`)
      .gte("created_at", twelveHoursAgo)
      .limit(1);
    if ((recentAi ?? []).length > 0) return { inserted: 0, skipped: "recent" as const };

    // Gather signal from the past 21 days.
    const since = new Date(Date.now() - 21 * 86400_000).toISOString();
    const sinceDate = since.slice(0, 10);

    const [{ data: mems }, { data: moods }, { data: existing }] = await Promise.all([
      supabase
        .from("memory_jar")
        .select("title,body,mood,happened_on,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("mood_log")
        .select("user_id,label,emoji,score,date")
        .in("user_id", [userId, partnerId])
        .gte("date", sinceDate)
        .order("date", { ascending: false })
        .limit(30),
      supabase
        .from("constellation_notes")
        .select("title,occurred_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const signal = {
      anniversary: (meRow as any)?.anniversary_date ?? null,
      paired_at: (meRow as any)?.paired_at ?? null,
      memories: (mems ?? []) as any[],
      moods: (moods ?? []) as any[],
      existing_titles: ((existing ?? []) as any[]).map((e) => e.title),
    };

    // Nothing to work with? Skip quietly.
    if (signal.memories.length === 0 && signal.moods.length < 2) {
      return { inserted: 0, skipped: "no-signal" as const };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { inserted: 0, skipped: "no-key" as const };

    const prompt = `You are a poetic curator for a couple's private "Constellation of Us" — a night sky of meaningful moments in their relationship. Given recent memories and mood peaks (last 21 days), identify UP TO 3 fresh constellation-worthy moments that are NOT already in existing_titles.

Return strictly minified JSON: {"stars":[{"title":"short poetic title (max 6 words)","note":"one gentle sentence, second-person plural voice ('you two…')","glyph":"single emoji or star glyph","occurred_at":"YYYY-MM-DD (from the source moment)"}]}

Rules:
- Do not use partner names.
- If nothing is truly new/worthy, return {"stars":[]}.
- glyph must be one character/emoji: ✦ ✧ ★ ❤︎ 🌙 🕯️ 🌸 🍷 ☕ 🎬 🌊 🔥 ✨
- occurred_at must be within the last 21 days.

Signal:
${JSON.stringify(signal)}`;

    let stars: Array<{ title: string; note: string; glyph: string; occurred_at: string }> = [];
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) return { inserted: 0, skipped: "ai-error" as const };
      const j = await resp.json();
      const text: string = j?.choices?.[0]?.message?.content ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { inserted: 0, skipped: "ai-parse" as const };
      const parsed = JSON.parse(match[0]);
      stars = Array.isArray(parsed?.stars) ? parsed.stars : [];
    } catch {
      return { inserted: 0, skipped: "ai-throw" as const };
    }

    const today = new Date().toISOString().slice(0, 10);
    const rows = stars
      .filter((s) => s && s.title && s.note && s.glyph && s.occurred_at)
      .slice(0, 3)
      .map((s) => ({
        author_id: userId,
        partner_id: partnerId,
        title: String(s.title).slice(0, 120),
        note: String(s.note).slice(0, 400),
        glyph: String(s.glyph).slice(0, 4),
        occurred_at: s.occurred_at > today ? today : s.occurred_at,
        source: "ai" as const,
      }));

    if (rows.length === 0) return { inserted: 0, skipped: "empty" as const };

    const { error } = await supabase.from("constellation_notes").insert(rows as any);
    if (error) return { inserted: 0, skipped: "db-error" as const, error: error.message };
    return { inserted: rows.length };
  });
