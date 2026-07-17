import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PandaLogo } from "@/components/PandaLogo";
import { Petals } from "@/components/Petals";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PANDACINE" },
      { name: "description", content: "Sign in to your PANDACINE to watch, chat, and connect." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!acceptedTerms) {
          toast.error("Please accept the Terms & Privacy to continue");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({

          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to PANDACINE 🐼");
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Enter your email first, then tap Forgot password");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent — check your email 🐼");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? `Could not sign in with ${provider}`);
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
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
            <h1 className="font-serif text-4xl italic mb-2">
              {mode === "signin" ? "Welcome back" : "Begin your story"}
            </h1>
            <p className="text-sm text-candle-muted">
              {mode === "signin"
                ? "Your panda has been waiting."
                : "Two pandas, one cozy living room."}
            </p>
          </div>

          <button
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="w-full mb-3 py-3 bg-candle text-velvet rounded-full font-medium text-sm hover:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a10.99 10.99 0 0 0 0 9.86l3.66-2.84z" />
              <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.47 14.97.5 12 .5A10.99 10.99 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 4.75z" />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={() => handleOAuth("apple")}
            disabled={loading}
            className="w-full mb-5 py-3 bg-black text-white rounded-full font-medium text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Continue with Apple
          </button>

          <div className="flex items-center gap-3 mb-5">
            <span className="flex-1 h-px bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-candle-muted">or</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <Input
                placeholder="Your name"
                value={displayName}
                onChange={(v) => setDisplayName(v)}
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(v) => setEmail(v)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(v) => setPassword(v)}
              required
              minLength={6}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading
                ? "One moment…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create my PANDACINE"}
            </button>
            {mode === "signin" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full text-center text-xs text-candle-muted hover:text-petal transition-colors mt-1"
              >
                Forgot password?
              </button>
            )}
          </form>

          <p className="text-center text-sm text-candle-muted mt-6">
            {mode === "signin" ? "New to PANDACINE? " : "Already have a panda? "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-petal font-medium hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function Input({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl text-candle placeholder:text-candle-muted text-sm focus:outline-none focus:border-petal/60 focus:ring-2 focus:ring-petal/20 transition-all"
    />
  );
}
