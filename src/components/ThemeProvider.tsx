import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeCtx = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (m: ThemeMode) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function readSaved(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem("pandacine-theme");
  return v === "light" || v === "dark" || v === "system" ? v : "dark";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

function apply(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-anim");
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  window.setTimeout(() => root.classList.remove("theme-anim"), 320);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const initial = readSaved();
    setModeState(initial);
    const next = initial === "system" ? (systemPrefersDark() ? "dark" : "light") : initial;
    setResolved(next);
    apply(next);
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      apply(next);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    window.localStorage.setItem("pandacine-theme", m);
    const next = m === "system" ? (systemPrefersDark() ? "dark" : "light") : m;
    setResolved(next);
    apply(next);
  };

  return <Ctx.Provider value={{ mode, resolved, setMode }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) return { mode: "dark" as ThemeMode, resolved: "dark" as const, setMode: () => {} };
  return v;
}
