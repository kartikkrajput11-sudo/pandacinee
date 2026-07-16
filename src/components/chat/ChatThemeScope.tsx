import { type CSSProperties, type ReactNode } from "react";
import { useEquippedItems } from "@/hooks/useEquippedItems";

/**
 * Wraps the chat area and applies the user's equipped chat theme:
 * bubble colors (via scoped CSS variables that override --petal / --surface-elevated)
 * and a wallpaper background.
 */
export function ChatThemeScope({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { chatTheme } = useEquippedItems();
  const wallpaper = chatTheme?.wallpaper ?? "velvet";

  const style: CSSProperties & Record<string, string> = {};
  if (chatTheme?.bubble_me) {
    style["--petal"] = chatTheme.bubble_me;
    style["--petal-soft"] = `${chatTheme.bubble_me}33`;
  }
  if (chatTheme?.bubble_them) {
    style["--surface-elevated"] = chatTheme.bubble_them;
  }

  return (
    <div className={`chat-wallpaper chat-wallpaper--${wallpaper} ${className}`} style={style}>
      {children}
    </div>
  );
}
