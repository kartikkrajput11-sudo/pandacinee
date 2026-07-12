import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ShieldCheck, Plus, Film, Trash2, Upload, Play, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { claimAdmin, createCustomMovie, deleteCustomMovie } from "@/lib/admin.functions";

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

function AdminDashboard() {
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
    <div className="pt-10 px-5 pb-24 max-w-3xl mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app/me" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Admin</p>
          <h1 className="font-serif text-3xl italic">Your library</h1>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="h-10 px-4 rounded-full bg-petal text-velvet text-sm font-semibold flex items-center gap-1.5"
        >
          <Plus className="size-4" /> Add movie
        </button>
      </header>

      {isLoading && <div className="text-candle-muted text-sm">Loading…</div>}

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
