import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Copy, Heart } from "lucide-react";
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
      <div className="pt-16 px-6 text-center">
        <Heart className="size-12 text-petal mx-auto mb-4" />
        <h1 className="font-serif text-3xl italic mb-2">You're paired</h1>
        <p className="text-candle-muted mb-6">with {data.partner.display_name}</p>
        <Link to="/app" className="inline-block px-6 py-3 bg-petal text-velvet rounded-full font-semibold text-sm">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-10 px-5">
      <header className="flex items-center gap-3 mb-8">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-serif text-2xl italic">Pair with your partner</h1>
      </header>

      {isLoading || !me ? (
        <div className="text-candle-muted text-sm">Loading…</div>
      ) : (
        <>
          <div
            className="p-6 rounded-3xl border border-border mb-6 text-center"
            style={{ background: "var(--gradient-petal)" }}
          >
            <p className="text-[10px] uppercase tracking-widest text-petal mb-3">Your code</p>
            <p className="font-serif text-5xl italic tracking-[0.2em] text-candle mb-4">
              {me.invite_code}
            </p>
            <button
              onClick={copy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-velvet/40 backdrop-blur text-candle rounded-full text-xs font-medium"
            >
              <Copy className="size-3" /> Copy
            </button>
            <p className="text-xs text-candle-muted mt-4 leading-relaxed">
              Send this to your partner. When they enter it below, you'll both be paired.
            </p>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <span className="flex-1 h-px bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-candle-muted">or enter theirs</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={pair} className="space-y-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="w-full px-4 py-4 bg-surface border border-border rounded-2xl text-center text-2xl font-serif italic tracking-[0.3em] text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
            />
            <button
              type="submit"
              disabled={pairing || code.length < 4}
              className="w-full py-3.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow disabled:opacity-40"
            >
              {pairing ? "Pairing…" : "Pair"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
