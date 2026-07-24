import { useEffect, useMemo, useState } from "react";
import { EyeOff, Eye, Upload, Trash2, Sparkles, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PANDA_STICKERS, PANDA_CATEGORY_ORDER, type PandaStickerCategory } from "@/lib/panda-stickers";
import { useStickerOverrides } from "@/hooks/useStickerOverrides";
import { refreshStickerOverrides } from "@/lib/sticker-overrides";

export default function StickersTab() {
  const { hidden, customs } = useStickerOverrides();
  const [filter, setFilter] = useState<PandaStickerCategory | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(
    () => filter === "all" ? PANDA_STICKERS : PANDA_STICKERS.filter((s) => s.category === filter),
    [filter]
  );

  async function toggleHide(id: string, isHidden: boolean) {
    setBusy(id);
    try {
      if (isHidden) {
        await supabase.from("sticker_admin").delete().eq("kind", "hide").eq("sticker_id", id);
      } else {
        await supabase.from("sticker_admin").insert({ kind: "hide", sticker_id: id });
      }
      await refreshStickerOverrides();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface/60 backdrop-blur p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-petal" />
          <h2 className="font-serif italic text-xl">Upload a custom sticker</h2>
        </div>
        <UploadCustomSticker onDone={refreshStickerOverrides} />
      </section>

      {customs.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-widest text-candle-muted mb-3">Custom stickers · {customs.length}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {customs.map((c) => (
              <CustomStickerCard key={c.id} sticker={c} onDeleted={refreshStickerOverrides} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-xs uppercase tracking-widest text-candle-muted">Built-in stickers · {PANDA_STICKERS.length}</h3>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
            {PANDA_CATEGORY_ORDER.map((c) => (
              <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
                {c.emoji} {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
          {list.map((s) => {
            const isHidden = hidden.has(s.id);
            return (
              <div key={s.id} className={`relative rounded-2xl border p-2.5 bg-surface/40 flex flex-col items-center gap-2 transition ${isHidden ? "border-rose-500/40 opacity-60" : "border-border"}`}>
                <img src={s.url} alt={s.label} className="size-16 object-contain" draggable={false} />
                <div className="text-[10px] text-candle-muted text-center leading-tight line-clamp-1">{s.label}</div>
                <button
                  onClick={() => toggleHide(s.id, isHidden)}
                  disabled={busy === s.id}
                  className={`w-full h-7 text-[10px] rounded-full flex items-center justify-center gap-1 font-semibold transition ${isHidden ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"}`}
                >
                  {busy === s.id ? <Loader2 className="size-3 animate-spin" /> : isHidden ? <><Eye className="size-3" /> Show</> : <><EyeOff className="size-3" /> Hide</>}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-semibold transition ${active ? "bg-petal text-velvet" : "bg-surface border border-border text-candle-muted hover:text-candle"}`}
    >
      {children}
    </button>
  );
}

function CustomStickerCard({ sticker, onDeleted }: { sticker: { id: string; url: string; label: string; category: string }; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!confirm(`Delete "${sticker.label}" completely?`)) return;
    setBusy(true);
    try {
      // Try to delete stored file if we can derive the path
      const { data: row } = await supabase.from("sticker_admin").select("image_url").eq("sticker_id", sticker.id).eq("kind", "custom").maybeSingle();
      const rawPath = row?.image_url as string | undefined;
      if (rawPath && !/^https?:/i.test(rawPath)) {
        await supabase.storage.from("stickers").remove([rawPath]);
      }
      await supabase.from("sticker_admin").delete().eq("kind", "custom").eq("sticker_id", sticker.id);
      toast.success("Deleted");
      onDeleted();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setBusy(false); }
  }
  return (
    <div className="rounded-2xl border border-petal/30 bg-petal/5 p-2.5 flex flex-col items-center gap-2">
      <img src={sticker.url} alt={sticker.label} className="size-16 object-contain" draggable={false} />
      <div className="text-[10px] text-candle-muted text-center leading-tight line-clamp-1">{sticker.label}</div>
      <button onClick={remove} disabled={busy} className="w-full h-7 text-[10px] rounded-full bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 flex items-center justify-center gap-1 font-semibold">
        {busy ? <Loader2 className="size-3 animate-spin" /> : <><Trash2 className="size-3" /> Remove</>}
      </button>
    </div>
  );
}

function UploadCustomSticker({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<PandaStickerCategory>("playful");
  const [uploading, setUploading] = useState(false);
  const preview = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit() {
    if (!file) return toast.error("Choose an image first");
    if (!label.trim()) return toast.error("Give it a label");
    setUploading(true);
    try {
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || crypto.randomUUID().slice(0, 8);
      const stickerId = `custom-${slug}-${crypto.randomUUID().slice(0, 6)}`;
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${stickerId}.${ext}`;
      const up = await supabase.storage.from("stickers").upload(path, file, { upsert: false, contentType: file.type || "image/png" });
      if (up.error) throw up.error;
      const ins = await supabase.from("sticker_admin").insert({
        kind: "custom",
        sticker_id: stickerId,
        label: label.trim(),
        category,
        image_url: path,
      });
      if (ins.error) throw ins.error;
      toast.success("Sticker added");
      setFile(null); setLabel("");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally { setUploading(false); }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[auto,1fr] items-start">
      <label className="relative size-28 rounded-2xl border-2 border-dashed border-border bg-surface/60 flex items-center justify-center cursor-pointer overflow-hidden hover:border-petal/50 transition">
        {preview ? (
          <img src={preview} alt="preview" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-candle-muted text-xs flex flex-col items-center gap-1">
            <Upload className="size-5" />
            <span>PNG / WebP</span>
          </div>
        )}
        <input type="file" accept="image/png,image/webp,image/jpeg,image/gif" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="space-y-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Panda hug)"
          className="w-full h-10 rounded-xl bg-surface border border-border px-3 text-sm outline-none focus:border-petal"
        />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {PANDA_CATEGORY_ORDER.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold transition ${category === c.id ? "bg-petal text-velvet" : "bg-surface border border-border text-candle-muted"}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={uploading || !file || !label.trim()}
          className="h-10 px-4 rounded-xl bg-petal text-velvet font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add sticker
        </button>
      </div>
    </div>
  );
}
