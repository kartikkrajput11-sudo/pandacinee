import happy from "@/assets/stickers/panda-happy.png";
import love from "@/assets/stickers/panda-love.png";
import sad from "@/assets/stickers/panda-sad.png";
import laugh from "@/assets/stickers/panda-laugh.png";
import wink from "@/assets/stickers/panda-wink.png";
import kiss from "@/assets/stickers/panda-kiss.png";
import angry from "@/assets/stickers/panda-angry.png";
import shy from "@/assets/stickers/panda-shy.png";
import sleep from "@/assets/stickers/panda-sleep.png";
import cool from "@/assets/stickers/panda-cool.png";
import hug from "@/assets/stickers/panda-hug.png";
import wow from "@/assets/stickers/panda-wow.png";

export type PandaStickerId =
  | "happy" | "love" | "sad" | "laugh" | "wink" | "kiss"
  | "angry" | "shy" | "sleep" | "cool" | "hug" | "wow";

export const PANDA_STICKERS: { id: PandaStickerId; url: string; label: string }[] = [
  { id: "happy", url: happy, label: "Happy" },
  { id: "love",  url: love,  label: "In love" },
  { id: "laugh", url: laugh, label: "Laughing" },
  { id: "wink",  url: wink,  label: "Wink" },
  { id: "kiss",  url: kiss,  label: "Kiss" },
  { id: "hug",   url: hug,   label: "Hug" },
  { id: "shy",   url: shy,   label: "Shy" },
  { id: "wow",   url: wow,   label: "Wow" },
  { id: "cool",  url: cool,  label: "Cool" },
  { id: "sad",   url: sad,   label: "Sad" },
  { id: "angry", url: angry, label: "Angry" },
  { id: "sleep", url: sleep, label: "Sleepy" },
];

const BY_ID: Record<string, string> = Object.fromEntries(
  PANDA_STICKERS.map((s) => [s.id, s.url]),
);

export const PANDA_STICKER_PREFIX = "panda:";

export function isPandaStickerContent(content: string | null | undefined): boolean {
  return !!content && content.startsWith(PANDA_STICKER_PREFIX);
}

export function pandaStickerUrl(content: string): string | null {
  if (!isPandaStickerContent(content)) return null;
  const id = content.slice(PANDA_STICKER_PREFIX.length);
  return BY_ID[id] ?? null;
}

export function pandaStickerContent(id: PandaStickerId): string {
  return `${PANDA_STICKER_PREFIX}${id}`;
}
