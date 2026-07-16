import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lock, Feather, Plus, Sparkles, X, Clock, Image as ImageIcon, Mic, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { draftLoveLetter } from "@/lib/letters.functions";
import { PandacineWaxSeal } from "@/components/PandacineWaxSeal";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { uploadChatMedia, signMedia } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/app/letters/")({
  component: LettersRoute,
});

type Letter = {
  id: string;
  sender_id: string;
  recipient_id: string;
  title: string;
  body: string;
  voice_url: string | null;
  theme: "gold" | "rose" | "ivory" | "emerald";
  unlock_at: string;
  opened_at: string | null;
  created_at: string;
};

const THEMES: { id: Letter["theme"]; label: string; swatch: string; ring: string }[] = [
  { id: "gold", label: "Gold", swatch: "bg-gradient-to-br from-[#c9a84c] to-[#f0d78c]", ring: "ring-[#c9a84c]" },
  { id: "rose", label: "Rose", swatch: "bg-gradient-to-br from-[#c96b7a] to-[#f0c0cc]", ring: "ring-[#c96b7a]" },
  { id: "ivory", label: "Ivory", swatch: "bg-gradient-to-br from-[#f5f0e6] to-[#e8dcc4]", ring: "ring-[#c9b590]" },
  { id: "emerald", label: "Emerald", swatch: "bg-gradient-to-br from-[#0d7a5f] to-[#c9a84c]", ring: "ring-[#0d7a5f]" },
];

function LettersRoute() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [letters, setLetters] = useState<Letter[]>([]);
  const [composing, setComposing] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!me) return;
    setLoading(true);
    const { data: rows } = await (supabase as any)
      .from("love_letters")
      .select("*")
      .order("unlock_at", { ascending: false });
    setLetters((rows ?? []) as Letter[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("love-letters")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "love_letters" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const sealed = letters.filter((l) => !l.opened_at);
  const opened = letters.filter((l) => l.opened_at);

  return (
    <div className="pt-10 px-5 pb-24 relative">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Private</p>
          <h1 className="font-serif text-2xl italic">Love Letters</h1>
        </div>
        {partner && (
          <button
            onClick={() => setComposing(true)}
            className="size-10 rounded-2xl bg-petal text-velvet flex items-center justify-center petal-glow"
            aria-label="Write a new letter"
          >
            <Feather className="size-4" />
          </button>
        )}
      </header>

      {!partner && (
        <div className="p-5 mb-5 rounded-3xl border border-petal/30 bg-petal-soft">
          <p className="text-sm text-candle">
            Letters are meant for one person. <Link to="/app/invite" className="text-petal underline">Pair with your panda →</Link>
          </p>
        </div>
      )}

      {loading && partner && (
        <p className="text-sm text-candle-muted italic">Opening the vault…</p>
      )}

      {!loading && partner && letters.length === 0 && (
        <div className="p-6 rounded-3xl glass-strong text-center">
          <p className="font-serif italic text-xl mb-1">The vault is quiet.</p>
          <p className="text-sm text-candle-muted mb-4">
            Write a letter today. Seal it. Choose the day it opens.
          </p>
          <button
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-petal text-velvet rounded-full font-semibold"
          >
            <Feather className="size-4" /> Begin
          </button>
        </div>
      )}

      {sealed.length > 0 && (
        <section className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-3 px-1">
            Sealed · {sealed.length}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {sealed.map((l) => (
              <LetterTile key={l.id} letter={l} me={me!.id} />
            ))}
          </div>
        </section>
      )}

      {opened.length > 0 && (
        <section>
          <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-3 px-1">
            Opened · {opened.length}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {opened.map((l) => (
              <LetterTile key={l.id} letter={l} me={me!.id} />
            ))}
          </div>
        </section>
      )}

      {composing && partner && me && (
        <Composer
          me={me.id}
          partnerId={partner.id}
          partnerName={data?.profile?.partner_nickname || partner.display_name}
          anniversaryDate={data?.profile?.anniversary_date ?? null}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}

function LetterTile({ letter, me }: { letter: Letter; me: string }) {
  const unlockAt = new Date(letter.unlock_at);
  const sealed = !letter.opened_at;
  const stillLocked = sealed && unlockAt > new Date();
  const mine = letter.sender_id === me;
  const themeMeta = THEMES.find((t) => t.id === letter.theme) ?? THEMES[0];
  const preview = mine
    ? letter.title || "Untitled"
    : stillLocked
      ? "Sealed for you"
      : letter.title || "Untitled";
  return (
    <Link
      to="/app/letters/$id"
      params={{ id: letter.id }}
      className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-petal/25 bg-velvet flex flex-col p-4 hover:-translate-y-0.5 transition-transform"
    >
      <div className={`absolute inset-0 opacity-30 ${themeMeta.swatch}`} />
      <div className="absolute top-3 right-3">
        <div className={`size-11 rounded-full ${themeMeta.swatch} flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${sealed ? "" : "opacity-40 grayscale"}`}>
          {sealed ? (
            <Lock className="size-4 text-velvet" strokeWidth={2.5} />
          ) : (
            <span className="text-lg">💌</span>
          )}
        </div>
      </div>
      <div className="relative z-10 mt-auto">
        <p className="text-[9px] uppercase tracking-[0.25em] text-petal mb-1">
          {mine ? "From you" : "For you"}
        </p>
        <p className="font-serif italic text-lg leading-tight text-candle line-clamp-3">
          {preview}
        </p>
        <p className="text-[10px] text-candle-muted mt-2 flex items-center gap-1">
          <Clock className="size-3" />
          {stillLocked ? `Opens ${formatDate(unlockAt)}` : `Sealed ${formatDate(new Date(letter.created_at))}`}
        </p>
      </div>
    </Link>
  );
}

function Composer({
  me,
  partnerId,
  partnerName,
  anniversaryDate,
  onClose,
}: {
  me: string;
  partnerId: string;
  partnerName: string;
  anniversaryDate: string | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [theme, setTheme] = useState<Letter["theme"]>("gold");
  const [motto, setMotto] = useState("");
  const [previewBreaking, setPreviewBreaking] = useState(false);
  const [tone, setTone] = useState<"tender" | "playful" | "poetic" | "vulnerable">("tender");
  const [hints, setHints] = useState("");
  const [unlockChoice, setUnlockChoice] = useState<"now" | "tomorrow" | "week" | "anniversary" | "custom">("tomorrow");
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [voicePath, setVoicePath] = useState<string | null>(null);
  const [voiceMs, setVoiceMs] = useState<number>(0);
  const [showRecorder, setShowRecorder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function testAnimation() {
    setPreviewBreaking(true);
    setTimeout(() => setPreviewBreaking(false), 1500);
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("That photo is a bit large — under 8 MB please.");
      return;
    }
    setPhotoUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = await uploadChatMedia(file, me, "image", ext);
      const url = await signMedia(path);
      setPhotoPath(path);
      setPhotoPreview(url);
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't upload that photo.");
    } finally {
      setPhotoUploading(false);
    }
  }

  const unlockAt = useMemo(() => {
    const d = new Date();
    if (unlockChoice === "now") return d;
    if (unlockChoice === "tomorrow") {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    if (unlockChoice === "week") {
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    if (unlockChoice === "anniversary" && anniversaryDate) {
      // Next occurrence of the couple's anniversary (MM-DD) at 09:00.
      const [ay, am, ad] = anniversaryDate.split("-").map(Number);
      const now = new Date();
      const candidate = new Date(now.getFullYear(), (am ?? 1) - 1, ad ?? 1, 9, 0, 0);
      if (candidate.getTime() <= now.getTime()) candidate.setFullYear(candidate.getFullYear() + 1);
      // ay is unused for the recurrence rule; reference it so tsc doesn't complain.
      void ay;
      return candidate;
    }
    return new Date(customDate + "T09:00:00");
  }, [unlockChoice, customDate, anniversaryDate]);

  async function draft() {
    setAiLoading(true);
    try {
      const res = await draftLoveLetter({
        data: { hints, tone, partnerName },
      });
      setTitle((res as any).title ?? "");
      setBody((res as any).body ?? "");
    } catch (err: any) {
      toast.error(err.message ?? "AI couldn't draft this one.");
    } finally {
      setAiLoading(false);
    }
  }

  async function seal() {
    if (!body.trim()) {
      toast.error("Write something first — even a line.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("love_letters").insert({
      sender_id: me,
      recipient_id: partnerId,
      title: title.trim() || "Untitled",
      body: body.trim(),
      theme,
      seal_motto: motto.trim() || null,
      unlock_at: unlockAt.toISOString(),
      photo_url: photoPath,
      voice_url: voicePath,
      unlock_on_anniversary: unlockChoice === "anniversary",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(unlockChoice === "now" ? "Sealed and delivered." : `Sealed. Opens ${formatDate(unlockAt)}.`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-velvet/85 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 top-6 sm:inset-4 sm:top-10 sm:bottom-10 sm:mx-auto sm:max-w-lg bg-surface-elevated border border-border rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col animate-scale-in"
      >
        <header className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-petal">To {partnerName}</p>
            <p className="font-serif italic text-xl">New letter</p>
          </div>
          <button onClick={onClose} className="ml-auto text-candle-muted hover:text-candle">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A title, if you have one…"
              className="w-full bg-transparent border-0 border-b border-border pb-2 font-serif italic text-2xl text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal"
            />
          </div>
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              placeholder="Write it as if they can hear you…"
              className="w-full bg-surface rounded-2xl px-4 py-3 text-candle placeholder:text-candle-muted resize-none focus:outline-none focus:ring-1 focus:ring-petal font-serif italic text-base leading-relaxed"
              style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}
            />
          </div>

          <details className="rounded-2xl border border-border bg-surface p-3">
            <summary className="text-[11px] uppercase tracking-[0.2em] text-petal cursor-pointer flex items-center gap-2">
              <Sparkles className="size-3" /> Let AI ghost-write a draft
            </summary>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {(["tender", "playful", "poetic", "vulnerable"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-full text-xs capitalize border ${tone === t ? "border-petal bg-petal-soft text-candle" : "border-border text-candle-muted"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                value={hints}
                onChange={(e) => setHints(e.target.value)}
                rows={2}
                placeholder="Notes for the muse: a memory, a mood, a season…"
                className="w-full bg-velvet rounded-xl px-3 py-2 text-sm text-candle placeholder:text-candle-muted resize-none focus:outline-none focus:ring-1 focus:ring-petal"
              />
              <button
                onClick={draft}
                disabled={aiLoading}
                className="w-full py-2 rounded-full bg-petal text-velvet font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {aiLoading ? <Sparkles className="size-4 animate-pulse" /> : <Sparkles className="size-4" />}
                {aiLoading ? "Drafting…" : "Draft it for me"}
              </button>
            </div>
          </details>

          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-2">Wax color</p>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  aria-label={t.label}
                  className={`size-10 rounded-full ${t.swatch} transition-all ${theme === t.id ? `ring-2 ring-offset-2 ring-offset-surface-elevated ${t.ring}` : "opacity-70"}`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted">Seal wording</p>
              <span className="text-[10px] text-candle-muted">{motto.length}/40</span>
            </div>
            <input
              value={motto}
              onChange={(e) => setMotto(e.target.value.slice(0, 40))}
              placeholder="Pandacine · Sealed with love"
              className="w-full bg-surface rounded-xl px-3 py-2 text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:ring-1 focus:ring-petal"
            />
            <p className="text-[10px] text-candle-muted mt-1.5">Curved text pressed around the wax ring.</p>

            <div className="mt-4 flex flex-col items-center rounded-2xl bg-velvet/60 border border-border p-5">
              <PandacineWaxSeal
                tone={theme}
                motto={motto}
                breaking={previewBreaking}
                interactive={false}
                size={160}
              />
              <button
                type="button"
                onClick={testAnimation}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-petal/40 bg-petal-soft text-candle text-[11px] uppercase tracking-[0.22em]"
              >
                <Sparkles className="size-3" /> Test animation
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-2">Open when</p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { id: "now", label: "Now" },
                  { id: "tomorrow", label: "Tomorrow" },
                  { id: "week", label: "1 week" },
                  { id: "custom", label: "Pick" },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  onClick={() => setUnlockChoice(o.id)}
                  className={`py-2 rounded-xl text-xs border ${unlockChoice === o.id ? "border-petal bg-petal-soft text-candle" : "border-border text-candle-muted"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {anniversaryDate && (
              <button
                onClick={() => setUnlockChoice("anniversary")}
                className={`mt-2 w-full py-2 rounded-xl text-xs border inline-flex items-center justify-center gap-2 ${unlockChoice === "anniversary" ? "border-petal bg-petal-soft text-candle" : "border-border text-candle-muted"}`}
              >
                <span className="text-petal">❤︎</span> On our anniversary
              </button>
            )}
            {unlockChoice === "custom" && (
              <input
                type="date"
                value={customDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mt-2 w-full bg-surface rounded-xl px-3 py-2 text-sm text-candle border border-border"
              />
            )}
            <p className="text-[11px] text-candle-muted mt-2">
              Will open {formatDate(unlockAt)} at {unlockAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
            </p>
          </div>

          {/* Keepsakes: photo + voice note */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-2">Keepsakes</p>

            {/* Photo */}
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-border mb-3">
                <img src={photoPreview} alt="attachment" className="w-full max-h-56 object-cover" />
                <button
                  onClick={() => { setPhotoPath(null); setPhotoPreview(null); }}
                  className="absolute top-2 right-2 size-8 rounded-full bg-velvet/80 text-candle flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="w-full py-3 rounded-2xl border border-dashed border-border text-sm text-candle-muted inline-flex items-center justify-center gap-2 mb-3 disabled:opacity-60"
              >
                <ImageIcon className="size-4" />
                {photoUploading ? "Uploading…" : "Attach a photo"}
              </button>
            )}

            {/* Voice */}
            {voicePath ? (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border">
                <div className="size-9 rounded-full bg-petal-soft text-petal flex items-center justify-center">
                  <Mic className="size-4" />
                </div>
                <div className="flex-1 text-sm text-candle">
                  Voice note attached
                  <p className="text-[11px] text-candle-muted">{Math.max(1, Math.round(voiceMs / 1000))}s</p>
                </div>
                <button
                  onClick={() => { setVoicePath(null); setVoiceMs(0); }}
                  className="text-candle-muted"
                  aria-label="Remove voice note"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ) : showRecorder ? (
              <div className="rounded-2xl bg-surface border border-border p-3">
                <VoiceRecorder
                  userId={me}
                  onSend={async (path, durationMs) => {
                    setVoicePath(path);
                    setVoiceMs(durationMs);
                    setShowRecorder(false);
                  }}
                />
                <button
                  onClick={() => setShowRecorder(false)}
                  className="mt-2 w-full py-1.5 text-[11px] uppercase tracking-widest text-candle-muted"
                >
                  Cancel recording
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRecorder(true)}
                className="w-full py-3 rounded-2xl border border-dashed border-border text-sm text-candle-muted inline-flex items-center justify-center gap-2"
              >
                <Mic className="size-4" /> Record a voice note
              </button>
            )}
          </div>
        </div>

        <footer className="border-t border-border px-5 py-3 flex gap-2 bg-surface-elevated">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-surface border border-border text-sm text-candle">
            Cancel
          </button>
          <button
            onClick={seal}
            disabled={saving}
            className="flex-[2] py-3 rounded-2xl bg-petal text-velvet font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Lock className="size-4" /> {saving ? "Sealing…" : "Seal & send"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatDate(d: Date) {
  const now = new Date();
  const days = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1 && days < 7) return `in ${days} days`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}
