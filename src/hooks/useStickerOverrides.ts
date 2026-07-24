import { useEffect, useState } from "react";
import {
  initStickerOverridesRealtime,
  subscribeStickerOverrides,
  getHiddenStickerIds,
  getCustomStickers,
  isOverridesLoaded,
} from "@/lib/sticker-overrides";

export function useStickerOverrides() {
  const [, force] = useState(0);
  useEffect(() => {
    initStickerOverridesRealtime();
    const unsub = subscribeStickerOverrides(() => force((n) => n + 1));
    return () => { unsub(); };
  }, []);
  return {
    hidden: getHiddenStickerIds(),
    customs: getCustomStickers(),
    loaded: isOverridesLoaded(),
  };
}
