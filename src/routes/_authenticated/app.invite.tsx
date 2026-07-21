import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Copy, Heart, Sparkles, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/invite")({
  component: Invite,
});

function Invite() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useProfile();
  const me = data?.profile;
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);

  async function copy() {
    if (!me) return;
    try {
      await navigator.clipboard.writeText(me.invite_code);
      toast.success("Invite code copied");
    } catch {
      toast.error("Couldn't copy — long-press the code to select it");
    }
  }

  async function share() {
    if (!me) return;
    const text = `Pair with me on Pandacine 🐼\nCode: ${me.invite_code}\nhttps://pandacine.com`;
    try {
      if (navigator.share) await navigator.share({ text, title: "Pandacine invite" });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Invite copied");
      }
    } catch {}
  }

  async function pair(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (me && trimmed === me.invite_code) {
      toast.error("That's your own code — share it with your partner");
      return;
    }
    setPairing(true);
    const { error } = await supabase.rpc("pair_with_invite_code", { _code: trimmed });
    setPairing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Paired 🐼❤️🐼");
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    navigate({ to: "/app" });
  }

  if (data?.partner) {
    return (
      <div className="pt-20 px-6 text-center relative overflow-hidden min-h-screen">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              "radial-gradient(60% 40% at 50% 20%, hsl(var(--petal) / 0.28), transparent 70%)",
          }}
        />
        <div className="mx-auto w-24 h-24 rounded-full grid place-items-center border border-petal/40 bg-petal-soft mb-5 animate-scale-in">
          <Heart className="size-10 text-petal fill-petal/30" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-petal mb-2">Bonded</p>
        <h1 className="font-serif text-4xl italic mb-2">You're paired</h1>
        <p className="text-candle-muted mb-8">with {data.partner.display_name}</p>
        <Link
          to="/app"
          className="inline-block px-8 py-3.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow"
        >
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-10 px-5 pb-16 relative">
      {/* Ambient bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 0%, hsl(var(--petal) / 0.22), transparent 70%)",
        }}
      />

      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 mb-8">
        <Link
          to="/app"
          className="size-9 rounded-full grid place-items-center bg-surface/60 border border-border text-candle-muted hover:text-candle transition"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.35em] text-petal">Bonding</p>
          <h1 className="font-serif text-2xl italic truncate">Pair with your panda</h1>
        </div>
      </header>

      {isLoading || !me ? (
        <div className="space-y-3">
          <div className="h-56 rounded-3xl bg-surface/60 border border-border animate-pulse" />
          <div className="h-14 rounded-2xl bg-surface/60 border border-border animate-pulse" />
        </div>
      ) : (
        <>
          {/* Your code — hero card */}
          <div
            className="relative overflow-hidden p-7 rounded-[28px] border border-petal/40 text-center mb-6"
            style={{
              background:
                "linear-gradient(160deg, hsl(var(--petal) / 0.22), hsl(var(--velvet)) 70%)",
              boxShadow:
                "0 40px 80px -40px hsl(var(--petal) / 0.55), inset 0 1px 0 hsl(var(--candle) / 0.08)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-20 size-60 rounded-full blur-3xl opacity-60"
              style={{ background: "hsl(var(--petal) / 0.35)" }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-petal/30 bg-velvet/40 backdrop-blur mb-4">
                <Sparkles className="size-3 text-petal" />
                <p className="text-[9px] uppercase tracking-[0.35em] text-petal">Your code</p>
              </div>
              <p className="font-serif text-[46px] leading-none italic tracking-[0.22em] text-candle mb-1 select-all">
                {me.invite_code}
              </p>
              <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-petal/60 to-transparent" />
              <p className="text-xs text-candle-muted mt-4 leading-relaxed max-w-[26ch] mx-auto">
                Send this to your partner. When they enter it below, you'll both be paired.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-velvet/50 backdrop-blur border border-border text-candle rounded-full text-xs font-medium hover:border-petal/40 transition"
                >
                  <Copy className="size-3" /> Copy
                </button>
                <button
                  onClick={share}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-petal text-velvet rounded-full text-xs font-semibold petal-glow"
                >
                  <Share2 className="size-3" /> Share
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <span className="flex-1 h-px bg-border" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">
              or enter theirs
            </span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={pair} className="space-y-3">
            <div className="relative">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-4 py-5 bg-surface border border-border rounded-2xl text-center text-3xl font-serif italic tracking-[0.35em] text-candle placeholder:text-candle-muted/40 focus:outline-none focus:border-petal/60 focus:shadow-[0_0_0_4px_hsl(var(--petal)/0.15)] transition"
              />
              {/* Slot indicators */}
              <div className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-4 rounded-full transition ${
                      code.length > i ? "bg-petal" : "bg-border"
                    }`}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={pairing || code.trim().length < 6}
              className="w-full py-4 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow disabled:opacity-40 disabled:petal-glow-none transition"
            >
              {pairing ? "Pairing…" : code.trim().length < 6 ? "Enter 6 characters" : "Pair now"}
            </button>
          </form>

          <p className="text-[11px] text-candle-muted text-center mt-6 leading-relaxed">
            Pairing is exclusive. Only one partner at a time — like the real thing.
          </p>
        </>
      )}
    </div>
  );
}
