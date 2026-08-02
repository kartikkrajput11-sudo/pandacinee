import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut, Heart, Copy, Camera, Save, Sun, Moon, Monitor, ChevronRight, Lock, Coins, Volume2, VolumeX, Eye, EyeOff, CheckCheck, Check, Compass, Sparkles } from "lucide-react";
import { EditorialPageHeader } from "@/components/editorial/SectionHeader";
import { Button } from "@/components/ui/button";
import {
  SettingsGroup,
  SettingsLinkRow,
  SettingsButtonRow,
  SettingsPanelRow,
} from "@/components/settings/SettingsGroup";

import { isSfxEnabled, setSfxEnabled, sfxReaction } from "@/lib/sfx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useTheme, type ThemeMode } from "@/components/ThemeProvider";
import { CATEGORY_SETTINGS } from "@/lib/punishment";
import { AchievementBadges } from "@/components/AchievementBadges";
import { AvatarImg } from "@/components/AvatarImg";
import { TAG_BY_KEY } from "@/lib/achievements";

export const Route = createFileRoute("/_authenticated/app/me")({
  component: Me,
});

const COLORS = ["#f87171", "#a78bfa", "#f0abfc", "#fcd34d", "#86efac", "#7dd3fc", "#fda4af"];
const MAX_EQUIPPED = 3;

function Me() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [savingUsername, setSavingUsername] = useState(false);
  const [bio, setBio] = useState("");
  const [favoriteColor, setFavoriteColor] = useState<string | null>(null);
  const [equippedTags, setEquippedTags] = useState<string[]>([]);
  const [anniversary, setAnniversary] = useState("");
  const [birthday, setBirthday] = useState("");
  const [partnerNickname, setPartnerNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  


  useEffect(() => {
    if (!me) return;
    setDisplayName(me.display_name ?? "");
    setUsername(me.username ?? "");
    setBio(me.bio ?? "");
    setFavoriteColor(me.favorite_color);
    setEquippedTags(Array.isArray((me as any).equipped_tags) ? ((me as any).equipped_tags as string[]) : []);
    setAnniversary(me.anniversary_date ?? "");
    setBirthday(((me as { birthday?: string | null }).birthday) ?? "");
    setPartnerNickname(me.partner_nickname ?? "");
    setAvatarUrl(me.avatar_url);
  }, [me]);

  // Debounced username availability check
  useEffect(() => {
    if (!me) return;
    const trimmed = username.trim().toLowerCase();
    if (trimmed === (me.username ?? "").toLowerCase()) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      return;
    }
    if (!/^[a-z0-9_.]{3,30}$/.test(trimmed)) {
      setUsernameStatus("invalid");
      setUsernameSuggestions([]);
      return;
    }
    setUsernameStatus("checking");
    const t = window.setTimeout(async () => {
      const { data: available } = await supabase.rpc("is_username_available", { _username: trimmed });
      if (available) {
        setUsernameStatus("available");
        setUsernameSuggestions([]);
      } else {
        setUsernameStatus("taken");
        const { data: sugg } = await supabase.rpc("suggest_usernames", { _base: trimmed, _count: 5 });
        setUsernameSuggestions(Array.isArray(sugg) ? (sugg as string[]) : []);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [username, me]);

  async function saveUsername() {
    if (!me) return;
    const trimmed = username.trim().toLowerCase();
    if (trimmed === (me.username ?? "").toLowerCase()) return;
    if (usernameStatus !== "available") {
      toast.error("Pick an available username first");
      return;
    }
    setSavingUsername(true);
    const { error } = await supabase.from("profiles").update({ username: trimmed }).eq("id", me.id);
    setSavingUsername(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("That username was just taken");
        setUsernameStatus("taken");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Username updated");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

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
        equipped_tags: equippedTags,
        anniversary_date: anniversary || null,
        birthday: birthday || null,
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
      <EditorialPageHeader
        eyebrow="You"
        title="Profile"
        subtitle="Your card in the theatre — name, ambience, and the little details your panda notices."
        leading={
          <Link to="/app" className="text-candle-muted p-2 -ml-2 rounded-full hover:bg-surface transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
        }
      />

      {isLoading || !me ? (
        <div className="text-candle-muted text-sm">Loading…</div>
      ) : (
        <>
          {/* Luxury membership card */}
          <div className="relative mb-6 rounded-[28px] overflow-hidden border border-petal/25 glass-strong shadow-[0_40px_110px_-55px_color-mix(in_oklab,var(--petal)_80%,transparent)]">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full blur-3xl opacity-40"
              style={{ background: `radial-gradient(circle, ${favoriteColor ?? "var(--petal)"}, transparent 70%)` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full blur-3xl opacity-25"
              style={{ background: "radial-gradient(circle, var(--lavender), transparent 70%)" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-card-sheen"
            />

            <div className="relative p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] uppercase tracking-[0.4em] text-petal">Pandacine · Member</p>
                <span className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">
                  {partner ? "Paired" : "Solo"}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="relative size-20 rounded-2xl bg-petal-soft border border-petal/30 flex items-center justify-center overflow-hidden group shrink-0"
                >
                  {avatarUrl ? (
                    <AvatarImg src={avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-serif text-3xl italic text-petal">
                      {me.display_name?.[0]?.toUpperCase() ?? "🐼"}
                    </span>
                  )}
                  <span className="absolute inset-0 bg-velvet/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="size-5 text-candle" />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-2xl italic truncate leading-tight">{me.display_name}</p>
                  <p className="text-sm text-candle-muted truncate">@{me.username}</p>
                  {me.bio && (
                    <p className="text-xs text-candle-muted/80 italic truncate mt-1">{me.bio}</p>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <Stat label="Coins" value={String((me as any).coins ?? 0)} />
                <Stat
                  label="Together"
                  value={
                    me.anniversary_date || me.paired_at
                      ? `${Math.max(
                          0,
                          Math.floor(
                            (Date.now() - new Date((me.anniversary_date || me.paired_at) as string).getTime()) /
                              86400000,
                          ),
                        )}d`
                      : "—"
                  }
                />
                <Stat label="Mood" value={me.mood_emoji ?? "💭"} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-border/60">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">Invite code</p>
                  <p className="font-mono text-sm text-candle tracking-[0.2em] truncate">{me.invite_code}</p>
                </div>
                <button
                  onClick={copyCode}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-petal/40 text-petal text-[10px] uppercase tracking-[0.24em] hover:bg-petal/10 transition"
                >
                  <Copy className="size-3" /> Copy
                </button>
              </div>
            </div>
          </div>
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


          <Link
            to="/app/shop"
            className="flex items-center justify-between p-3 mb-4 rounded-2xl border border-petal/30 bg-petal-soft/40 hover:bg-petal-soft/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Coins className="size-5 text-petal" />
              <span className="font-semibold text-petal">{(me as any).coins ?? 0} coins</span>
            </div>
            <span className="text-xs text-petal inline-flex items-center gap-1">
              Tag shop <ChevronRight className="size-3" />
            </span>
          </Link>

          <div data-tour="me-badges"><AchievementBadges userId={me.id} equippedOnly /></div>

          <EquipTagsSection
            userId={me.id}
            equipped={equippedTags}
            onChange={setEquippedTags}
          />



          <div className="space-y-3 mb-4">
            <Field label="Display name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-velvet border border-border rounded-2xl px-4 py-3 text-candle"
              />
            </Field>
            <Field label="Username">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-candle-muted">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  maxLength={30}
                  className={`w-full bg-velvet border rounded-2xl pl-8 pr-24 py-3 text-candle ${
                    usernameStatus === "taken" || usernameStatus === "invalid"
                      ? "border-destructive"
                      : usernameStatus === "available"
                      ? "border-emerald-500/60"
                      : "border-border"
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                  {usernameStatus === "checking" && <span className="text-candle-muted">checking…</span>}
                  {usernameStatus === "available" && <span className="text-emerald-500">✓ available</span>}
                  {usernameStatus === "taken" && <span className="text-destructive">taken</span>}
                  {usernameStatus === "invalid" && username.length > 0 && (
                    <span className="text-destructive">3–30 · a–z 0–9 _ .</span>
                  )}
                </div>
              </div>
              {usernameStatus === "taken" && usernameSuggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] text-candle-muted mb-1.5">Try one of these:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {usernameSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setUsername(s)}
                        className="px-2.5 py-1 text-xs rounded-full bg-petal-soft/60 border border-petal/30 text-petal hover:bg-petal-soft transition-colors"
                      >
                        @{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {usernameStatus === "available" && (
                <button
                  type="button"
                  onClick={saveUsername}
                  disabled={savingUsername}
                  className="mt-2 px-3 py-1.5 text-xs rounded-full bg-petal text-velvet font-semibold disabled:opacity-60"
                >
                  {savingUsername ? "Saving…" : "Save username"}
                </button>
              )}
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
            <Field label="Your birthday">
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
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
          </div>


          <Button onClick={save} disabled={saving} variant="petal" size="block" className="mb-6">
            <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
          </Button>

          <SettingsGroup title="Appearance & sound">
            <SettingsPanelRow>
              <ThemeSection />
            </SettingsPanelRow>
            <SoundToggle />
          </SettingsGroup>

          <SettingsGroup title="Privacy" hint="Only affects what your panda sees">
            <ActivityVisibleToggle me={me} onSaved={() => queryClient.invalidateQueries({ queryKey: ["profile"] })} />
            <ReadReceiptsToggle me={me} onSaved={() => queryClient.invalidateQueries({ queryKey: ["profile"] })} />
            <PunishmentLockToggle me={me} onSaved={() => queryClient.invalidateQueries({ queryKey: ["profile"] })} />
          </SettingsGroup>

          <SettingsGroup title="Your space">
            <SettingsLinkRow
              to="/app/partner"
              icon={<Heart className="size-4" />}
              label={partner ? partnerNickname || partner.display_name : "Invite your partner"}
              description={partner ? "Nickname, anniversary & pairing" : "Share your code to begin"}
            />
            <SettingsLinkRow
              to="/app/help"
              icon={<span className="text-base">📖</span>}
              label="Help & guide"
              description="How everything works · FAQ · Contact"
            />
            <SettingsButtonRow
              onClick={() => window.dispatchEvent(new CustomEvent("pandacine:open-tour"))}
              icon={<Compass className="size-4" />}
              label="Take the guided tour"
              description="A walk-through of every feature"
            />
            <SettingsButtonRow
              onClick={() => window.dispatchEvent(new Event("pandacine:anniv-test"))}
              icon={<span className="text-base">🥂</span>}
              label="Preview Anniversary Day"
              description="Try Nocturne mode before the date"
            />
          </SettingsGroup>

          <SettingsGroup title="Invite">
            <SettingsPanelRow>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-petal">Your invite code</p>
                  <p className="font-serif text-3xl italic tracking-widest text-candle truncate">{me.invite_code}</p>
                </div>
                <Button onClick={copyCode} variant="railIcon" size="tile" aria-label="Copy code">
                  <Copy className="size-4" />
                </Button>
              </div>
            </SettingsPanelRow>
          </SettingsGroup>

          <SettingsGroup title="Account">
            <SettingsButtonRow
              onClick={signOut}
              icon={<LogOut className="size-4" />}
              label="Sign out"
              description="You'll need your email to return"
              trailing={<span />}
            />
          </SettingsGroup>

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

function EquipTagsSection({
  userId,
  equipped,
  onChange,
}: {
  userId: string;
  equipped: string[];
  onChange: (next: string[]) => void;
}) {
  const [owned, setOwned] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("profile_achievements")
        .select("tag_key,acquired_at")
        .eq("user_id", userId)
        .order("acquired_at", { ascending: true });
      if (!cancelled) setOwned(((data ?? []) as any[]).map((r) => r.tag_key));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (owned.length === 0) return null;

  function toggle(key: string) {
    if (equipped.includes(key)) {
      onChange(equipped.filter((k) => k !== key));
      return;
    }
    if (equipped.length >= MAX_EQUIPPED) {
      toast.error(`You can equip up to ${MAX_EQUIPPED} tags`);
      return;
    }
    onChange([...equipped, key]);
  }

  return (
    <div className="p-5 mb-4 rounded-3xl border border-border bg-surface">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-petal">Equip tags</p>
        <p className="text-[10px] text-candle-muted">{equipped.length} / {MAX_EQUIPPED}</p>
      </div>
      <p className="text-xs text-candle-muted mb-3">Choose which tags appear on your profile. Tap to equip or remove.</p>
      <div className="flex flex-wrap gap-2">
        {owned.map((k) => {
          const t = TAG_BY_KEY[k];
          if (!t) return null;
          const on = equipped.includes(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: on ? `radial-gradient(circle at 30% 30%, ${t.hue}40, ${t.hue}15)` : "transparent",
                border: `1px solid ${on ? t.hue + "aa" : t.hue + "44"}`,
                color: t.hue,
                boxShadow: on ? `0 0 14px -4px ${t.hue}` : "none",
                opacity: on ? 1 : 0.65,
              }}
            >
              <span className="text-sm">{t.emoji}</span>
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeSection() {
  const { mode, setMode } = useTheme();
  const options: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { id: "default", label: "Velvet", Icon: Sparkles },
    { id: "dark", label: "Midnight", Icon: Moon },
    { id: "light", label: "Light", Icon: Sun },
  ];
  return (
    <div>
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

function SoundToggle() {
  const [on, setOn] = useState<boolean>(() => isSfxEnabled());
  function toggle() {
    const next = !on;
    setOn(next);
    setSfxEnabled(next);
    if (next) sfxReaction();
    toast.success(next ? "Sound effects on" : "Sound effects muted");
  }
  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-petal-soft/10 disabled:opacity-60"
    >
      {on ? <Volume2 className="size-5 text-petal" /> : <VolumeX className="size-5 text-candle-muted" />}
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-widest text-petal">Sound effects</p>
        <p className="text-sm text-candle">{on ? "On — pings, kisses & alerts" : "Muted — silence across the app"}</p>
      </div>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-petal" : "bg-velvet border border-border"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

function ActivityVisibleToggle({ me, onSaved }: { me: any; onSaved: () => void }) {
  const on = me?.activity_visible !== false;
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const next = !on;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ activity_visible: next })
      .eq("id", me.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(next ? "Activity status visible" : "Activity status hidden");
    onSaved();
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-petal-soft/10 disabled:opacity-60"
    >
      {on ? <Eye className="size-5 text-petal" /> : <EyeOff className="size-5 text-candle-muted" />}
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-widest text-petal">Activity status</p>
        <p className="text-sm text-candle">
          {on ? "Partner sees when you're online & last active" : "Hidden — no online dot or last-seen time"}
        </p>
      </div>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-petal" : "bg-velvet border border-border"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}


function ReadReceiptsToggle({ me, onSaved }: { me: any; onSaved: () => void }) {
  const on = me?.read_receipts_enabled !== false;
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const next = !on;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ read_receipts_enabled: next })
      .eq("id", me.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(next ? "Seen receipts on" : "Seen receipts off");
    onSaved();
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-petal-soft/10 disabled:opacity-60"
    >
      {on ? <CheckCheck className="size-5 text-petal" /> : <Check className="size-5 text-candle-muted" />}
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-widest text-petal">Seen receipts</p>
        <p className="text-sm text-candle">
          {on ? "Partner sees when you've read their messages" : "Hidden — partner won't see 'seen' on their messages"}
        </p>
      </div>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-petal" : "bg-velvet border border-border"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}



function PunishmentLockToggle({ me, onSaved }: { me: any; onSaved: () => void }) {
  const enabled = me?.punishment_lock_enabled ?? true;
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  async function toggle() {
    setBusy(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ punishment_lock_enabled: !enabled })
      .eq("id", me.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(!enabled ? "Punishment Lock enabled" : "Punishment Lock disabled");
      onSaved();
    }
  }
  async function toggleCat(key: string, current: boolean) {
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ [key]: !current })
      .eq("id", me.id);
    if (error) toast.error(error.message);
    else onSaved();
  }
  return (
    <div className="px-4 py-4">
      <button
        type="button"
        onClick={() => enabled && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 text-left"
      >
        <Lock className="size-5 text-petal" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-petal">Punishment Lock</p>
          <p className="text-xs text-candle-muted">
            Let your partner playfully lock your chat with a challenge.
          </p>
        </div>
        {enabled && (
          <ChevronRight
            className={`size-4 text-candle-muted transition-transform ${open ? "rotate-90" : ""}`}
          />
        )}
        <span
          role="switch"
          aria-checked={enabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) toggle();
          }}
          className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer ${enabled ? "bg-petal" : "bg-border"}`}
        >
          <span
            className={`absolute top-0.5 size-6 rounded-full bg-white transition-all ${
              enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </span>
      </button>

      {enabled && open && (
        <div className="mt-4 pt-4 border-t border-border space-y-2 animate-fade-in">
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">Allowed challenge categories</p>
          {CATEGORY_SETTINGS.map((c) => {
            const val = (me as any)?.[c.key] !== false;
            return (
              <label key={c.key} className="flex items-center gap-3 py-1.5 cursor-pointer">
                <span className="text-lg">{c.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-candle">{c.label}</span>
                  <span className="block text-[10px] text-candle-muted">{c.description}</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleCat(c.key, val)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${val ? "bg-petal" : "bg-border"}`}
                  aria-pressed={val}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
                      val ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
            );
          })}
          <p className="text-[10px] text-candle-muted mt-2">
            Categories are allowed only when both partners have them enabled.
          </p>
        </div>
      )}
    </div>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-velvet/40 px-3 py-2.5 text-center">
      <p className="font-serif italic text-lg text-candle leading-none truncate">{value}</p>
      <p className="text-[9px] uppercase tracking-[0.24em] text-candle-muted mt-1.5">{label}</p>
    </div>
  );
}
