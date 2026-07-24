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
import confused from "@/assets/stickers/panda-confused.png";
import proud from "@/assets/stickers/panda-proud.png";
import pleading from "@/assets/stickers/panda-pleading.png";
import mindblown from "@/assets/stickers/panda-mindblown.png";
import cozy from "@/assets/stickers/panda-cozy.png";
import gift from "@/assets/stickers/panda-gift.png";
import cake from "@/assets/stickers/panda-cake.png";
import salute from "@/assets/stickers/panda-salute.png";
import facepalm from "@/assets/stickers/panda-facepalm.png";
import shrug from "@/assets/stickers/panda-shrug.png";
import flex from "@/assets/stickers/panda-flex.png";
import gamer from "@/assets/stickers/panda-gamer.png";

export type PandaStickerId =
  | "happy" | "love" | "sad" | "laugh" | "wink" | "kiss"
  | "angry" | "shy" | "sleep" | "cool" | "hug" | "wow"
  | "cry" | "blush" | "party" | "stars" | "think" | "wave" | "dance" | "heart-hands"
  | "confused" | "proud" | "pleading" | "mindblown" | "cozy" | "gift"
  | "cake" | "salute" | "facepalm" | "shrug" | "flex" | "gamer";

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
  { id: "cake",  url: cake,  label: "Cake" },
  { id: "gift",  url: gift,  label: "Gift" },
  { id: "stars", url: stars, label: "Star-struck" },
  { id: "wow",   url: wow,   label: "Wow" },
  { id: "mindblown", url: mindblown, label: "Mind blown" },
  { id: "wave",  url: wave,  label: "Hi!" },
  { id: "salute", url: salute, label: "Salute" },
  { id: "cool",  url: cool,  label: "Cool" },
  { id: "proud", url: proud, label: "Proud" },
  { id: "flex",  url: flex,  label: "Strong" },
  { id: "gamer", url: gamer, label: "Gamer" },
  { id: "cozy",  url: cozy,  label: "Cozy" },
  { id: "think", url: think, label: "Thinking" },
  { id: "confused", url: confused, label: "Confused" },
  { id: "shrug", url: shrug, label: "Shrug" },
  { id: "pleading", url: pleading, label: "Please?" },
  { id: "facepalm", url: facepalm, label: "Facepalm" },
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
