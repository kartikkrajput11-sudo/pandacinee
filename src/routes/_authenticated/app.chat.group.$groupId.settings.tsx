import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, X, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useGroup } from "@/hooks/useGroups";
import { useUpdateGroup, GROUP_THEMES, type GroupTheme } from "@/hooks/useGroupAdmin";

const AVATAR_EMOJIS = ["💜", "🐼", "🌸", "🌙", "🍿", "🎬", "🦋", "🍓", "🌈", "🪐"];

export const Route = createFileRoute("/_authenticated/app/chat/group/$groupId/settings")({
  component: GroupSettings,
});

function GroupSettings() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const { data: groupData } = useGroup(groupId);
  const update = useUpdateGroup();

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [uploadingBg, setUploadingBg] = useState(false);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const me = profileData?.profile;
  const group = groupData?.group;
  const members = groupData?.members ?? [];
  const meRole = members.find((m) => m.user_id === me?.id)?.role;
  const isAdmin = meRole === "admin";

  const bgPath = (group as any)?.background_url as string | null | undefined;

  useEffect(() => {
    let alive = true;
    if (!bgPath) { setBgPreview(null); return; }
    supabase.storage.from("group-backgrounds").createSignedUrl(bgPath, 60 * 60).then(({ data }) => {
      if (alive) setBgPreview(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [bgPath]);

  useEffect(() => {
    if (group && !isAdmin) {
      toast.error("Only admins can edit group settings");
      navigate({ to: "/app/chat/group/$groupId/info", params: { groupId } });
    }
  }, [group, isAdmin, groupId, navigate]);

  if (!group) return <div className="p-6 text-candle-muted">Loading…</div>;
  if (!isAdmin) return null;

  async function saveName() {
    if (!nameDraft.trim()) return;
    try {
      await update.mutateAsync({ groupId, name: nameDraft });
      toast.success("Renamed");
      setRenaming(false);
    } catch (e: any) {
      toast.error(e.message ?? "Rename failed");
    }
  }

  async function pickEmoji(em: string) {
    try {
      await update.mutateAsync({ groupId, avatar_url: em });
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function pickTheme(theme: GroupTheme) {
    try {
      await update.mutateAsync({ groupId, theme });
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function uploadBackground(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please pick an image"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8 MB"); return; }
    setUploadingBg(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${groupId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("group-backgrounds")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      if (bgPath && bgPath !== path) {
        await supabase.storage.from("group-backgrounds").remove([bgPath]).catch(() => {});
      }
      await update.mutateAsync({ groupId, background_url: path });
      toast.success("Background updated");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploadingBg(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeBackground() {
    if (!bgPath) return;
    try {
      await supabase.storage.from("group-backgrounds").remove([bgPath]).catch(() => {});
      await update.mutateAsync({ groupId, background_url: null });
      toast.success("Background removed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  return (
    <div className="min-h-[100dvh]" data-group-theme={group.theme}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Link to="/app/chat/group/$groupId" params={{ groupId }} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-serif italic text-xl">Group settings</h1>
      </header>

      <div className="p-5 space-y-6">
        {/* Name */}
        <section>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Name</p>
          {renaming ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={40}
                className="flex-1 bg-surface border border-border rounded-2xl px-4 py-2 text-sm text-candle"
              />
              <button onClick={saveName} className="size-9 rounded-full bg-petal text-velvet flex items-center justify-center">
                <Check className="size-4" />
              </button>
              <button onClick={() => setRenaming(false)} className="size-9 rounded-full bg-surface border border-border text-candle-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNameDraft(group.name); setRenaming(true); }}
              className="w-full text-left px-4 py-3 bg-surface/60 border border-border rounded-2xl font-serif italic text-lg"
            >
              {group.name}
            </button>
          )}
        </section>

        {/* Avatar */}
        <section>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Avatar</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => pickEmoji(e)}
                className={`size-10 rounded-full flex items-center justify-center text-lg shrink-0 transition ${
                  group.avatar_url === e ? "bg-petal text-velvet scale-110" : "bg-surface border border-border"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </section>

        {/* Theme */}
        <section>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {GROUP_THEMES.map((t) => {
              const active = group.theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => pickTheme(t.id)}
                  className={`p-3 rounded-2xl border text-left transition ${
                    active ? "border-petal bg-petal-soft/30" : "border-border bg-surface/40"
                  }`}
                >
                  <div className="flex gap-1 mb-1.5">
                    {t.swatch.map((c) => (
                      <span key={c} className="size-3 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-xs font-serif italic">{t.emoji} {t.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Background */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">Background photo</p>
            {bgPath && (
              <button onClick={removeBackground} className="text-[10px] text-red-400 flex items-center gap-1">
                <Trash2 className="size-3" /> Remove
              </button>
            )}
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-border aspect-[16/9] bg-surface/40 flex items-center justify-center">
            {bgPreview ? (
              <img src={bgPreview} alt="Group background" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-candle-muted font-serif italic">No custom photo — theme colors will be used</div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingBg}
              className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-petal text-velvet text-xs font-semibold shadow-lg disabled:opacity-60"
            >
              <ImagePlus className="size-3.5" />
              {uploadingBg ? "Uploading…" : bgPath ? "Change" : "Upload photo"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadBackground(f);
            }}
          />
        </section>
      </div>
    </div>
  );
}
