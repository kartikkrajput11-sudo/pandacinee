import pandaKiss from "@/assets/panda-kiss.png";
import pandaHug from "@/assets/panda-hug-sticker.png";
import pandaHeadpat from "@/assets/panda-headpat-sticker.png";
import pandaHandhold from "@/assets/panda-handhold-sticker.png";
import pandaBoop from "@/assets/panda-boop-sticker.png";
import pandaSlap from "@/assets/panda-slap-sticker.png";
import pandaAnger from "@/assets/panda-anger-sticker.png";
import pandaTickle from "@/assets/panda-tickle-sticker.png";
import pandaWink from "@/assets/panda-wink-sticker.png";

export const AFFECTION_STICKERS = [
  pandaKiss,
  pandaHug,
  pandaHeadpat,
  pandaHandhold,
  pandaBoop,
  pandaSlap,
  pandaAnger,
  pandaTickle,
  pandaWink,
];

let done = false;

/** Warm the browser cache so affection overlays render instantly. */
export function preloadAffectionStickers() {
  if (done || typeof window === "undefined") return;
  done = true;
  try {
    for (const src of AFFECTION_STICKERS) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      void img.decode?.().catch(() => {});
    }
  } catch {
    // non-fatal: overlays still load lazily
  }
}
