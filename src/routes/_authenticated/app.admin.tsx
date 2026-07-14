import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ShieldCheck, Plus, Film, Trash2, Upload, Play, X, Loader2,
  Users, MessageSquare, Activity as ActivityIcon, LayoutDashboard, RefreshCw,
  Heart, Smile, Sparkles, Gamepad2, Gift, Lock, UserPlus, Clapperboard, Circle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { claimAdmin, createCustomMovie, deleteCustomMovie } from "@/lib/admin.functions";
import { getAdminStats, getRecentActivity, getAdminUsers, deleteAdminUser, type ActivityItem, type AdminUserRow } from "@/lib/admin-stats.functions";

export const Route = createFileRoute("/_authenticated/app/admin")({
  component: AdminPage,
});

type CustomMovie = {
  id: string;
  title: string;
  year: number | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  runtime: number | null;
  genres: string[];
  video_url: string | null;
  video_storage_path: string | null;
  created_at: string;
};

function AdminPage() {
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const claim = useServerFn(claimAdmin);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("pandacine-admin") === "1") setUnlocked(true);
  }, []);

  const isAdmin = (me as any)?.is_admin === true;

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    try {
      if (pin !== "1804") {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        toast.error("Wrong PIN");
        return;
      }
      // If not yet flagged as admin, claim it (server verifies PIN too)
      if (!isAdmin) {
        const res = await claim({ data: { pin } });
        if (!res.ok) {
          toast.error("Could not grant admin");
          return;
        }
      }
      window.sessionStorage.setItem("pandacine-admin", "1");
      setUnlocked(true);
      toast.success("Welcome, admin");
    } finally {
      setChecking(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="pt-10 px-5 pb-24 max-w-md mx-auto">
        <header className="flex items-center gap-3 mb-8">
          <Link to="/app/me" className="text-candle-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="font-serif text-2xl italic">Admin</h1>
        </header>
        <div className="rounded-3xl border border-border bg-surface p-6 text-center">
          <div className="size-14 mx-auto mb-4 rounded-full bg-petal-soft flex items-center justify-center">
            <ShieldCheck className="size-6 text-petal" />
          </div>
          <h2 className="font-serif text-xl italic mb-1">Enter admin PIN</h2>
          <p className="text-xs text-candle-muted mb-5">Only the owner can add movies.</p>
          <form onSubmit={submitPin} className={shake ? "animate-[shake_0.4s]" : ""}>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="••••"
              className="w-full text-center tracking-[0.8em] text-2xl font-serif bg-velvet border border-border rounded-2xl px-4 py-4 text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60 focus:ring-2 focus:ring-petal/20"
            />
            <button
              type="submit"
              disabled={checking || pin.length < 4}
              className="mt-4 w-full py-3.5 bg-petal text-velvet rounded-full font-semibold text-sm disabled:opacity-50"
            >
              {checking ? "Checking…" : "Unlock"}
            </button>
          </form>
        </div>
        <style>{`@keyframes shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}`}</style>
      </div>
    );
  }

  return <AdminDashboard />;
}

type Tab = "overview" | "activity" | "users" | "library";

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="pt-8 px-4 pb-24 max-w-5xl mx-auto">
      <header className="flex items-center gap-3 mb-5">
        <Link to="/app/me" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal flex items-center gap-1.5">
            <ShieldCheck className="size-3" /> Admin console
          </p>
          <h1 className="font-serif text-3xl italic truncate">Pandacine HQ</h1>
        </div>
      </header>

      <nav className="flex gap-1 mb-6 -mx-1 px-1 overflow-x-auto no-scrollbar sticky top-0 z-10 bg-background/80 backdrop-blur pt-1 pb-2">
        {([
          ["overview", LayoutDashboard, "Overview"],
          ["activity", ActivityIcon, "Activity"],
          ["users", Users, "Users"],
          ["library", Film, "Library"],
        ] as const).map(([k, Icon, label]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k as Tab)}
              className={`shrink-0 h-9 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-petal text-velvet shadow-lg shadow-petal/30"
                  : "bg-surface border border-border text-candle-muted hover:text-candle"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          );
        })}
      </nav>

      {tab === "overview" && <OverviewTab />}
      {tab === "activity" && <ActivityTab />}
      {tab === "users" && <UsersTab />}
      {tab === "library" && <LibraryTab />}
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const fetchStats = useServerFn(getAdminStats);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 15_000,
  });

  if (isLoading) return <Skeleton />;
  if (!data) return <p className="text-candle-muted text-sm">No data.</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted">Live overview · refreshes every 15s</p>
        <button
          onClick={() => refetch()}
          className="h-8 px-3 rounded-full bg-surface border border-border text-[11px] text-candle flex items-center gap-1.5"
        >
          <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <section>
        <SectionLabel icon={<Users className="size-3 text-petal" />} title="People" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total users" value={data.users.total} accent />
          <StatCard label="Online now" value={data.users.online} sub="last 5 min" pulse={data.users.online > 0} />
          <StatCard label="Paired" value={data.users.paired} sub={`${pct(data.users.paired, data.users.total)}% of users`} />
          <StatCard label="New · 7d" value={data.users.last7d} sub={`+${data.users.last24h} today`} />
        </div>
      </section>

      <section>
        <SectionLabel icon={<MessageSquare className="size-3 text-petal" />} title="Messages" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total sent" value={data.messages.total} accent />
          <StatCard label="Today" value={data.messages.last24h} />
          <StatCard label="This week" value={data.messages.last7d} />
          <StatCard label="With media" value={data.messages.withMedia} sub="photos, voice, video" />
        </div>
      </section>

      <section>
        <SectionLabel icon={<Sparkles className="size-3 text-petal" />} title="Content across the app" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Custom movies" value={data.content.customMovies} icon={<Clapperboard className="size-3.5" />} />
          <StatCard label="Memories saved" value={data.content.memories} icon={<Heart className="size-3.5" />} />
          <StatCard label="Mood logs" value={data.content.moodLogs} icon={<Smile className="size-3.5" />} />
          <StatCard label="Daily answers" value={data.content.dailyAnswers} icon={<Sparkles className="size-3.5" />} />
          <StatCard label="Games played" value={data.content.games} icon={<Gamepad2 className="size-3.5" />} />
          <StatCard label="Wishlist items" value={data.content.wishlist} icon={<Gift className="size-3.5" />} />
          <StatCard label="Locks issued" value={data.content.locks} icon={<Lock className="size-3.5" />} />
          <StatCard label="Watch rooms" value={data.content.watchRooms} icon={<Play className="size-3.5" />} />
        </div>
      </section>

      {data.topSenders.length > 0 && (
        <section>
          <SectionLabel icon={<ActivityIcon className="size-3 text-petal" />} title="Top senders · last 7 days" />
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {data.topSenders.map((s, i) => (
              <div key={s.user_id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-[10px] font-bold text-petal w-5 text-center">#{i + 1}</span>
                <span className="text-sm text-candle flex-1 truncate">{s.display_name ?? s.user_id.slice(0, 8)}</span>
                <span className="text-xs text-candle-muted tabular-nums">{s.count} msgs</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent, pulse, icon }: {
  label: string; value: number; sub?: string; accent?: boolean; pulse?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "bg-petal/10 border-petal/30" : "bg-surface border-border"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-petal">{icon}</span>}
        <p className="text-[9px] uppercase tracking-widest text-candle-muted">{label}</p>
        {pulse && <span className="size-1.5 rounded-full bg-green-400 animate-pulse ml-auto" />}
      </div>
      <p className={`font-serif text-3xl tabular-nums ${accent ? "text-petal" : "text-candle"}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-[10px] text-candle-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-candle-muted mb-3 flex items-center gap-2.5">
      {icon}
      <span>{title}</span>
      <div className="h-px flex-1 bg-border" />
    </h3>
  );
}

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

// ─── Activity feed ───────────────────────────────────────────────────────

function ActivityTab() {
  const fetchActivity = useServerFn(getRecentActivity);
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: () => fetchActivity({ data: { limit: 80 } }),
    refetchInterval: 10_000,
  });

  // Realtime pulse — invalidate on any insert into hot tables
  useEffect(() => {
    const ch = supabase
      .channel("admin-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => refetch())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => refetch())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "custom_movies" }, () => refetch())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "memory_jar" }, () => refetch())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mood_log" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  if (isLoading) return <Skeleton />;
  const items = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted flex items-center gap-2">
          <Circle className="size-2 fill-green-400 text-green-400 animate-pulse" />
          Live feed · {items.length} events
        </p>
        <button onClick={() => refetch()} className="h-8 px-3 rounded-full bg-surface border border-border text-[11px] flex items-center gap-1.5">
          <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} /> Now
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-16 rounded-3xl border border-dashed border-border">
          <ActivityIcon className="size-8 text-candle-muted mx-auto mb-2" />
          <p className="text-sm text-candle-muted">Nothing happening yet.</p>
        </div>
      )}

      <ol className="space-y-2">
        {items.map((it) => <ActivityRow key={it.id} item={it} />)}
      </ol>

      <p className="mt-4 text-[10px] text-candle-muted text-center">
        Last updated {new Date(dataUpdatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}

const ACTIVITY_META: Record<ActivityItem["kind"], { icon: React.ComponentType<any>; color: string; label: string }> = {
  message: { icon: MessageSquare, color: "text-petal", label: "Message" },
  signup: { icon: UserPlus, color: "text-green-400", label: "Signup" },
  pair: { icon: Heart, color: "text-rose-400", label: "Paired" },
  movie: { icon: Clapperboard, color: "text-petal", label: "Movie" },
  memory: { icon: Sparkles, color: "text-amber-400", label: "Memory" },
  mood: { icon: Smile, color: "text-sky-400", label: "Mood" },
  game: { icon: Gamepad2, color: "text-purple-400", label: "Game" },
  wishlist: { icon: Gift, color: "text-emerald-400", label: "Wish" },
  lock: { icon: Lock, color: "text-rose-500", label: "Lock" },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const meta = ACTIVITY_META[item.kind];
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-surface border border-border px-3 py-2.5">
      <div className={`size-8 rounded-full bg-velvet flex items-center justify-center shrink-0 ${meta.color}`}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-candle">
          <span className="font-semibold">{item.actor?.name ?? "Someone"}</span>{" "}
          <span className="text-candle-muted">{item.summary}</span>
        </p>
        <p className="text-[10px] text-candle-muted mt-0.5">
          <span className={`uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
          <span className="mx-1.5 opacity-30">•</span>
          {timeAgo(item.at)}
        </p>
      </div>
    </li>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Users ────────────────────────────────────────────────────────────────

function UsersTab() {
  const fetchUsers = useServerFn(getAdminUsers);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
    refetchInterval: 30_000,
  });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter((u) =>
      (u.display_name ?? "").toLowerCase().includes(s) ||
      (u.username ?? "").toLowerCase().includes(s) ||
      u.id.toLowerCase().includes(s),
    );
  }, [data, q]);

  if (isLoading) return <Skeleton />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, username, or ID…"
          className="flex-1 h-10 px-4 bg-surface border border-border rounded-full text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
        />
        <button onClick={() => refetch()} className="h-10 px-3 rounded-full bg-surface border border-border text-[11px] flex items-center gap-1.5">
          <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-3">{filtered.length} users</p>

      <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
        {filtered.map((u) => <UserRow key={u.id} user={u} />)}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-sm text-candle-muted">No users match.</p>
        )}
      </div>
    </div>
  );
}

function UserRow({ user: u }: { user: AdminUserRow }) {
  const online = u.last_seen_at && Date.now() - new Date(u.last_seen_at).getTime() < 5 * 60 * 1000;
  const qc = useQueryClient();
  const del = useServerFn(deleteAdminUser);
  const [busy, setBusy] = useState(false);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Permanently delete ${u.display_name ?? u.username ?? "this user"}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await del({ data: { userId: u.id } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-petal/5 transition-colors">
      <Link
        to="/app/user/$userId"
        params={{ userId: u.id }}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="relative shrink-0">
          {u.avatar_url ? (
            <img src={u.avatar_url} alt="" className="size-10 rounded-full object-cover border border-border" />
          ) : (
            <div className="size-10 rounded-full bg-petal/20 border border-border flex items-center justify-center text-petal font-serif italic">
              {(u.display_name ?? "?")[0]}
            </div>
          )}
          <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface ${online ? "bg-green-400" : "bg-candle-muted/40"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-candle truncate">{u.display_name ?? "Unnamed"}</p>
            {u.is_admin && (
              <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-petal text-velvet font-bold">Admin</span>
            )}
          </div>
          <p className="text-[10px] text-candle-muted truncate">
            @{u.username ?? "—"}
            {u.partner_name && <> · 💞 {u.partner_name}</>}
          </p>
        </div>
        <div className="text-right shrink-0 hidden sm:block ml-3 w-20">
          <p className="text-[10px] text-candle-muted">
            {u.last_seen_at ? timeAgo(u.last_seen_at) : "never"}
          </p>
        </div>
      </Link>
      <button
        onClick={onDelete}
        disabled={busy || u.is_admin}
        title={u.is_admin ? "Cannot delete an admin" : "Delete user"}
        className="shrink-0 size-9 rounded-full bg-velvet border border-border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </div>
  );
}

// ─── Library (existing custom-movies management) ─────────────────────────

function LibraryTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const del = useServerFn(deleteCustomMovie);

  const { data: movies, isLoading } = useQuery({
    queryKey: ["custom-movies"],
    queryFn: async (): Promise<CustomMovie[]> => {
      const { data, error } = await supabase.from("custom_movies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CustomMovie[];
    },
  });

  async function onDelete(m: CustomMovie) {
    if (!confirm(`Delete "${m.title}"? This cannot be undone.`)) return;
    try {
      await del({ data: { id: m.id } });
      if (m.video_storage_path) {
        await supabase.storage.from("custom-movies").remove([m.video_storage_path]);
      }
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["custom-movies"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted">
          {movies?.length ?? 0} movies in your private library
        </p>
        <button
          onClick={() => setAdding(true)}
          className="h-10 px-4 rounded-full bg-petal text-velvet text-sm font-semibold flex items-center gap-1.5"
        >
          <Plus className="size-4" /> Add movie
        </button>
      </div>

      {isLoading && <Skeleton />}

      {!isLoading && (!movies || movies.length === 0) && (
        <div className="text-center py-16 rounded-3xl border border-dashed border-border">
          <Film className="size-8 text-petal mx-auto mb-3" />
          <h2 className="font-serif italic text-xl mb-1">No custom movies yet</h2>
          <p className="text-sm text-candle-muted mb-4">Add your first movie to watch together with full sync.</p>
          <button onClick={() => setAdding(true)} className="h-10 px-5 rounded-full bg-petal text-velvet text-sm font-semibold">
            Add movie
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {movies?.map((m) => (
          <div key={m.id} className="rounded-2xl border border-border bg-surface overflow-hidden flex">
            <div className="w-24 shrink-0 bg-velvet">
              {m.poster_url ? (
                <img src={m.poster_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Film className="size-6 text-candle-muted" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0 p-3 flex flex-col">
              <p className="font-serif italic text-base truncate">{m.title}</p>
              <p className="text-[10px] text-candle-muted">{m.year ?? "—"} · {m.runtime ? `${m.runtime}m` : "unknown"}</p>
              <p className="text-xs text-candle-muted mt-1 line-clamp-2">{m.overview ?? "No description."}</p>
              <div className="mt-auto pt-2 flex gap-2">
                <Link
                  to="/app/movies/$id/watch"
                  params={{ id: `custom:${m.id}` }}
                  className="h-8 px-3 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center gap-1"
                >
                  <Play className="size-3 fill-velvet" /> Watch
                </Link>
                <button
                  onClick={() => onDelete(m)}
                  className="h-8 px-3 rounded-full bg-surface-elevated border border-border text-xs text-candle-muted flex items-center gap-1"
                >
                  <Trash2 className="size-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {adding && <AddMovieModal onClose={() => { setAdding(false); qc.invalidateQueries({ queryKey: ["custom-movies"] }); }} />}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-surface animate-pulse" />
      ))}
    </div>
  );
}

function AddMovieModal({ onClose }: { onClose: () => void }) {
  const create = useServerFn(createCustomMovie);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState<string>("");
  const [runtime, setRuntime] = useState<string>("");
  const [overview, setOverview] = useState("");
  const [poster, setPoster] = useState("");
  const [backdrop, setBackdrop] = useState("");
  const [genres, setGenres] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => title.trim().length > 0 && (videoUrl.trim() || videoPath), [title, videoUrl, videoPath]);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadPct(5);
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("custom-movies").upload(path, file, {
      contentType: file.type || "video/mp4",
      upsert: false,
    });
    setUploading(false);
    setUploadPct(100);
    if (error) {
      toast.error(error.message);
      return;
    }
    setVideoPath(path);
    toast.success("Video uploaded");
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await create({
        data: {
          title: title.trim(),
          year: year ? Number(year) : null,
          runtime: runtime ? Number(runtime) : null,
          overview: overview.trim() || null,
          poster_url: poster.trim() || null,
          backdrop_url: backdrop.trim() || null,
          genres: genres.split(",").map((g) => g.trim()).filter(Boolean).slice(0, 20),
          video_url: videoUrl.trim() || null,
          video_storage_path: videoPath,
        },
      });
      toast.success("Movie added");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-surface border border-border p-5 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif italic text-2xl">Add movie</h2>
          <button onClick={onClose} className="size-9 rounded-full bg-surface-elevated flex items-center justify-center"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <TextField label="Title *" value={title} onChange={setTitle} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Year" value={year} onChange={setYear} type="number" />
            <TextField label="Runtime (min)" value={runtime} onChange={setRuntime} type="number" />
          </div>
          <TextField label="Overview" value={overview} onChange={setOverview} multiline />
          <TextField label="Poster URL" value={poster} onChange={setPoster} placeholder="https://..." />
          <TextField label="Backdrop URL" value={backdrop} onChange={setBackdrop} placeholder="https://..." />
          <TextField label="Genres (comma separated)" value={genres} onChange={setGenres} placeholder="Romance, Comedy" />

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-petal mb-1.5">Video source *</label>
            <TextField label="" value={videoUrl} onChange={setVideoUrl} placeholder="https://... .mp4 or .m3u8" />
            <p className="text-[10px] text-candle-muted mt-1 mb-2">— or —</p>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-11 rounded-2xl bg-velvet border border-dashed border-border flex items-center justify-center gap-2 text-sm text-candle disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? `Uploading ${uploadPct}%` : videoPath ? "Replace uploaded video" : "Upload video file"}
            </button>
            {videoPath && !uploading && (
              <p className="mt-2 text-[10px] text-candle-muted truncate">Uploaded: {videoPath}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-full bg-surface-elevated text-candle text-sm">Cancel</button>
          <button
            onClick={submit}
            disabled={!canSave || saving}
            className="flex-1 h-11 rounded-full bg-petal text-velvet font-semibold text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add movie"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder, type = "text", multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; multiline?: boolean;
}) {
  return (
    <div>
      {label && <label className="block text-[10px] uppercase tracking-widest text-petal mb-1.5">{label}</label>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-velvet border border-border rounded-2xl px-4 py-3 text-candle text-sm resize-none focus:outline-none focus:border-petal/60"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          className="w-full bg-velvet border border-border rounded-2xl px-4 py-3 text-candle text-sm focus:outline-none focus:border-petal/60"
        />
      )}
    </div>
  );
}
