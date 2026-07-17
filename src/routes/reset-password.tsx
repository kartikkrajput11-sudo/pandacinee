import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PandaLogo } from "@/components/PandaLogo";
import { Petals } from "@/components/Petals";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — PANDACINE" },
      { name: "description", content: "Choose a new password for your PANDACINE account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase parses the recovery tokens from the URL hash automatically and
  // fires PASSWORD_RECOVERY. Wait for that (or an existing session) before
  // allowing the form to submit — otherwise updateUser() has no user.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated 🐼");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen velvet-bg flex flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-petal/25 blur-3xl animate-auth-bloom-a" />
        <div className="absolute -bottom-48 -right-24 h-[560px] w-[560px] rounded-full bg-primary/20 blur-3xl animate-auth-bloom-b" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-accent/15 blur-2xl animate-auth-bloom-c" />
      </div>
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 h-[720px] w-[720px] rounded-full border border-petal/10 animate-auth-ring-slow" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 h-[520px] w-[520px] rounded-full border border-petal/15 animate-auth-ring-fast" />
      <Petals count={8} />
      <header className="relative z-10 px-6 py-6 animate-fade-in">
        <Link to="/">
          <PandaLogo />
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm animate-auth-card">
          <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-petal/40 via-petal/10 to-transparent shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
            <div className="relative rounded-3xl bg-surface/70 backdrop-blur-xl border border-border/60 p-7 overflow-hidden">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-petal/70 to-transparent animate-auth-shimmer" />
              <div className="text-center mb-8" style={{ animation: "auth-rise 0.7s ease-out both", animationDelay: "80ms" }}>
                <h1 className="font-serif text-4xl italic mb-2 bg-gradient-to-b from-candle to-candle-muted bg-clip-text text-transparent">New password</h1>
                <p className="text-sm text-candle-muted">
                  {ready ? "Choose a new password for your panda." : "Waiting for your reset link…"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3" style={{ animation: "auth-rise 0.6s ease-out both", animationDelay: "200ms" }}>
                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl text-candle placeholder:text-candle-muted text-sm focus:outline-none focus:border-petal/60 focus:ring-2 focus:ring-petal/20 transition-all"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl text-candle placeholder:text-candle-muted text-sm focus:outline-none focus:border-petal/60 focus:ring-2 focus:ring-petal/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={loading || !ready}
                  className="group relative w-full py-3.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden />
                  <span className="relative">{loading ? "Updating…" : "Update password"}</span>
                </button>
              </form>

              <p className="text-center text-sm text-candle-muted mt-6">
                <Link to="/auth" className="text-petal font-medium hover:underline">
                  Back to sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
