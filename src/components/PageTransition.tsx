import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * iOS 26 "Liquid Glass" page transition.
 * Re-plays a fade + scale + backdrop-blur reveal on every top-level route change,
 * so switching sections feels like a glass bubble settling into place.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Key by the first two path segments so nested chats/movies don't retrigger on every param change.
  const sectionKey = pathname.split("/").slice(0, 3).join("/") || "/";
  const [key, setKey] = useState(sectionKey);
  const prev = useRef(sectionKey);

  useEffect(() => {
    if (prev.current !== sectionKey) {
      prev.current = sectionKey;
      setKey(sectionKey);
    }
  }, [sectionKey]);

  return (
    <div key={key} className="animate-page-glass will-change-transform">
      {children}
    </div>
  );
}
