import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type GlowColor = "petal" | "gold" | "blue" | "green";
type GlowSize = "sm" | "md" | "lg";

const glowMap: Record<GlowColor, string> = {
  petal: "236 72 153",
  gold: "212 175 55",
  blue: "96 165 250",
  green: "52 211 153",
};

const sizeMap: Record<GlowSize, string> = {
  sm: "p-4 rounded-2xl",
  md: "p-6 rounded-[1.35rem]",
  lg: "p-8 rounded-3xl",
};

type Props = React.HTMLAttributes<HTMLDivElement> & {
  glowColor?: GlowColor;
  size?: GlowSize;
  /** Disable the cursor spotlight (e.g. for reduced motion contexts). */
  staticGlow?: boolean;
};

/**
 * Luxury spotlight card — a cursor-tracking radial glow over a glass surface.
 */
export function GlowCard({
  children,
  className,
  glowColor = "petal",
  size = "md",
  staticGlow = false,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onMove = useCallback((e: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
    el.style.setProperty("--glow-opacity", "1");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || staticGlow) return;
    const onLeave = () => el.style.setProperty("--glow-opacity", "0");
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [onMove, staticGlow]);

  return (
    <div
      ref={ref}
      {...rest}
      style={
        {
          "--glow-rgb": glowMap[glowColor],
          "--glow-opacity": staticGlow ? "0.65" : "0",
          "--glow-x": "50%",
          "--glow-y": "0%",
          ...rest.style,
        } as React.CSSProperties
      }
      className={cn(
        "group relative overflow-hidden border border-border/70 bg-surface-elevated/80 backdrop-blur-xl",
        "shadow-[0_24px_70px_-40px_rgba(0,0,0,0.8)] transition-transform duration-300",
        sizeMap[size],
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: "var(--glow-opacity)",
          background:
            "radial-gradient(340px circle at var(--glow-x) var(--glow-y), rgb(var(--glow-rgb) / 0.18), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgb(var(--glow-rgb) / 0.5), transparent)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export default GlowCard;
