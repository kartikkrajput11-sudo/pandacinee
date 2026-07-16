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
import cry from "@/assets/stickers/panda-cry.png";
import blush from "@/assets/stickers/panda-blush.png";
import party from "@/assets/stickers/panda-party.png";
import stars from "@/assets/stickers/panda-stars.png";
import think from "@/assets/stickers/panda-think.png";
import wave from "@/assets/stickers/panda-wave.png";
import dance from "@/assets/stickers/panda-dance.png";
import heartHands from "@/assets/stickers/panda-heart-hands.png";

export type PandaStickerId =
  | "happy" | "love" | "sad" | "laugh" | "wink" | "kiss"
  | "angry" | "shy" | "sleep" | "cool" | "hug" | "wow"
  | "cry" | "blush" | "party" | "stars" | "think" | "wave" | "dance" | "heart-hands";

export const PANDA_STICKERS: { id: PandaStickerId; url: string; label: string }[] = [
  { id: "happy", url: happy, label: "Happy" },
  { id: "love",  url: love,  label: "In love" },
  { id: "heart-hands", url: heartHands, label: "Heart hands" },
  { id: "kiss",  url: kiss,  label: "Kiss" },
  { id: "hug",   url: hug,   label: "Hug" },
  { id: "blush", url: blush, label: "Blush" },
  { id: "shy",   url: shy,   label: "Shy" },
  { id: "wink",  url: wink,  label: "Wink" },
  { id: "laugh", url: laugh, label: "Laughing" },
  { id: "dance", url: dance, label: "Dance" },
  { id: "party", url: party, label: "Party" },
  { id: "stars", url: stars, label: "Star-struck" },
  { id: "wow",   url: wow,   label: "Wow" },
  { id: "wave",  url: wave,  label: "Hi!" },
  { id: "cool",  url: cool,  label: "Cool" },
  { id: "think", url: think, label: "Thinking" },
  { id: "sad",   url: sad,   label: "Sad" },
  { id: "cry",   url: cry,   label: "Crying" },
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
