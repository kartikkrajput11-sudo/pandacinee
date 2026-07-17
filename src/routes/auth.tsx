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
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
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

  function normalizePhone(v: string) {
    const t = v.trim();
    return t.startsWith("+") ? "+" + t.slice(1).replace(/\D/g, "") : "+" + t.replace(/\D/g, "");
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const localDigits = phone.replace(/\D/g, "");
    const p = `${countryCode}${localDigits}`;
    if (p.length < 8) {
      toast.error("Enter a valid phone number with country code");
      return;
    }
    if (mode === "signup" && !acceptedTerms) {
      toast.error("Please accept the Terms & Privacy to continue");
      return;
    }
    setLoading(true);
    try {
      if (!otpSent) {
        if (mode === "signup") {
          const { error } = await supabase.auth.signInWithOtp({
            phone: p,
            options: { data: { display_name: displayName || "panda" } },
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signInWithOtp({ phone: p });
          if (error) throw error;
        }
        setOtpSent(true);
        toast.success("Code sent — check your messages 🐼");
      } else {
        const { error } = await supabase.auth.verifyOtp({ phone: p, token: otp.trim(), type: "sms" });
        if (error) throw error;
        toast.success(mode === "signup" ? "Welcome to PANDACINE 🐼" : "Welcome back");
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
    <div className="relative min-h-screen velvet-bg flex flex-col overflow-hidden">
      {/* Ambient aurora bloom */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-petal/25 blur-3xl animate-auth-bloom-a" />
        <div className="absolute -bottom-48 -right-24 h-[560px] w-[560px] rounded-full bg-primary/20 blur-3xl animate-auth-bloom-b" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-accent/15 blur-2xl animate-auth-bloom-c" />
      </div>
      {/* Gilded filigree rings */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 h-[720px] w-[720px] rounded-full border border-petal/10 animate-auth-ring-slow" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 h-[520px] w-[520px] rounded-full border border-petal/15 animate-auth-ring-fast" />
      <Petals count={8} />
      <header className="relative z-10 px-6 py-6 animate-fade-in">
        <Link to="/">
          <PandaLogo />
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-12">
        <div key={mode} className="w-full max-w-sm animate-auth-card">
          <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-petal/40 via-petal/10 to-transparent shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
            <div className="relative rounded-3xl bg-surface/70 backdrop-blur-xl border border-border/60 p-7 overflow-hidden">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-petal/70 to-transparent animate-auth-shimmer" />
              <div className="text-center mb-8" style={{ animation: "auth-rise 0.7s ease-out both", animationDelay: "80ms" }}>
                <h1 className="font-serif text-4xl italic mb-2 bg-gradient-to-b from-candle to-candle-muted bg-clip-text text-transparent">
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
            style={{ animation: "auth-rise 0.6s ease-out both", animationDelay: "160ms" }}
            className="w-full mb-3 py-3 bg-candle text-velvet rounded-full font-medium text-sm hover:brightness-95 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)]"
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
            style={{ animation: "auth-rise 0.6s ease-out both", animationDelay: "220ms" }}
            className="w-full mb-5 py-3 bg-black text-white rounded-full font-medium text-sm hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.7)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Continue with Apple
          </button>

          <div className="flex items-center gap-3 mb-5" style={{ animation: "auth-rise 0.6s ease-out both", animationDelay: "280ms" }}>
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">or</span>
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* Channel toggle: Email / Phone */}
          <div
            className="relative flex mb-4 p-1 rounded-full bg-surface border border-border/60 text-xs font-medium"
            style={{ animation: "auth-rise 0.6s ease-out both", animationDelay: "310ms" }}
          >
            <span
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-petal/90 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.4)] transition-all duration-300 ease-out"
              style={{ left: channel === "email" ? "4px" : "calc(50% + 0px)" }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => { setChannel("email"); setOtpSent(false); }}
              className={`relative flex-1 py-2 rounded-full transition-colors ${channel === "email" ? "text-velvet" : "text-candle-muted"}`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => { setChannel("phone"); setOtpSent(false); }}
              className={`relative flex-1 py-2 rounded-full transition-colors ${channel === "phone" ? "text-velvet" : "text-candle-muted"}`}
            >
              Phone
            </button>
          </div>

          {channel === "email" ? (
            <form onSubmit={handleSubmit} className="space-y-3" style={{ animation: "auth-rise 0.6s ease-out both", animationDelay: "340ms" }}>
              {mode === "signup" && (
                <Input placeholder="Your name" value={displayName} onChange={(v) => setDisplayName(v)} />
              )}
              <Input type="email" placeholder="Email" value={email} onChange={(v) => setEmail(v)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(v) => setPassword(v)} required minLength={6} />
              {mode === "signup" && (
                <label className="flex items-start gap-2.5 pt-1 text-[11px] leading-snug text-candle-muted select-none cursor-pointer">
                  <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-petal shrink-0" />
                  <span>
                    I agree to PANDACINE's{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-petal hover:underline">Terms &amp; Conditions</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-petal hover:underline">Privacy Policy</a>.
                  </span>
                </label>
              )}
              <button
                type="submit"
                disabled={loading || (mode === "signup" && !acceptedTerms)}
                className="group relative w-full py-3.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden />
                <span className="relative">
                  {loading ? "One moment…" : mode === "signin" ? "Sign in" : "Create my PANDACINE"}
                </span>
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
          ) : (
            <form onSubmit={handlePhoneSubmit} className="space-y-3" style={{ animation: "auth-rise 0.6s ease-out both", animationDelay: "340ms" }}>
              {mode === "signup" && !otpSent && (
                <Input placeholder="Your name" value={displayName} onChange={(v) => setDisplayName(v)} />
              )}
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={otpSent}
                  className="rounded-xl bg-velvet/40 border border-gilt/25 text-candle px-2.5 py-2 text-sm focus:outline-none focus:border-gilt/60 disabled:opacity-60"
                  style={{ minWidth: 96 }}
                >
                  {[
                    { c: "+91", n: "IN" },
                    { c: "+1", n: "US" },
                    { c: "+44", n: "UK" },
                    { c: "+61", n: "AU" },
                    { c: "+971", n: "AE" },
                    { c: "+65", n: "SG" },
                    { c: "+81", n: "JP" },
                    { c: "+49", n: "DE" },
                    { c: "+33", n: "FR" },
                    { c: "+34", n: "ES" },
                    { c: "+39", n: "IT" },
                    { c: "+55", n: "BR" },
                    { c: "+52", n: "MX" },
                    { c: "+27", n: "ZA" },
                    { c: "+86", n: "CN" },
                    { c: "+82", n: "KR" },
                    { c: "+92", n: "PK" },
                    { c: "+880", n: "BD" },
                    { c: "+63", n: "PH" },
                    { c: "+62", n: "ID" },
                    { c: "+60", n: "MY" },
                    { c: "+66", n: "TH" },
                    { c: "+84", n: "VN" },
                    { c: "+7", n: "RU" },
                    { c: "+90", n: "TR" },
                    { c: "+20", n: "EG" },
                    { c: "+234", n: "NG" },
                    { c: "+254", n: "KE" },
                    { c: "+64", n: "NZ" },
                    { c: "+31", n: "NL" },
                    { c: "+46", n: "SE" },
                    { c: "+47", n: "NO" },
                    { c: "+45", n: "DK" },
                    { c: "+41", n: "CH" },
                    { c: "+353", n: "IE" },
                    { c: "+972", n: "IL" },
                    { c: "+966", n: "SA" },
                  ].map((o) => (
                    <option key={o.c} value={o.c}>{o.n} {o.c}</option>
                  ))}
                </select>
                <div className="flex-1">
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Phone number"
                    value={phone}
                    onChange={(v) => setPhone(v.replace(/\D/g, ""))}
                    required
                    disabled={otpSent}
                  />
                </div>
              </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(v) => setOtp(v)}
                  required
                  maxLength={8}
                />
              )}
              {mode === "signup" && !otpSent && (
                <label className="flex items-start gap-2.5 pt-1 text-[11px] leading-snug text-candle-muted select-none cursor-pointer">
                  <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-petal shrink-0" />
                  <span>
                    I agree to PANDACINE's{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-petal hover:underline">Terms &amp; Conditions</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-petal hover:underline">Privacy Policy</a>.
                  </span>
                </label>
              )}
              <button
                type="submit"
                disabled={loading || (mode === "signup" && !otpSent && !acceptedTerms)}
                className="group relative w-full py-3.5 bg-petal text-velvet rounded-full font-semibold text-sm petal-glow hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden />
                <span className="relative">
                  {loading ? "One moment…" : otpSent ? "Verify & continue" : "Send code"}
                </span>
              </button>
              {otpSent && (
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(""); }}
                  disabled={loading}
                  className="w-full text-center text-xs text-candle-muted hover:text-petal transition-colors mt-1"
                >
                  Use a different number
                </button>
              )}
            </form>
          )}

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
          </div>
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
