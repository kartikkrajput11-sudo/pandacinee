import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "default" | "light" | "dark" | "system";
export type ResolvedTheme = "default" | "light" | "dark";

type ThemeCtx = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function readSaved(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem("pandacine-theme");
  return v === "light" || v === "dark" || v === "default" || v === "system" ? v : "dark";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

function apply(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-anim");
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  // "default" leaves both off so :root (Velvet Evening Glow) applies
  window.setTimeout(() => root.classList.remove("theme-anim"), 320);
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const initial = readSaved();
    setModeState(initial);
    const next = resolve(initial);
    setResolved(next);
    apply(next);
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolved(next);
      apply(next);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    window.localStorage.setItem("pandacine-theme", m);
    const next = resolve(m);
    setResolved(next);
    apply(next);
  };

  return <Ctx.Provider value={{ mode, resolved, setMode }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) return { mode: "dark" as ThemeMode, resolved: "dark" as ResolvedTheme, setMode: () => {} };
  return v;
}
