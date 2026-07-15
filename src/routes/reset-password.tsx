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
    <div className="relative min-h-screen velvet-bg flex flex-col">
      <Petals count={6} />
      <header className="relative z-10 px-6 py-6">
        <Link to="/">
          <PandaLogo />
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="text-center mb-8">
            <h1 className="font-serif text-4xl italic mb-2">New password</h1>
            <p className="text-sm text-candle-muted">
              {ready
                ? "Choose a new password for your panda."
                : "Waiting for your reset link…"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
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
              className="w-full py-3.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>

          <p className="text-center text-sm text-candle-muted mt-6">
            <Link to="/auth" className="text-petal font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
