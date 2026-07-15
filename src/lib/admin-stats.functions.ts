import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type AdminStats = {
  users: { total: number; paired: number; last24h: number; last7d: number; online: number };
  messages: { total: number; last24h: number; last7d: number; withMedia: number };
  content: {
    customMovies: number;
    memories: number;
    moodLogs: number;
    dailyAnswers: number;
    games: number;
    wishlist: number;
    locks: number;
    watchRooms: number;
  };
  topSenders: { user_id: string; display_name: string | null; count: number }[];
};

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const now = Date.now();
    const d1 = new Date(now - 24 * 3600 * 1000).toISOString();
    const d7 = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const d5min = new Date(now - 5 * 60 * 1000).toISOString();

    async function c(table: string, filter?: (q: any) => any) {
      let q = admin.from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count } = await q;
      return count ?? 0;
    }

    const [
      usersTotal, usersPaired, usersNew24, usersNew7, usersOnline,
      msgsTotal, msgs24, msgs7, msgsMedia,
      cm, mem, mood, da, gs, wl, pl, wr,
    ] = await Promise.all([
      c("profiles"),
      c("profiles", (q) => q.not("partner_id", "is", null)),
      c("profiles", (q) => q.gte("created_at", d1)),
      c("profiles", (q) => q.gte("created_at", d7)),
      c("profiles", (q) => q.gte("last_seen_at", d5min)),
      c("messages"),
      c("messages", (q) => q.gte("created_at", d1)),
      c("messages", (q) => q.gte("created_at", d7)),
      c("messages", (q) => q.not("media_url", "is", null)),
      c("custom_movies"),
      c("memory_jar"),
      c("mood_log"),
      c("daily_answers"),
      c("game_sessions"),
      c("wishlist_items"),
      c("punishment_locks"),
      c("watch_rooms"),
    ]);

    // Top senders in last 7 days
    const { data: recentMsgs } = await supabaseAdmin
      .from("messages")
      .select("sender_id")
      .gte("created_at", d7);
    const senderCounts = new Map<string, number>();
    for (const row of recentMsgs ?? []) {
      senderCounts.set(row.sender_id, (senderCounts.get(row.sender_id) ?? 0) + 1);
    }
    const topIds = [...senderCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const { data: senderProfiles } = topIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", topIds.map(([id]) => id))
      : { data: [] as any[] };
    const topSenders = topIds.map(([id, count]) => ({
      user_id: id,
      display_name: senderProfiles?.find((p: any) => p.id === id)?.display_name ?? null,
      count,
    }));

    return {
      users: { total: usersTotal, paired: usersPaired, last24h: usersNew24, last7d: usersNew7, online: usersOnline },
      messages: { total: msgsTotal, last24h: msgs24, last7d: msgs7, withMedia: msgsMedia },
      content: {
        customMovies: cm, memories: mem, moodLogs: mood, dailyAnswers: da,
        games: gs, wishlist: wl, locks: pl, watchRooms: wr,
      },
      topSenders,
    };
  });

export type ActivityItem = {
  id: string;
  kind: "message" | "signup" | "pair" | "movie" | "memory" | "mood" | "game" | "wishlist" | "lock";
  at: string;
  actor: { id: string; name: string | null; avatar: string | null } | null;
  target: { id: string; name: string | null } | null;
  summary: string;
};

export const getRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<ActivityItem[]> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = Math.min(data.limit ?? 60, 200);

    const [msgs, signups, movies, memories, moods, games, wl, locks, pairs] = await Promise.all([
      supabaseAdmin.from("messages").select("id, sender_id, receiver_id, type, created_at, media_url").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("profiles").select("id, display_name, avatar_url, created_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("custom_movies").select("id, title, created_by, created_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("memory_jar").select("id, title, author_id, created_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("mood_log").select("id, user_id, emoji, label, created_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("game_sessions").select("id, host_id, partner_id, game, created_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("wishlist_items").select("id, owner_id, title, created_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("punishment_locks").select("id, target_id, locker_id, created_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("profiles").select("id, display_name, avatar_url, partner_id, paired_at").not("paired_at", "is", null).order("paired_at", { ascending: false }).limit(20),
    ]);

    // Collect all user ids to resolve names
    const ids = new Set<string>();
    for (const m of msgs.data ?? []) { ids.add(m.sender_id); if (m.receiver_id) ids.add(m.receiver_id); }
    for (const s of signups.data ?? []) ids.add(s.id);
    for (const m of movies.data ?? []) if (m.created_by) ids.add(m.created_by);
    for (const m of memories.data ?? []) ids.add(m.author_id);
    for (const m of moods.data ?? []) ids.add(m.user_id);
    for (const g of games.data ?? []) { ids.add(g.host_id); if (g.partner_id) ids.add(g.partner_id); }
    for (const w of wl.data ?? []) if (w.owner_id) ids.add(w.owner_id);
    for (const l of locks.data ?? []) { ids.add(l.target_id); if (l.locker_id) ids.add(l.locker_id); }
    for (const p of pairs.data ?? []) { ids.add(p.id); if (p.partner_id) ids.add(p.partner_id); }

    const { data: profs } = ids.size
      ? await supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", [...ids])
      : { data: [] as any[] };
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const name = (id: string | null | undefined) => (id ? pmap.get(id)?.display_name ?? "Someone" : null);
    const avatar = (id: string | null | undefined) => (id ? pmap.get(id)?.avatar_url ?? null : null);

    const items: ActivityItem[] = [];

    for (const m of msgs.data ?? []) {
      const t = m.type ?? "text";
      const kind = m.media_url ? (t === "voice" ? "voice note" : t === "image" ? "photo" : t === "video" ? "video" : "media") : "message";
      items.push({
        id: `msg-${m.id}`, kind: "message", at: m.created_at,
        actor: { id: m.sender_id, name: name(m.sender_id), avatar: avatar(m.sender_id) },
        target: m.receiver_id ? { id: m.receiver_id, name: name(m.receiver_id) } : null,
        summary: `sent a ${kind} to ${name(m.receiver_id) ?? "group"}`,
      });
    }
    for (const s of signups.data ?? []) {
      items.push({
        id: `signup-${s.id}`, kind: "signup", at: s.created_at,
        actor: { id: s.id, name: s.display_name, avatar: s.avatar_url },
        target: null, summary: "joined Pandacine",
      });
    }
    for (const p of pairs.data ?? []) {
      if (!p.paired_at) continue;
      items.push({
        id: `pair-${p.id}`, kind: "pair", at: p.paired_at,
        actor: { id: p.id, name: p.display_name, avatar: p.avatar_url },
        target: p.partner_id ? { id: p.partner_id, name: name(p.partner_id) } : null,
        summary: `paired with ${name(p.partner_id) ?? "partner"}`,
      });
    }
    for (const m of movies.data ?? []) {
      items.push({
        id: `movie-${m.id}`, kind: "movie", at: m.created_at,
        actor: m.created_by ? { id: m.created_by, name: name(m.created_by), avatar: avatar(m.created_by) } : null,
        target: null, summary: `added movie "${m.title}"`,
      });
    }
    for (const m of memories.data ?? []) {
      items.push({
        id: `mem-${m.id}`, kind: "memory", at: m.created_at,
        actor: { id: m.author_id, name: name(m.author_id), avatar: avatar(m.author_id) },
        target: null, summary: `saved memory "${m.title ?? "untitled"}"`,
      });
    }
    for (const m of moods.data ?? []) {
      items.push({
        id: `mood-${m.id}`, kind: "mood", at: m.created_at,
        actor: { id: m.user_id, name: name(m.user_id), avatar: avatar(m.user_id) },
        target: null, summary: `logged mood ${m.emoji ?? ""} ${m.label ?? ""}`.trim(),
      });
    }
    for (const g of games.data ?? []) {
      items.push({
        id: `game-${g.id}`, kind: "game", at: g.created_at,
        actor: { id: g.host_id, name: name(g.host_id), avatar: avatar(g.host_id) },
        target: g.partner_id ? { id: g.partner_id, name: name(g.partner_id) } : null,
        summary: `started ${g.game} with ${name(g.partner_id) ?? "partner"}`,
      });
    }
    for (const w of wl.data ?? []) {
      items.push({
        id: `wl-${w.id}`, kind: "wishlist", at: w.created_at,
        actor: w.owner_id ? { id: w.owner_id, name: name(w.owner_id), avatar: avatar(w.owner_id) } : null,
        target: null, summary: `wished for "${w.title ?? "something"}"`,
      });
    }
    for (const l of locks.data ?? []) {
      items.push({
        id: `lock-${l.id}`, kind: "lock", at: l.created_at,
        actor: l.locker_id ? { id: l.locker_id, name: name(l.locker_id), avatar: avatar(l.locker_id) } : null,
        target: { id: l.target_id, name: name(l.target_id) },
        summary: `set a lock on ${name(l.target_id) ?? "someone"}`,
      });
    }

    items.sort((a, b) => (a.at < b.at ? 1 : -1));
    return items.slice(0, limit);
  });

export type AdminUserRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  last_seen_at: string | null;
  paired_at: string | null;
  partner_id: string | null;
  partner_name: string | null;
  message_count: number;
};

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, avatar_url, is_admin, created_at, last_seen_at, paired_at, partner_id")
      .order("created_at", { ascending: false });

    const { data: msgs } = await supabaseAdmin.from("messages").select("sender_id");
    const counts = new Map<string, number>();
    for (const m of msgs ?? []) counts.set(m.sender_id, (counts.get(m.sender_id) ?? 0) + 1);

    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));

    return (profs ?? []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name,
      username: p.username,
      avatar_url: p.avatar_url,
      is_admin: p.is_admin,
      created_at: p.created_at,
      last_seen_at: p.last_seen_at,
      paired_at: p.paired_at,
      partner_id: p.partner_id,
      partner_name: p.partner_id ? pmap.get(p.partner_id)?.display_name ?? null : null,
      message_count: counts.get(p.id) ?? 0,
    }));
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await ensureAdmin(context);
    if (data.userId === context.userId) throw new Error("You can't delete your own admin account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Unpair partner if any
    const { data: prof } = await supabaseAdmin.from("profiles").select("partner_id").eq("id", data.userId).maybeSingle();
    if (prof?.partner_id) {
      await supabaseAdmin.from("profiles").update({ partner_id: null, paired_at: null }).eq("id", prof.partner_id);
    }
    // Delete auth user — cascade removes profile + owned rows via FKs
    const { error } = await (supabaseAdmin as any).auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSendCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; amount: number }) => {
    if (!d?.userId) throw new Error("userId required");
    const n = Math.floor(Number(d.amount));
    if (!Number.isFinite(n) || n === 0) throw new Error("Amount must be a non-zero integer");
    return { userId: d.userId, amount: n };
  })
  .handler(async ({ data, context }): Promise<{ ok: true; coins: number }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: prof, error: readErr } = await admin
      .from("profiles").select("coins").eq("id", data.userId).maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!prof) throw new Error("User not found");
    const next = Math.max(0, (prof.coins ?? 0) + data.amount);
    const { error: upErr } = await admin
      .from("profiles").update({ coins: next }).eq("id", data.userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, coins: next };
  });
