import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ShieldCheck, Plus, Film, Trash2, Upload, Play, X, Loader2,
  Users, MessageSquare, Activity as ActivityIcon, LayoutDashboard, RefreshCw,
  Heart, Smile, Sparkles, Gamepad2, Gift, Lock, UserPlus, Clapperboard, Circle,
  Pencil, Search, Coins,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  claimAdmin, createCustomMovie, updateCustomMovie, deleteCustomMovie,
  listCustomEpisodes, upsertCustomEpisode, updateCustomEpisode, deleteCustomEpisode,
} from "@/lib/admin.functions";
import { tmdbSearch, tmdbMovie, tmdbTvDetail, tmdbTvSeason, type TmdbMovie } from "@/lib/tmdb.functions";

import { getAdminStats, getRecentActivity, getAdminUsers, deleteAdminUser, adminSendCoins, type ActivityItem, type AdminUserRow } from "@/lib/admin-stats.functions";
import { AvatarImg } from "@/components/AvatarImg";
import AnimationsTab from "@/components/admin/AnimationsTab";
import BroadcastTab from "@/components/admin/BroadcastTab";
import { Wand2, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/tamanna")({
  component: AdminPage,
});

type QualityVariant = { label: string; url: string; height?: number | null };

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
  video_qualities: QualityVariant[] | null;
  tmdb_id: number | null;
  media_type: "movie" | "tv" | null;
  use_vidking: boolean | null;
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

type Tab = "overview" | "activity" | "users" | "library" | "animations" | "broadcast";

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

      <FoundersBannerToggle />


      <nav className="flex gap-1 mb-6 -mx-1 px-1 overflow-x-auto no-scrollbar sticky top-0 z-10 bg-background/80 backdrop-blur pt-1 pb-2">
        {([
          ["overview", LayoutDashboard, "Overview"],
          ["activity", ActivityIcon, "Activity"],
          ["users", Users, "Users"],
          ["library", Film, "Library"],
          ["animations", Wand2, "Animations"],
          ["broadcast", Megaphone, "Broadcast"],
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
      {tab === "animations" && <AnimationsTab />}
      {tab === "broadcast" && <BroadcastTab />}
    </div>
  );
}

// ─── Founders' Monthiversary banner toggle ────────────────────────────────

function FoundersBannerToggle() {
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("site_flags")
        .select("value")
        .eq("key", "founders_monthiversary_hidden")
        .maybeSingle();
      if (!alive) return;
      setHidden(data?.value === true || (data?.value as any) === "true");
    })();
    return () => { alive = false; };
  }, []);

  async function toggle() {
    if (hidden === null || saving) return;
    setSaving(true);
    const next = !hidden;
    const { error } = await supabase
      .from("site_flags")
      .upsert({ key: "founders_monthiversary_hidden", value: next as any, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHidden(next);
    toast.success(next ? "Founders' banner hidden site-wide" : "Founders' banner restored");
  }

  return (
    <div className="mb-4 p-4 rounded-2xl border border-border bg-surface flex items-center gap-3">
      <div className="size-10 rounded-full bg-petal-soft flex items-center justify-center shrink-0">
        <Heart className="size-4 text-petal" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-candle">Founders' monthiversary banner</p>
        <p className="text-[11px] text-candle-muted">
          {hidden === null ? "Loading…" : hidden ? "Currently hidden for everyone." : "Shows every 18th at the top of the app."}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={hidden === null || saving}
        aria-pressed={!!hidden}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${hidden ? "bg-petal" : "bg-border"} disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${hidden ? "translate-x-6" : "translate-x-0.5"}`}
        />
      </button>
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
  const [revoking, setRevoking] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [coinAmt, setCoinAmt] = useState("");
  const [sendingCoins, setSendingCoins] = useState(false);
  const sendCoins = useServerFn(adminSendCoins);

  async function submitCoins(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const n = parseInt(coinAmt, 10);
    if (!Number.isFinite(n) || n === 0) { toast.error("Enter a non-zero amount"); return; }
    setSendingCoins(true);
    try {
      const res = await sendCoins({ data: { userId: u.id, amount: n } });
      toast.success(`Wallet updated · ${res.coins} coins`);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setCoinsOpen(false);
      setCoinAmt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send coins");
    } finally {
      setSendingCoins(false);
    }
  }

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

  function openRevoke(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPin("");
    setPinOpen(true);
  }

  async function submitRevoke(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRevoking(true);
    try {
      const { data, error } = await supabase.rpc("revoke_admin", { _target: u.id, _pin: pin });
      if (error) throw error;
      if (data === true) {
        toast.success("Admin removed");
        qc.invalidateQueries({ queryKey: ["admin", "users"] });
        setPinOpen(false);
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        toast.error("Wrong code");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove admin");
    } finally {
      setRevoking(false);
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
            <AvatarImg src={u.avatar_url} alt="" className="size-10 rounded-full object-cover border border-border" />
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
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCoinAmt(""); setCoinsOpen(true); }}
        title="Send coins"
        className="shrink-0 size-9 rounded-full bg-velvet border border-petal/30 text-petal hover:bg-petal/10 flex items-center justify-center transition-colors"
      >
        <Coins className="size-4" />
      </button>
      {u.is_admin ? (
        <button
          onClick={openRevoke}
          disabled={revoking}
          title="Remove admin (requires code)"
          className="shrink-0 h-9 px-3 rounded-full bg-velvet border border-petal/40 text-petal text-[10px] uppercase tracking-widest font-bold hover:bg-petal/10 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
        >
          {revoking ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
          Revoke
        </button>
      ) : (
        <button
          onClick={onDelete}
          disabled={busy}
          title="Delete user"
          className="shrink-0 size-9 rounded-full bg-velvet border border-border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      )}

      {pinOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-velvet/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => !revoking && setPinOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-petal/30 bg-surface p-6 text-center shadow-2xl shadow-petal/20 animate-in zoom-in-95 duration-200"
          >
            <div className="size-14 mx-auto mb-4 rounded-full bg-petal-soft flex items-center justify-center">
              <ShieldCheck className="size-6 text-petal" />
            </div>
            <h2 className="font-serif text-xl italic mb-1">Revoke admin</h2>
            <p className="text-xs text-candle-muted mb-5">
              Enter the security code to remove admin from{" "}
              <span className="text-candle">{u.display_name ?? u.username ?? "this user"}</span>.
            </p>
            <form onSubmit={submitRevoke} className={shake ? "animate-[shake_0.4s]" : ""}>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoFocus
                placeholder="••••"
                className="w-full text-center tracking-[0.8em] text-2xl font-serif bg-velvet border border-border rounded-2xl px-4 py-4 text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60 focus:ring-2 focus:ring-petal/20"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPinOpen(false)}
                  disabled={revoking}
                  className="flex-1 py-3 rounded-full bg-velvet border border-border text-candle-muted text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revoking || pin.length < 4}
                  className="flex-1 py-3 bg-petal text-velvet rounded-full font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {revoking ? <Loader2 className="size-4 animate-spin" /> : null}
                  {revoking ? "Verifying…" : "Revoke"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {coinsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-velvet/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => !sendingCoins && setCoinsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-petal/30 bg-surface p-6 text-center shadow-2xl shadow-petal/20 animate-in zoom-in-95 duration-200"
          >
            <div className="size-14 mx-auto mb-4 rounded-full bg-petal-soft flex items-center justify-center">
              <Coins className="size-6 text-petal" />
            </div>
            <h2 className="font-serif text-xl italic mb-1">Send coins</h2>
            <p className="text-xs text-candle-muted mb-5">
              Fill or debit the wallet of{" "}
              <span className="text-candle">{u.display_name ?? u.username ?? "this user"}</span>.
              Use a negative number to subtract.
            </p>
            <form onSubmit={submitCoins}>
              <input
                value={coinAmt}
                onChange={(e) => setCoinAmt(e.target.value.replace(/[^\d-]/g, ""))}
                inputMode="numeric"
                autoFocus
                placeholder="e.g. 500"
                className="w-full text-center tracking-wider text-2xl font-serif bg-velvet border border-border rounded-2xl px-4 py-4 text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60 focus:ring-2 focus:ring-petal/20"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCoinsOpen(false)}
                  disabled={sendingCoins}
                  className="flex-1 py-3 rounded-full bg-velvet border border-border text-candle-muted text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingCoins || !coinAmt || coinAmt === "-"}
                  className="flex-1 py-3 bg-petal text-velvet rounded-full font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingCoins ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
                  {sendingCoins ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



// ─── Library (existing custom-movies management) ─────────────────────────

function LibraryTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CustomMovie | null>(null);
  const [episodesFor, setEpisodesFor] = useState<CustomMovie | null>(null);
  const [query, setQuery] = useState("");
  const del = useServerFn(deleteCustomMovie);


  const { data: movies, isLoading } = useQuery({
    queryKey: ["custom-movies"],
    queryFn: async (): Promise<CustomMovie[]> => {
      const { data, error } = await supabase.from("custom_movies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CustomMovie[];
    },
  });

  const filtered = useMemo(() => {
    if (!movies) return [];
    const s = query.trim().toLowerCase();
    if (!s) return movies;
    return movies.filter((m) =>
      m.title.toLowerCase().includes(s) ||
      (m.genres ?? []).some((g) => g.toLowerCase().includes(s)) ||
      String(m.year ?? "").includes(s),
    );
  }, [movies, query]);

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
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted">
          {movies?.length ?? 0} titles in library
        </p>
        <div className="flex-1" />
        <div className="relative">
          <Search className="size-3.5 text-candle-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search library…"
            className="h-9 pl-8 pr-3 rounded-full bg-surface border border-border text-xs text-candle w-40 sm:w-56 focus:outline-none focus:border-petal/60"
          />
        </div>
        <button
          onClick={() => setAdding(true)}
          className="h-10 px-4 rounded-full bg-petal text-velvet text-sm font-semibold flex items-center gap-1.5"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>

      {isLoading && <Skeleton />}

      {!isLoading && (!movies || movies.length === 0) && (
        <div className="text-center py-16 rounded-3xl border border-dashed border-border">
          <Film className="size-8 text-petal mx-auto mb-3" />
          <h2 className="font-serif italic text-xl mb-1">No titles yet</h2>
          <p className="text-sm text-candle-muted mb-4">Search TMDB or upload a video to add your first title.</p>
          <button onClick={() => setAdding(true)} className="h-10 px-5 rounded-full bg-petal text-velvet text-sm font-semibold">
            Add title
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((m) => (
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
              <div className="mt-auto pt-2 flex gap-2 flex-wrap">
                <Link
                  to="/app/movies/$id/watch"
                  params={{ id: `custom:${m.id}` }}
                  className="h-8 px-3 rounded-full bg-petal text-velvet text-xs font-semibold flex items-center gap-1"
                >
                  <Play className="size-3 fill-velvet" /> Watch
                </Link>
                <button
                  onClick={() => setEditing(m)}
                  className="h-8 px-3 rounded-full bg-surface-elevated border border-border text-xs text-candle flex items-center gap-1 hover:border-petal/40"
                >
                  <Pencil className="size-3" /> Edit
                </button>
                {m.media_type === "tv" && (
                  <button
                    onClick={() => setEpisodesFor(m)}
                    className="h-8 px-3 rounded-full bg-surface-elevated border border-border text-xs text-candle flex items-center gap-1 hover:border-petal/40"
                  >
                    <Clapperboard className="size-3" /> Episodes
                  </button>
                )}
                <button
                  onClick={() => onDelete(m)}
                  className="h-8 px-3 rounded-full bg-surface-elevated border border-border text-xs text-rose-400 flex items-center gap-1 hover:border-rose-500/40"
                >
                  <Trash2 className="size-3" /> Delete
                </button>

              </div>
            </div>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <MovieModal
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["custom-movies"] });
          }}
        />
      )}
      {episodesFor && (
        <EpisodesModal
          movie={episodesFor}
          onClose={() => setEpisodesFor(null)}
        />
      )}

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

function MovieModal({ initial, onClose }: { initial?: CustomMovie | null; onClose: () => void }) {
  const [existingId, setExistingId] = useState<string | null>(initial?.id ?? null);
  const isEdit = !!existingId;
  const create = useServerFn(createCustomMovie);
  const update = useServerFn(updateCustomMovie);
  const searchTmdb = useServerFn(tmdbSearch);
  const getTmdb = useServerFn(tmdbMovie);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<any>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [year, setYear] = useState<string>(initial?.year != null ? String(initial.year) : "");
  const [runtime, setRuntime] = useState<string>(initial?.runtime != null ? String(initial.runtime) : "");
  const [overview, setOverview] = useState(initial?.overview ?? "");
  const [poster, setPoster] = useState(initial?.poster_url ?? "");
  const [backdrop, setBackdrop] = useState(initial?.backdrop_url ?? "");
  const [genres, setGenres] = useState((initial?.genres ?? []).join(", "));
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? "");
  const [videoPath, setVideoPath] = useState<string | null>(initial?.video_storage_path ?? null);
  const [videoFileName, setVideoFileName] = useState<string | null>(initial?.video_storage_path ?? null);
  const [videoFileSize, setVideoFileSize] = useState<number>(0);
  const [videoQualities, setVideoQualities] = useState<QualityVariant[]>(
    Array.isArray(initial?.video_qualities) ? (initial!.video_qualities as QualityVariant[]) : [],
  );
  const [tmdbId, setTmdbId] = useState<number | null>(initial?.tmdb_id ?? null);
  const [mediaType, setMediaType] = useState<"movie" | "tv">(initial?.media_type ?? "movie");
  const [useVidking, setUseVidking] = useState<boolean>(initial?.use_vidking ?? false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>("");
  const [uploadEta, setUploadEta] = useState<string>("");
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // TMDB autofill search
  const [tmdbQ, setTmdbQ] = useState("");
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbResults, setTmdbResults] = useState<TmdbMovie[]>([]);

  async function runTmdbSearch() {
    const q = tmdbQ.trim();
    if (!q) return;
    setTmdbLoading(true);
    try {
      const r = await searchTmdb({ data: { q } });
      setTmdbResults(r.slice(0, 8));
    } catch {
      toast.error("TMDB search failed");
    } finally {
      setTmdbLoading(false);
    }
  }

  async function pickTmdb(m: TmdbMovie) {
    setTmdbResults([]);
    setTmdbQ("");

    // If a library row already exists for this TMDB id, switch into edit mode
    // and hydrate from that row rather than creating a duplicate.
    const { data: existing } = await supabase
      .from("custom_movies")
      .select("*")
      .eq("tmdb_id", m.id)
      .maybeSingle();

    if (existing) {
      const row = existing as CustomMovie;
      setExistingId(row.id);
      setTitle(row.title);
      setOverview(row.overview ?? "");
      setYear(row.year != null ? String(row.year) : "");
      setRuntime(row.runtime != null ? String(row.runtime) : "");
      setPoster(row.poster_url ?? "");
      setBackdrop(row.backdrop_url ?? "");
      setGenres((row.genres ?? []).join(", "));
      setVideoUrl(row.video_url ?? "");
      setVideoPath(row.video_storage_path ?? null);
      setVideoFileName(row.video_storage_path ?? null);
      setVideoQualities(Array.isArray(row.video_qualities) ? (row.video_qualities as QualityVariant[]) : []);
      setTmdbId(row.tmdb_id);
      setMediaType(row.media_type ?? "movie");
      setUseVidking(row.use_vidking ?? true);
      toast.success(`Editing existing · ${row.title}`);
      return;
    }

    // No existing row → autofill a fresh entry from TMDB
    setTitle(m.title);
    setOverview(m.overview ?? "");
    setYear(m.release_date ? m.release_date.slice(0, 4) : "");
    if (m.poster_path) setPoster(`https://image.tmdb.org/t/p/w500${m.poster_path}`);
    if (m.backdrop_path) setBackdrop(`https://image.tmdb.org/t/p/w1280${m.backdrop_path}`);
    setTmdbId(m.id);
    setMediaType("movie");
    setUseVidking(true);
    try {
      const detail: any = await getTmdb({ data: { id: m.id } });
      if (detail?.runtime) setRuntime(String(detail.runtime));
      if (Array.isArray(detail?.genres)) {
        setGenres(detail.genres.map((g: any) => g.name).filter(Boolean).join(", "));
      }
    } catch { /* ignore */ }
    toast.success(`Linked to TMDB · ${m.title} · VidKing ready`);
  }


  const canSave = useMemo(
    () => title.trim().length > 0 && (isEdit || videoUrl.trim() || videoPath || (useVidking && tmdbId)) && !uploading,
    [title, videoUrl, videoPath, uploading, isEdit, useVidking, tmdbId],
  );

  async function uploadFile(file: File) {
    setUploadErr(null);
    setVideoFileName(file.name);
    setVideoFileSize(file.size);

    // Get current session for the resumable upload authorization
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      toast.error("Sign in required");
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;

    // Lazy-load tus-js-client (browser-only)
    const tus = await import("tus-js-client");

    setUploading(true);
    setUploadPct(0);
    setUploadSpeed("");
    setUploadEta("");

    const started = Date.now();
    let lastBytes = 0;
    let lastAt = started;

    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "custom-movies",
        objectName: path,
        contentType: file.type || "video/mp4",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024, // 6 MB — required to be exactly this for Supabase Storage
      onError: (err) => {
        setUploading(false);
        setUploadErr(err.message || "Upload failed");
        toast.error(err.message || "Upload failed");
      },
      onProgress: (sent, total) => {
        const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
        setUploadPct(pct);
        const now = Date.now();
        const dt = (now - lastAt) / 1000;
        if (dt > 0.4) {
          const speed = (sent - lastBytes) / dt; // bytes/s
          setUploadSpeed(fmtBytes(speed) + "/s");
          const remaining = total - sent;
          const eta = speed > 0 ? Math.round(remaining / speed) : 0;
          setUploadEta(fmtDuration(eta));
          lastBytes = sent;
          lastAt = now;
        }
      },
      onSuccess: () => {
        setUploading(false);
        setUploadPct(100);
        setVideoPath(path);
        setUploadSpeed("");
        setUploadEta("");
        toast.success("Video uploaded");
      },
    });

    uploadRef.current = upload;
    // Check for previous unfinished uploads of this exact file
    const prev = await upload.findPreviousUploads();
    if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0]);
    upload.start();
  }

  function cancelUpload() {
    try { uploadRef.current?.abort(true); } catch { /* noop */ }
    setUploading(false);
    setUploadPct(0);
    setUploadSpeed("");
    setUploadEta("");
    setVideoFileName(null);
    setVideoFileSize(0);
    setVideoPath(null);
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        year: year ? Number(year) : null,
        runtime: runtime ? Number(runtime) : null,
        overview: overview.trim() || null,
        poster_url: poster.trim() || null,
        backdrop_url: backdrop.trim() || null,
        genres: genres.split(",").map((g) => g.trim()).filter(Boolean).slice(0, 20),
        video_url: videoUrl.trim() || null,
        video_storage_path: videoPath,
        video_qualities: videoQualities
          .map((q) => ({
            label: q.label.trim(),
            url: q.url.trim(),
            height: q.height != null && !Number.isNaN(Number(q.height)) ? Number(q.height) : null,
          }))
          .filter((q) => q.label.length > 0 && q.url.length > 0),
        tmdb_id: tmdbId,
        media_type: mediaType,
        use_vidking: useVidking,
      };
      if (isEdit && existingId) {
        await update({ data: { id: existingId, ...payload } });
        toast.success("Updated");
      } else {
        await create({ data: payload });
        toast.success("Movie added");
      }
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
          <h2 className="font-serif italic text-2xl">{isEdit ? "Edit title" : "Add title"}</h2>
          <button onClick={onClose} className="size-9 rounded-full bg-surface-elevated flex items-center justify-center"><X className="size-4" /></button>
        </div>

        {/* TMDB autofill */}
        <div className="mb-4 rounded-2xl bg-velvet border border-border p-3">
          <label className="block text-[10px] uppercase tracking-widest text-petal mb-2 flex items-center gap-1.5">
            <Search className="size-3" /> Autofill from TMDB / IMDb
          </label>
          <div className="flex gap-2">
            <input
              value={tmdbQ}
              onChange={(e) => setTmdbQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runTmdbSearch(); } }}
              placeholder="Search a movie or show…"
              className="flex-1 h-10 px-3 rounded-full bg-surface border border-border text-sm text-candle focus:outline-none focus:border-petal/60"
            />
            <button
              onClick={runTmdbSearch}
              disabled={!tmdbQ.trim() || tmdbLoading}
              className="h-10 px-4 rounded-full bg-petal text-velvet text-xs font-bold disabled:opacity-50 flex items-center gap-1"
            >
              {tmdbLoading ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
              Search
            </button>
          </div>
          {tmdbResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {tmdbResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickTmdb(m)}
                  className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-petal/10 text-left transition-colors"
                >
                  {m.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} alt="" className="w-8 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-12 rounded bg-surface flex items-center justify-center"><Film className="size-3 text-candle-muted" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-candle truncate">{m.title}</p>
                    <p className="text-[10px] text-candle-muted">{m.release_date?.slice(0, 4) ?? "—"} · ★ {m.vote_average?.toFixed(1) ?? "—"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
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

          {/* VidKing integration panel */}
          <div className="rounded-2xl bg-velvet border border-border p-3 space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-petal flex items-center gap-1.5">
              <Play className="size-3" /> VidKing / IMDb source
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={tmdbId ?? ""}
                onChange={(e) => setTmdbId(e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)}
                placeholder="TMDB ID (e.g. 27205)"
                inputMode="numeric"
                className="h-10 px-3 rounded-full bg-surface border border-border text-sm text-candle focus:outline-none focus:border-petal/60"
              />
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as "movie" | "tv")}
                className="h-10 px-3 rounded-full bg-surface border border-border text-xs text-candle focus:outline-none focus:border-petal/60"
              >
                <option value="movie">Movie</option>
                <option value="tv">TV / Series</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-candle cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useVidking}
                disabled={!tmdbId}
                onChange={(e) => setUseVidking(e.target.checked)}
                className="accent-petal size-4"
              />
              Play via VidKing embed (uses TMDB ID)
            </label>
            {tmdbId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview((v) => !v)}
                  className="h-8 px-3 rounded-full bg-surface-elevated border border-border text-[11px] text-candle flex items-center gap-1"
                >
                  <Play className="size-3" /> {showPreview ? "Hide preview" : "Test VidKing"}
                </button>
                <a
                  href={`https://www.themoviedb.org/${mediaType}/${tmdbId}`}
                  target="_blank" rel="noreferrer"
                  className="text-[11px] text-petal underline"
                >
                  Open on TMDB ↗
                </a>
              </div>
            )}
            {showPreview && tmdbId && (
              <div className="rounded-xl overflow-hidden border border-petal/30 bg-black aspect-video mt-2">
                <iframe
                  src={`https://www.vidking.net/embed/${mediaType}/${tmdbId}?color=9146ff`}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            <p className="text-[10px] text-candle-muted">
              Link a TMDB/IMDb title so this entry can stream through VidKing without uploading a file. Uploaded video takes priority when both are set.
            </p>
          </div>

          {/* Episodes manager — only for TV series */}
          {mediaType === "tv" && (
            <div className="rounded-2xl bg-velvet border border-border p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Clapperboard className="size-3.5 text-petal" />
                <label className="text-[10px] uppercase tracking-widest text-petal">
                  Episodes — edit by season & number
                </label>
              </div>
              {!existingId ? (
                <p className="text-xs text-candle-muted">
                  Save this show first — then episodes will appear here so you can edit them one by one.
                </p>
              ) : !tmdbId ? (
                <p className="text-xs text-candle-muted">
                  Add a TMDB TV ID above so seasons and episode metadata can load automatically.
                </p>
              ) : (
                <EpisodesPanel movieId={existingId} tmdbId={tmdbId} compact />
              )}
            </div>
          )}





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

            {!uploading && !videoPath && (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-24 rounded-2xl bg-velvet border border-dashed border-border hover:border-petal/60 hover:bg-petal/5 transition-colors flex flex-col items-center justify-center gap-1 text-sm text-candle"
              >
                <Upload className="size-5 text-petal" />
                <span>Upload video file</span>
                <span className="text-[10px] text-candle-muted">Resumable · any size · mp4, mkv, webm…</span>
              </button>
            )}

            {uploading && (
              <div className="rounded-2xl bg-velvet border border-petal/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="size-4 animate-spin text-petal" />
                  <p className="text-xs text-candle truncate flex-1">{videoFileName}</p>
                  <button
                    onClick={cancelUpload}
                    className="text-[10px] uppercase tracking-widest text-rose-400 hover:text-rose-300"
                  >
                    Cancel
                  </button>
                </div>
                <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                  <div
                    className="h-full bg-petal transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-candle-muted tabular-nums">
                  <span>{uploadPct}% · {fmtBytes((uploadPct / 100) * videoFileSize)} / {fmtBytes(videoFileSize)}</span>
                  <span>{uploadSpeed}{uploadEta ? ` · ${uploadEta} left` : ""}</span>
                </div>
              </div>
            )}

            {videoPath && !uploading && (
              <div className="rounded-2xl bg-petal/10 border border-petal/30 p-3 flex items-center gap-2">
                <div className="size-8 rounded-full bg-petal/20 flex items-center justify-center shrink-0">
                  <Film className="size-4 text-petal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-candle truncate">{videoFileName ?? videoPath}</p>
                  <p className="text-[10px] text-candle-muted">{fmtBytes(videoFileSize)} · Uploaded ✓</p>
                </div>
                <button
                  onClick={() => { setVideoPath(null); setVideoFileName(null); setVideoFileSize(0); fileRef.current?.click(); }}
                  className="text-[10px] uppercase tracking-widest text-petal hover:underline"
                >
                  Replace
                </button>
              </div>
            )}

            {uploadErr && !uploading && (
              <p className="mt-2 text-[10px] text-rose-400">{uploadErr}</p>
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add movie"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Episodes manager (per-episode overrides for series) ─────────────────

type EpisodeRow = {
  id: string;
  movie_id: string;
  season: number;
  episode: number;
  title: string | null;
  overview: string | null;
  still_url: string | null;
  runtime: number | null;
  video_url: string | null;
  video_storage_path: string | null;
  use_vidking: boolean;
};

function EpisodesPanel({ movieId, tmdbId, compact = false }: { movieId: string; tmdbId: number | null; compact?: boolean }) {
  const listFn = useServerFn(listCustomEpisodes);
  const upsertFn = useServerFn(upsertCustomEpisode);
  const delFn = useServerFn(deleteCustomEpisode);
  const tvDetail = useServerFn(tmdbTvDetail);
  const tvSeason = useServerFn(tmdbTvSeason);

  const [seasons, setSeasons] = useState<{ season_number: number; episode_count: number; name: string }[]>([]);
  const [season, setSeason] = useState<number>(1);
  const [tmdbEps, setTmdbEps] = useState<Array<{ episode_number: number; name: string; overview: string | null; still_path: string | null; runtime: number | null }>>([]);
  const [customEps, setCustomEps] = useState<EpisodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [detail, rows] = await Promise.all([
          tmdbId ? tvDetail({ data: { id: tmdbId } }).catch(() => null) : Promise.resolve(null),
          listFn({ data: { movie_id: movieId } }),
        ]);
        if (!alive) return;
        if (detail?.seasons) {
          const s = detail.seasons.filter((x: any) => x.season_number > 0);
          setSeasons(s);
          if (s.length && !s.find((x) => x.season_number === season)) setSeason(s[0].season_number);
        }
        setCustomEps(rows as EpisodeRow[]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId, tmdbId]);

  useEffect(() => {
    if (!tmdbId) { setTmdbEps([]); return; }
    let alive = true;
    (async () => {
      try {
        const eps = await tvSeason({ data: { id: tmdbId, season } });
        if (!alive) return;
        setTmdbEps(eps as any);
      } catch {
        if (alive) setTmdbEps([]);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, season]);

  const overrideMap = useMemo(() => {
    const m = new Map<string, EpisodeRow>();
    for (const r of customEps) m.set(`${r.season}:${r.episode}`, r);
    return m;
  }, [customEps]);

  async function saveOne(patch: Partial<EpisodeRow> & { season: number; episode: number }) {
    const key = `${patch.season}:${patch.episode}`;
    setSavingKey(key);
    try {
      const row = await upsertFn({
        data: {
          movie_id: movieId,
          season: patch.season,
          episode: patch.episode,
          title: patch.title ?? null,
          overview: patch.overview ?? null,
          still_url: patch.still_url ?? null,
          runtime: patch.runtime ?? null,
          video_url: patch.video_url ?? null,
          video_storage_path: patch.video_storage_path ?? null,
          use_vidking: patch.use_vidking ?? true,
        },
      });
      setCustomEps((prev) => {
        const next = prev.filter((r) => !(r.season === patch.season && r.episode === patch.episode));
        next.push(row as EpisodeRow);
        return next;
      });
      toast.success(`Saved S${patch.season}E${patch.episode}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  async function resetOne(row: EpisodeRow) {
    if (!confirm(`Clear overrides for S${row.season}E${row.episode}?`)) return;
    try {
      await delFn({ data: { id: row.id } });
      setCustomEps((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (!tmdbId) {
    return (
      <div className="p-4 rounded-2xl border border-dashed border-border text-center">
        <p className="text-sm text-candle-muted">Set a TMDB TV ID on this show first so episodes can be loaded automatically.</p>
      </div>
    );
  }

  return (
    <div>
      {seasons.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-3"}`}>
          {seasons.map((s) => (
            <button
              key={s.season_number}
              onClick={() => setSeason(s.season_number)}
              className={`h-8 px-3 rounded-full text-xs border transition-colors ${
                season === s.season_number
                  ? "bg-petal text-velvet border-petal"
                  : "bg-surface-elevated border-border text-candle hover:border-petal/40"
              }`}
            >
              S{s.season_number} <span className="opacity-60">· {s.episode_count}</span>
            </button>
          ))}
        </div>
      )}

      {loading && <div className="py-8 text-center text-xs text-candle-muted"><Loader2 className="size-4 animate-spin inline mr-1" /> Loading…</div>}

      {!loading && tmdbEps.length === 0 && (
        <div className="mt-4 p-4 rounded-2xl border border-dashed border-border text-center">
          <p className="text-sm text-candle-muted">No episodes found for this season.</p>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {tmdbEps.map((ep) => {
          const ov = overrideMap.get(`${season}:${ep.episode_number}`);
          const key = `${season}:${ep.episode_number}`;
          const busy = savingKey === key;
          return (
            <EpisodeEditor
              key={key}
              season={season}
              episode={ep.episode_number}
              tmdbName={ep.name}
              tmdbOverview={ep.overview}
              tmdbStill={ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null}
              tmdbRuntime={ep.runtime}
              override={ov ?? null}
              busy={busy}
              onSave={saveOne}
              onReset={ov ? () => resetOne(ov) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function EpisodesModal({ movie, onClose }: { movie: CustomMovie; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-surface border border-border p-5 animate-fade-up">
        <div className="flex items-center justify-between mb-1 gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-petal">Episodes · {movie.title}</p>
            <p className="text-xs text-candle-muted truncate">
              {movie.tmdb_id ? `TMDB TV ${movie.tmdb_id}` : "No TMDB link — set a TMDB ID on the show to auto-load seasons"}
            </p>
          </div>
          <button onClick={onClose} className="size-9 shrink-0 rounded-full bg-surface-elevated flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <EpisodesPanel movieId={movie.id} tmdbId={movie.tmdb_id} />
      </div>
    </div>
  );
}


function EpisodeEditor({
  season, episode, tmdbName, tmdbOverview, tmdbStill, tmdbRuntime,
  override, busy, onSave, onReset,
}: {
  season: number; episode: number;
  tmdbName: string; tmdbOverview: string | null; tmdbStill: string | null; tmdbRuntime: number | null;
  override: EpisodeRow | null;
  busy: boolean;
  onSave: (patch: { season: number; episode: number; title: string | null; overview: string | null; still_url: string | null; runtime: number | null; video_url: string | null; use_vidking: boolean }) => Promise<void>;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(override?.title ?? "");
  const [overview, setOverview] = useState(override?.overview ?? "");
  const [still, setStill] = useState(override?.still_url ?? "");
  const [runtime, setRuntime] = useState<string>(override?.runtime != null ? String(override.runtime) : "");
  const [videoUrl, setVideoUrl] = useState(override?.video_url ?? "");
  const [useVidking, setUseVidking] = useState<boolean>(override?.use_vidking ?? true);

  useEffect(() => {
    setTitle(override?.title ?? "");
    setOverview(override?.overview ?? "");
    setStill(override?.still_url ?? "");
    setRuntime(override?.runtime != null ? String(override.runtime) : "");
    setVideoUrl(override?.video_url ?? "");
    setUseVidking(override?.use_vidking ?? true);
  }, [override?.id]);

  const displayTitle = override?.title || tmdbName;
  const stillSrc = override?.still_url || tmdbStill;

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-2 text-left"
      >
        <div className="w-20 h-12 shrink-0 rounded-lg overflow-hidden bg-velvet">
          {stillSrc ? <img src={stillSrc} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film className="size-4 text-candle-muted" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-candle-muted">S{season}E{episode}{override ? " · edited" : ""}</p>
          <p className="text-sm text-candle truncate">{displayTitle}</p>
        </div>
        <div className="text-[10px] text-candle-muted">{open ? "Close" : "Edit"}</div>
      </button>

      {open && (
        <div className="border-t border-border p-3 space-y-2">
          <TextField label="Title override" value={title} onChange={setTitle} placeholder={tmdbName} />
          <TextField label="Overview override" value={overview} onChange={setOverview} placeholder={tmdbOverview ?? "TMDB overview"} multiline />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Still URL" value={still} onChange={setStill} placeholder="https://..." />
            <TextField label="Runtime (min)" value={runtime} onChange={setRuntime} type="number" placeholder={tmdbRuntime ? String(tmdbRuntime) : ""} />
          </div>
          <TextField label="Video URL (self-hosted)" value={videoUrl} onChange={setVideoUrl} placeholder="https://... .mp4 or .m3u8" />
          <label className="flex items-center gap-2 text-xs text-candle cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useVidking}
              onChange={(e) => setUseVidking(e.target.checked)}
              className="accent-petal size-4"
            />
            Play via VidKing when no video URL is set
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onSave({
                season, episode,
                title: title.trim() || null,
                overview: overview.trim() || null,
                still_url: still.trim() || null,
                runtime: runtime ? Number(runtime) : null,
                video_url: videoUrl.trim() || null,
                use_vidking: useVidking,
              })}
              disabled={busy}
              className="flex-1 h-9 rounded-full bg-petal text-velvet text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3 animate-spin inline" /> : "Save"}
            </button>
            {onReset && (
              <button
                onClick={onReset}
                className="h-9 px-3 rounded-full bg-surface border border-border text-xs text-rose-400 hover:border-rose-500/40"
              >
                Clear overrides
              </button>
            )}
          </div>
        </div>
      )}
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

function fmtBytes(n: number): string {
  if (!n || !isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
