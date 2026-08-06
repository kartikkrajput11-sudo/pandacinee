import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, Clock, Sparkles, Mic, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { openLoveLetter } from "@/lib/letters.functions";
import { PandacineWaxSeal } from "@/components/PandacineWaxSeal";
import { VoicePlayer } from "@/components/chat/VoicePlayer";
import { signMedia } from "@/lib/chat";
import { fontOf, paperOf, type LetterStyle } from "@/lib/letter-style";
import { LetterDecorations } from "@/components/letters/LetterDecorations";

export const Route = createFileRoute("/_authenticated/app/letters/$id")({
  component: LetterView,
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
  seal_motto: string | null;
  photo_url: string | null;
  reply_body: string | null;
  reply_reaction: string | null;
  replied_at: string | null;
  unlock_on_anniversary: boolean;
  style?: LetterStyle | null;
};

const THEME_STYLE: Record<Letter["theme"], { seal: string; page: string; text: string; ring: string }> = {
  gold: {
    seal: "bg-gradient-to-br from-[#c9a84c] via-[#e8c464] to-[#f0d78c]",
    page: "bg-gradient-to-br from-[#1a1408] via-[#0f0a04] to-[#1a1408]",
    text: "text-[#f0d78c]",
    ring: "shadow-[0_0_60px_rgba(201,168,76,0.35)]",
  },
  rose: {
    seal: "bg-gradient-to-br from-[#c96b7a] via-[#e8a1b0] to-[#f0c0cc]",
    page: "bg-gradient-to-br from-[#2a0f1a] via-[#1a0812] to-[#2a0f1a]",
    text: "text-[#f0c0cc]",
    ring: "shadow-[0_0_60px_rgba(201,107,122,0.35)]",
  },
  ivory: {
    seal: "bg-gradient-to-br from-[#c9b590] via-[#e8dcc4] to-[#f5f0e6]",
    page: "bg-gradient-to-br from-[#1a1712] via-[#0f0c08] to-[#1a1712]",
    text: "text-[#f5f0e6]",
    ring: "shadow-[0_0_60px_rgba(201,181,144,0.35)]",
  },
  emerald: {
    seal: "bg-gradient-to-br from-[#0d7a5f] via-[#5cbdb9] to-[#c9a84c]",
    page: "bg-gradient-to-br from-[#0a1929] via-[#050e18] to-[#0a1929]",
    text: "text-[#c9a84c]",
    ring: "shadow-[0_0_60px_rgba(13,122,95,0.35)]",
  },
};

function LetterView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useProfile();
  const me = data?.profile;
  const [letter, setLetter] = useState<Letter | null>(null);
  const [now, setNow] = useState(Date.now());
  const [breaking, setBreaking] = useState(false);

  async function load() {
    if (!me) return;
    const { data: row, error } = await (supabase as any)
      .from("love_letters")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    setLetter(row as Letter | null);
  }

  useEffect(() => {
    load();
  }, [me?.id, id]);

  useEffect(() => {
    if (!letter) return;
    const ch = supabase
      .channel(`letter-${letter.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "love_letters", filter: `id=eq.${letter.id}` },
        (payload: any) => setLetter(payload.new as Letter),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [letter?.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const unlockAt = letter ? new Date(letter.unlock_at).getTime() : 0;
  const stillLocked = letter && !letter.opened_at && unlockAt > now;
  const mine = letter && me && letter.sender_id === me.id;
  const isRecipient = letter && me && letter.recipient_id === me.id;
  const canOpen = !!(isRecipient && !letter.opened_at && unlockAt <= now);
  const style = letter ? THEME_STYLE[letter.theme] : THEME_STYLE.gold;

  const countdown = useMemo(() => {
    if (!stillLocked || !letter) return null;
    const ms = unlockAt - now;
    const total = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return { d, h, m, s };
  }, [stillLocked, unlockAt, now, letter]);

  async function open() {
    if (!canOpen) return;
    setBreaking(true);
    try {
      const res = await openLoveLetter({ data: { id } });
      if (res) setLetter(res as Letter);
    } catch (err: any) {
      toast.error(err.message ?? "Could not open");
    }
    // Let the seal-break animation play before we drop it.
    setTimeout(() => setBreaking(false), 1200);
  }

  async function unseal() {
    if (!letter) return;
    if (!mine || letter.opened_at) return;
    if (!confirm("Delete this sealed letter?")) return;
    const { error } = await (supabase as any).from("love_letters").delete().eq("id", letter.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Letter withdrawn.");
    navigate({ to: "/app/letters" });
  }

  if (!letter) {
    return (
      <div className="pt-10 px-5">
        <Link to="/app/letters" className="text-candle-muted text-sm flex items-center gap-2 mb-4">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <p className="text-sm text-candle-muted italic">Fetching the letter…</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen relative ${paperOf(letter.style) ? "" : style.page}`}
      style={paperOf(letter.style) ? { background: paperOf(letter.style)!.background } : undefined}
    >
      <LetterDecorations style={letter.style} seed={letter.id} count={14} />
      <div className="max-w-lg mx-auto px-5 pt-8 pb-20 relative">
        <header className="flex items-center gap-3 mb-8">
          <Link to="/app/letters" className={`${style.text} opacity-70`}>
            <ArrowLeft className="size-5" />
          </Link>
          <p className={`text-[10px] uppercase tracking-[0.25em] ${style.text} opacity-70`}>
            {mine ? "You wrote this" : "For you"}
          </p>
          {mine && !letter.opened_at && (
            <button onClick={unseal} className={`ml-auto ${style.text} opacity-60`} aria-label="Withdraw">
              <Trash2 className="size-4" />
            </button>
          )}
        </header>

        {stillLocked && !mine ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-8">
              <PandacineWaxSeal tone={letter.theme} interactive={false} size={176} motto={letter.seal_motto ?? undefined} />
            </div>
            <p className={`font-serif italic text-3xl ${style.text} mb-2`}>Sealed for you.</p>
            <p className={`${style.text} opacity-70 text-sm mb-6`}>
              Opens {new Date(letter.unlock_at).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}
            </p>
            {countdown && (
              <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
                {[
                  { label: "days", value: countdown.d },
                  { label: "hrs", value: countdown.h },
                  { label: "min", value: countdown.m },
                  { label: "sec", value: countdown.s },
                ].map((c) => (
                  <div key={c.label} className="rounded-2xl border border-white/10 py-3 text-center">
                    <p className={`font-serif italic text-2xl ${style.text}`}>{String(c.value).padStart(2, "0")}</p>
                    <p className={`${style.text} opacity-50 text-[9px] uppercase tracking-widest`}>{c.label}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setBreaking(true);
                setTimeout(() => setBreaking(false), 1400);
              }}
              className={`mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 ${style.text} opacity-80 hover:opacity-100 text-[11px] uppercase tracking-[0.25em]`}
            >
              <Sparkles className="size-3" /> Preview animation
            </button>
            {breaking && (
              <div className="mt-6">
                <PandacineWaxSeal tone={letter.theme} interactive={false} breaking size={176} motto={letter.seal_motto ?? undefined} />
              </div>
            )}
          </div>
        ) : canOpen ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PandacineWaxSeal
              tone={letter.theme}
              breaking={breaking}
              onClick={open}
              size={192}
              motto={letter.seal_motto ?? undefined}
            />
            <p className={`font-serif italic text-2xl ${style.text} mt-8`}>Break the seal.</p>
            <p className={`${style.text} opacity-70 text-sm mt-1`}>Tap to open.</p>
            <button
              onClick={() => {
                setBreaking(true);
                setTimeout(() => setBreaking(false), 1400);
              }}
              className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 ${style.text} opacity-80 hover:opacity-100 text-[11px] uppercase tracking-[0.25em]`}
            >
              <Sparkles className="size-3" /> Preview animation
            </button>
          </div>
        ) : (
          <article className={`animate-fade-in ${breaking ? "" : ""}`}>
            {letter.title && (
              <h1 className={`font-serif italic text-4xl leading-tight mb-6 ${style.text}`}>
                {letter.title}
              </h1>
            )}

            {letter.photo_url && (
              <LetterPhoto path={letter.photo_url} />
            )}

            <div
              className={`${style.text} whitespace-pre-wrap leading-relaxed text-lg`}
              style={{ fontFamily: fontOf(letter.style).stack }}
            >
              {letter.body}
            </div>

            {letter.voice_url && (
              <div className="mt-6 rounded-2xl border border-white/10 p-3">
                <p className={`text-[10px] uppercase tracking-[0.25em] ${style.text} opacity-70 mb-2 flex items-center gap-1.5`}>
                  <Mic className="size-3" /> Voice note
                </p>
                <VoicePlayer path={letter.voice_url} />
              </div>
            )}

            <footer className={`mt-10 pt-6 border-t border-white/10 ${style.text} opacity-60 text-xs flex items-center gap-2`}>
              <Clock className="size-3" />
              Sealed {new Date(letter.created_at).toLocaleDateString([], { dateStyle: "long" })}
              {letter.opened_at && (
                <>· Opened {new Date(letter.opened_at).toLocaleDateString([], { dateStyle: "long" })}</>
              )}
            </footer>

            <ReplyPanel letter={letter} isRecipient={!!isRecipient} style={style} onUpdate={setLetter} />
          </article>
        )}

        {mine && stillLocked && (
          <div className="mt-8 p-4 rounded-2xl border border-white/10 text-center">
            <p className={`${style.text} opacity-70 text-xs uppercase tracking-widest mb-1`}>Your side</p>
            <p className={`${style.text} font-serif italic`}>Waiting until {new Date(letter.unlock_at).toLocaleDateString([], { dateStyle: "long" })}.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LetterPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signMedia(path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [path]);
  if (!url) return <div className="mb-6 h-40 rounded-2xl bg-white/5 animate-pulse" />;
  return (
    <figure className="mb-6 rounded-2xl overflow-hidden border border-white/10">
      <img src={url} alt="Keepsake" className="w-full max-h-[60vh] object-cover animate-fade-in" />
    </figure>
  );
}

const REACTIONS = ["❤️", "🥺", "😭", "😘", "🌸", "✨"];

function ReplyPanel({
  letter,
  isRecipient,
  style,
  onUpdate,
}: {
  letter: {
    id: string;
    reply_body: string | null;
    reply_reaction: string | null;
    replied_at: string | null;
  };
  isRecipient: boolean;
  style: { text: string };
  onUpdate: (l: any) => void;
}) {
  const [draft, setDraft] = useState(letter.reply_body ?? "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!letter.replied_at);

  async function saveReaction(r: string) {
    const next = letter.reply_reaction === r ? null : r;
    const { data, error } = await (supabase as any)
      .from("love_letters")
      .update({
        reply_reaction: next,
        replied_at: next || letter.reply_body ? new Date().toISOString() : null,
      })
      .eq("id", letter.id)
      .select()
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (data) onUpdate(data);
  }

  async function saveReply() {
    if (!draft.trim()) {
      toast.error("Write a line first.");
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("love_letters")
      .update({
        reply_body: draft.trim(),
        replied_at: new Date().toISOString(),
      })
      .eq("id", letter.id)
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    if (data) {
      onUpdate(data);
      setEditing(false);
      toast.success("Reply sent.");
    }
  }

  // Existing reply (visible to both).
  if (letter.reply_body && !editing) {
    return (
      <section className={`mt-10 pt-6 border-t border-white/10`}>
        <p className={`text-[10px] uppercase tracking-[0.25em] ${style.text} opacity-70 mb-2`}>
          {isRecipient ? "Your reply" : "They replied"}
        </p>
        <div className={`rounded-2xl border border-white/10 p-4 ${style.text}`}>
          {letter.reply_reaction && (
            <div className="text-3xl mb-1">{letter.reply_reaction}</div>
          )}
          <p className="font-serif italic text-lg leading-relaxed whitespace-pre-wrap">{letter.reply_body}</p>
          <p className="text-[10px] opacity-50 uppercase tracking-widest mt-3">
            {letter.replied_at ? new Date(letter.replied_at).toLocaleDateString([], { dateStyle: "long" }) : ""}
          </p>
        </div>
        {isRecipient && (
          <button
            onClick={() => setEditing(true)}
            className={`mt-2 text-[11px] uppercase tracking-[0.25em] ${style.text} opacity-70`}
          >
            Edit reply
          </button>
        )}
      </section>
    );
  }

  // Reply composer — recipient only.
  if (!isRecipient) return null;

  return (
    <section className="mt-10 pt-6 border-t border-white/10">
      <p className={`text-[10px] uppercase tracking-[0.25em] ${style.text} opacity-70 mb-3`}>Write back</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {REACTIONS.map((r) => (
          <button
            key={r}
            onClick={() => saveReaction(r)}
            className={`size-10 rounded-full text-xl border ${letter.reply_reaction === r ? "border-white/60 bg-white/10" : "border-white/10"} hover:scale-105 transition-transform`}
          >
            {r}
          </button>
        ))}
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="A word back — even one line."
        className={`w-full bg-white/5 rounded-2xl px-4 py-3 ${style.text} placeholder:opacity-40 resize-none focus:outline-none focus:ring-1 focus:ring-white/30 font-serif italic text-base leading-relaxed`}
        style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}
      />
      <div className="mt-3 flex gap-2">
        {letter.replied_at && (
          <button
            onClick={() => { setDraft(letter.reply_body ?? ""); setEditing(false); }}
            className={`flex-1 py-3 rounded-2xl border border-white/10 text-sm ${style.text} opacity-80`}
          >
            Cancel
          </button>
        )}
        <button
          onClick={saveReply}
          disabled={saving}
          className={`flex-[2] py-3 rounded-2xl bg-white/10 border border-white/20 text-sm font-semibold ${style.text} inline-flex items-center justify-center gap-2 disabled:opacity-60`}
        >
          <Send className="size-4" /> {saving ? "Sending…" : "Send reply"}
        </button>
      </div>
    </section>
  );
}
