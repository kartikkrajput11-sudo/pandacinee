import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut, Heart, Copy, Camera, Save, Sun, Moon, Monitor, ShieldCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useTheme, type ThemeMode } from "@/components/ThemeProvider";

export const Route = createFileRoute("/_authenticated/app/me")({
  component: Me,
});

const EMOJIS = ["🐼", "❤️", "🌙", "✨", "🌸", "🍓", "🦋", "☕", "🎬", "🌊"];
const COLORS = ["#f87171", "#a78bfa", "#f0abfc", "#fcd34d", "#86efac", "#7dd3fc", "#fda4af"];

function Me() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [favoriteColor, setFavoriteColor] = useState<string | null>(null);
  const [favoriteEmoji, setFavoriteEmoji] = useState<string | null>(null);
  const [anniversary, setAnniversary] = useState("");
  const [partnerNickname, setPartnerNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.display_name ?? "");
    setBio(me.bio ?? "");
    setFavoriteColor(me.favorite_color);
    setFavoriteEmoji(me.favorite_emoji);
    setAnniversary(me.anniversary_date ?? "");
    setPartnerNickname(me.partner_nickname ?? "");
    setAvatarUrl(me.avatar_url);
  }, [me]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!me?.avatar_url) return;
      if (me.avatar_url.startsWith("http")) {
        setAvatarUrl(me.avatar_url);
        return;
      }
      const { data } = await supabase.storage.from("avatars").createSignedUrl(me.avatar_url, 3600);
      if (active && data?.signedUrl) setAvatarUrl(data.signedUrl);
    })();
    return () => {
      active = false;
    };
  }, [me?.avatar_url]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function copyCode() {
    if (!me) return;
    await navigator.clipboard.writeText(me.invite_code);
    toast.success("Invite code copied");
  }

  async function save() {
    if (!me) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || me.display_name,
        bio: bio || null,
        favorite_color: favoriteColor,
        favorite_emoji: favoriteEmoji,
        anniversary_date: anniversary || null,
        partner_nickname: partnerNickname || null,
      })
      .eq("id", me.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  }

  async function uploadAvatar(file: File) {
    if (!me) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${me.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", me.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Avatar updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  }

  return (
    <div className="pt-10 px-5">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-serif text-2xl italic">Profile</h1>
      </header>

      {isLoading || !me ? (
        <div className="text-candle-muted text-sm">Loading…</div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative size-20 rounded-full bg-petal-soft border border-petal/20 flex items-center justify-center overflow-hidden group"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif text-3xl italic text-petal">
                  {me.display_name?.[0]?.toUpperCase() ?? "🐼"}
                </span>
              )}
              <span className="absolute inset-0 bg-velvet/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="size-5 text-candle" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-2xl italic truncate">{me.display_name}</p>
              <p className="text-sm text-candle-muted truncate">@{me.username}</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <Field label="Display name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-velvet border border-border rounded-2xl px-4 py-3 text-candle"
              />
            </Field>
            <Field label="Bio">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A little about you…"
                rows={2}
                className="w-full bg-velvet border border-border rounded-2xl px-4 py-3 text-candle resize-none"
              />
            </Field>
            <Field label="Anniversary date">
              <input
                type="date"
                value={anniversary}
                onChange={(e) => setAnniversary(e.target.value)}
                className="w-full bg-velvet border border-border rounded-2xl px-4 py-3 text-candle"
              />
            </Field>
            <Field label="Nickname for your partner">
              <input
                value={partnerNickname}
                onChange={(e) => setPartnerNickname(e.target.value)}
                placeholder="bubu, panda, mi amor…"
                className="w-full bg-velvet border border-border rounded-2xl px-4 py-3 text-candle"
              />
            </Field>
            <Field label="Favorite color">
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFavoriteColor(c)}
                    className={`size-9 rounded-full border-2 transition-all ${
                      favoriteColor === c ? "border-candle scale-110" : "border-transparent"
                    }`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </Field>
            <Field label="Favorite emoji">
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setFavoriteEmoji(e)}
                    className={`size-10 rounded-2xl border bg-velvet text-xl transition-all ${
                      favoriteEmoji === e ? "border-petal scale-110" : "border-border"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full mb-6 py-3.5 bg-petal text-velvet rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
          </button>

          <ThemeSection />

          <Link to="/app/partner" className="p-5 mb-4 rounded-3xl border border-border bg-surface flex items-center gap-3 hover:border-petal/40 transition-colors">
            <Heart className="size-5 text-petal" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-petal">Partner</p>
              {partner ? (
                <p className="font-serif italic text-lg truncate">{partnerNickname || partner.display_name}</p>
              ) : (
                <p className="text-sm text-candle-muted">Invite your partner</p>
              )}
            </div>
            <ChevronRight className="size-4 text-candle-muted" />
          </Link>

          {(me as any)?.is_admin && (
            <Link to="/app/admin" className="p-5 mb-4 rounded-3xl border border-petal/30 bg-petal-soft/10 flex items-center gap-3">
              <ShieldCheck className="size-5 text-petal" />
              <div className="flex-1"><p className="text-[10px] uppercase tracking-widest text-petal">Admin</p><p className="text-sm text-candle">Manage custom movies</p></div>
              <ChevronRight className="size-4 text-candle-muted" />
            </Link>
          )}
          {!(me as any)?.is_admin && (
            <Link to="/app/admin" className="p-5 mb-4 rounded-3xl border border-border bg-surface flex items-center gap-3">
              <ShieldCheck className="size-5 text-candle-muted" />
              <div className="flex-1"><p className="text-[10px] uppercase tracking-widest text-candle-muted">Admin</p><p className="text-sm text-candle-muted">Enter PIN to unlock</p></div>
              <ChevronRight className="size-4 text-candle-muted" />
            </Link>
          )}

          <Link to="/app/help" className="p-5 mb-4 rounded-3xl border border-border bg-surface flex items-center gap-3 hover:border-petal/40 transition-colors">
            <span className="text-xl">📖</span>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-candle-muted">Help & guide</p>
              <p className="text-sm text-candle">How everything works · FAQ · Contact</p>
            </div>
            <ChevronRight className="size-4 text-candle-muted" />
          </Link>

          <button
            onClick={() => {
              window.localStorage.removeItem("pandacine-onboarded-v1");
              window.location.reload();
            }}
            className="w-full p-5 mb-4 rounded-3xl border border-border bg-surface flex items-center gap-3 text-left hover:border-petal/40 transition-colors"
          >
            <span className="text-xl">🐼</span>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-candle-muted">Onboarding</p>
              <p className="text-sm text-candle">Replay the intro tour</p>
            </div>
            <ChevronRight className="size-4 text-candle-muted" />
          </button>


          <div className="p-5 rounded-3xl border border-border bg-surface mb-4">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Your invite code</p>
            <div className="flex items-center justify-between gap-3">
              <p className="font-serif text-3xl italic tracking-widest text-candle">{me.invite_code}</p>
              <button
                onClick={copyCode}
                className="size-10 rounded-full bg-velvet border border-border flex items-center justify-center text-candle-muted hover:text-petal"
                aria-label="Copy code"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>

          <button
            onClick={signOut}
            className="w-full py-3.5 bg-surface border border-border rounded-2xl text-candle text-sm font-medium flex items-center justify-center gap-2 hover:border-petal/40 transition-colors"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-petal mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ThemeSection() {
  const { mode, setMode } = useTheme();
  const options: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { id: "light", label: "Light", Icon: Sun },
    { id: "dark", label: "Dark", Icon: Moon },
    { id: "system", label: "System", Icon: Monitor },
  ];
  return (
    <div className="p-5 mb-4 rounded-3xl border border-border bg-surface">
      <p className="text-[10px] uppercase tracking-widest text-petal mb-3">Appearance</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex flex-col items-center gap-1 py-3 rounded-2xl border text-xs transition-colors ${
              mode === id ? "border-petal bg-petal-soft/20 text-petal" : "border-border bg-velvet text-candle-muted"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
