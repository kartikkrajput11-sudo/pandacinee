import { useEffect } from "react";
import { useEquippedItems } from "@/hooks/useEquippedItems";

/**
 * Applies the equipped site theme by writing CSS variables to :root.
 * Mount once inside the authenticated shell.
 */
export function EquippedThemeApplier() {
  const { siteTheme, loaded } = useEquippedItems();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!loaded || !siteTheme || !siteTheme.accent) {
      root.style.removeProperty("--petal");
      root.style.removeProperty("--petal-soft");
      root.style.removeProperty("--velvet");
      root.style.removeProperty("--background");
      return;
    }
    if (siteTheme.accent) {
      root.style.setProperty("--petal", siteTheme.accent);
      root.style.setProperty("--petal-soft", `${siteTheme.accent}2e`);
    }
    if (siteTheme.bg) {
      root.style.setProperty("--velvet", siteTheme.bg);
      root.style.setProperty("--background", siteTheme.bg);
    }
  }, [loaded, siteTheme?.accent, siteTheme?.bg]);

  return null;
}
