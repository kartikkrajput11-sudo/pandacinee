import { useRouter } from "@tanstack/react-router";
import type { ReactNode, MouseEvent } from "react";

/**
 * Back control for game screens. Prefers browser history (so users land back
 * in the chat / group where they accepted the invite) and falls back to the
 * Play hub when there is no in-app history (fresh tab, deep link).
 */
export function GameBackLink({
  className,
  children,
  fallback = "/app/play",
}: {
  className?: string;
  children: ReactNode;
  fallback?: string;
}) {
  const router = useRouter();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const canGoBack =
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      document.referrer !== "";
    // history.length is unreliable across browsers; try back() and fall back.
    if (typeof window !== "undefined" && window.history.length > 1) {
      try {
        router.history.back();
        return;
      } catch {
        /* fallthrough */
      }
    }
    if (!canGoBack) router.navigate({ to: fallback });
  };

  return (
    <a href={fallback} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
