import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Lock, Trash2, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { openLoveLetter } from "@/lib/letters.functions";
import { PandacineWaxSeal } from "@/components/PandacineWaxSeal";

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
    <div className={`min-h-screen ${style.page}`}>
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
              <PandacineWaxSeal tone={letter.theme} interactive={false} size={176} />
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
                <PandacineWaxSeal tone={letter.theme} interactive={false} breaking size={176} />
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
            <div
              className={`${style.text} whitespace-pre-wrap leading-relaxed text-lg`}
              style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}
            >
              {letter.body}
            </div>
            <footer className={`mt-10 pt-6 border-t border-white/10 ${style.text} opacity-60 text-xs flex items-center gap-2`}>
              <Clock className="size-3" />
              Sealed {new Date(letter.created_at).toLocaleDateString([], { dateStyle: "long" })}
              {letter.opened_at && (
                <>· Opened {new Date(letter.opened_at).toLocaleDateString([], { dateStyle: "long" })}</>
              )}
            </footer>
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
