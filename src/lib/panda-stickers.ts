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

import duoHug from "@/assets/stickers/panda-duo-hug.png";
import duoKiss from "@/assets/stickers/panda-duo-kiss.png";
import duoHands from "@/assets/stickers/panda-duo-hands.png";
import duoDance from "@/assets/stickers/panda-duo-dance.png";
import duoCozy from "@/assets/stickers/panda-duo-cozy.png";
import duoSelfie from "@/assets/stickers/panda-duo-selfie.png";
import duoHeart from "@/assets/stickers/panda-duo-heart.png";
import duoHighfive from "@/assets/stickers/panda-duo-highfive.png";
import duoLipkiss from "@/assets/stickers/panda-duo-lipkiss.png";
import duoBed from "@/assets/stickers/panda-duo-bed.png";
import duoDip from "@/assets/stickers/panda-duo-dip.png";
import flirt from "@/assets/stickers/panda-flirt.png";
import bath from "@/assets/stickers/panda-bath.png";
import tease from "@/assets/stickers/panda-tease.png";
import peach from "@/assets/stickers/panda-peach.png";
import cuffs from "@/assets/stickers/panda-cuffs.png";
import unwrap from "@/assets/stickers/panda-unwrap.png";
import thirsty from "@/assets/stickers/panda-thirsty.png";
import bedroomEyes from "@/assets/stickers/panda-bedroom-eyes.png";
import comehere from "@/assets/stickers/panda-comehere.png";
import duoNeckkiss from "@/assets/stickers/panda-duo-neckkiss.png";
import dnd from "@/assets/stickers/panda-dnd.png";
import duoSpoon from "@/assets/stickers/panda-duo-spoon.png";
import rose from "@/assets/stickers/panda-rose.png";
import fanning from "@/assets/stickers/panda-fanning.png";
import behave from "@/assets/stickers/panda-behave.png";
import robe from "@/assets/stickers/panda-robe.png";
import bedhead from "@/assets/stickers/panda-bedhead.png";
import petals from "@/assets/stickers/panda-petals.png";
import candlebath from "@/assets/stickers/panda-candlebath.png";
import lipmark from "@/assets/stickers/panda-lipmark.png";

export type PandaStickerCategory = "love" | "joy" | "celebrate" | "wow" | "greet" | "chill" | "sad" | "partners" | "adult";

export type PandaStickerId =
  | "happy" | "love" | "sad" | "laugh" | "wink" | "kiss"
  | "angry" | "shy" | "sleep" | "cool" | "hug" | "wow"
  | "cry" | "blush" | "party" | "stars" | "think" | "wave" | "dance" | "heart-hands"
  | "confused" | "proud" | "pleading" | "mindblown" | "cozy" | "gift"
  | "cake" | "salute" | "facepalm" | "shrug" | "flex" | "gamer"
  | "duo-hug" | "duo-kiss" | "duo-hands" | "duo-dance" | "duo-cozy" | "duo-selfie" | "duo-heart" | "duo-highfive"
  | "duo-lipkiss" | "duo-bed" | "duo-dip" | "flirt" | "bath" | "tease"
  | "peach" | "cuffs" | "unwrap" | "thirsty"
  | "bedroom-eyes" | "comehere" | "duo-neckkiss" | "dnd" | "duo-spoon" | "rose" | "fanning" | "behave"
  | "robe" | "bedhead" | "petals" | "candlebath" | "lipmark";

export const PANDA_STICKERS: { id: PandaStickerId; url: string; label: string; category: PandaStickerCategory }[] = [
  // 💞 Partners (duo pandas)
  { id: "duo-hug",      url: duoHug,      label: "Together hug",  category: "partners" },
  { id: "duo-kiss",     url: duoKiss,     label: "Cheek kiss",    category: "partners" },
  { id: "duo-heart",    url: duoHeart,    label: "Our heart",     category: "partners" },
  { id: "duo-hands",    url: duoHands,    label: "Hand in hand",  category: "partners" },
  { id: "duo-cozy",     url: duoCozy,     label: "Cozy cocoa",    category: "partners" },
  { id: "duo-dance",    url: duoDance,    label: "Slow dance",    category: "partners" },
  { id: "duo-selfie",   url: duoSelfie,   label: "Selfie us",     category: "partners" },
  { id: "duo-highfive", url: duoHighfive, label: "High five",     category: "partners" },

  // ❤️ Love
  { id: "love",         url: love,        label: "In love",       category: "love" },
  { id: "heart-hands",  url: heartHands,  label: "Heart hands",   category: "love" },
  { id: "kiss",         url: kiss,        label: "Kiss",          category: "love" },
  { id: "hug",          url: hug,         label: "Hug",           category: "love" },
  { id: "blush",        url: blush,       label: "Blush",         category: "love" },
  { id: "shy",          url: shy,         label: "Shy",           category: "love" },

  // 😊 Joy
  { id: "happy",        url: happy,       label: "Happy",         category: "joy" },
  { id: "laugh",        url: laugh,       label: "Laughing",      category: "joy" },
  { id: "wink",         url: wink,        label: "Wink",          category: "joy" },
  { id: "cool",         url: cool,        label: "Cool",          category: "joy" },
  { id: "proud",        url: proud,       label: "Proud",         category: "joy" },
  { id: "flex",         url: flex,        label: "Strong",        category: "joy" },

  // 🎉 Celebrate
  { id: "party",        url: party,       label: "Party",         category: "celebrate" },
  { id: "dance",        url: dance,       label: "Dance",         category: "celebrate" },
  { id: "cake",         url: cake,        label: "Cake",          category: "celebrate" },
  { id: "gift",         url: gift,        label: "Gift",          category: "celebrate" },
  { id: "stars",        url: stars,       label: "Star-struck",   category: "celebrate" },

  // 🤯 Wow
  { id: "wow",          url: wow,         label: "Wow",           category: "wow" },
  { id: "mindblown",    url: mindblown,   label: "Mind blown",    category: "wow" },
  { id: "think",        url: think,       label: "Thinking",      category: "wow" },
  { id: "confused",     url: confused,    label: "Confused",      category: "wow" },
  { id: "shrug",        url: shrug,       label: "Shrug",         category: "wow" },

  // 👋 Greet
  { id: "wave",         url: wave,        label: "Hi!",           category: "greet" },
  { id: "salute",       url: salute,      label: "Salute",        category: "greet" },
  { id: "pleading",     url: pleading,    label: "Please?",       category: "greet" },
  { id: "gamer",        url: gamer,       label: "Gamer",         category: "greet" },

  // 🛌 Chill
  { id: "cozy",         url: cozy,        label: "Cozy",          category: "chill" },
  { id: "sleep",        url: sleep,       label: "Sleepy",        category: "chill" },

  // 😢 Sad
  { id: "sad",          url: sad,         label: "Sad",           category: "sad" },
  { id: "cry",          url: cry,         label: "Crying",        category: "sad" },
  { id: "angry",        url: angry,       label: "Angry",         category: "sad" },
  { id: "facepalm",     url: facepalm,    label: "Facepalm",      category: "sad" },

  // 🔞 Adult (18+)
  { id: "duo-lipkiss",  url: duoLipkiss,  label: "French kiss",   category: "adult" },
  { id: "duo-dip",      url: duoDip,      label: "Spank",         category: "adult" },
  { id: "duo-bed",      url: duoBed,      label: "Morning after", category: "adult" },
  { id: "tease",        url: tease,       label: "Lingerie",      category: "adult" },
  { id: "flirt",        url: flirt,       label: "Domme",         category: "adult" },
  { id: "bath",         url: bath,        label: "Wine & bath",   category: "adult" },
  { id: "peach",        url: peach,       label: "🍑🍆",           category: "adult" },
  { id: "cuffs",        url: cuffs,       label: "Cuff me",       category: "adult" },
  { id: "unwrap",       url: unwrap,      label: "Unwrap me",     category: "adult" },
  { id: "thirsty",      url: thirsty,     label: "Hot & bothered", category: "adult" },
  { id: "bedroom-eyes", url: bedroomEyes, label: "Bedroom eyes",  category: "adult" },
  { id: "comehere",     url: comehere,    label: "Come here",     category: "adult" },
  { id: "duo-neckkiss", url: duoNeckkiss, label: "Neck kiss",     category: "adult" },
  { id: "duo-spoon",    url: duoSpoon,    label: "Big spoon",     category: "adult" },
  { id: "dnd",          url: dnd,         label: "Do not disturb", category: "adult" },
  { id: "rose",         url: rose,        label: "Rose for you",  category: "adult" },
  { id: "fanning",      url: fanning,     label: "Flustered",     category: "adult" },
  { id: "behave",       url: behave,      label: "Behave 😏",     category: "adult" },
];

export const ADULT_CATEGORY: PandaStickerCategory = "adult";

export const PANDA_CATEGORY_ORDER: { id: PandaStickerCategory; label: string; emoji: string; adult?: boolean }[] = [
  { id: "partners",  label: "Partners",  emoji: "💞" },
  { id: "love",      label: "Love",      emoji: "❤️" },
  { id: "joy",       label: "Joy",       emoji: "😊" },
  { id: "celebrate", label: "Celebrate", emoji: "🎉" },
  { id: "wow",       label: "Wow",       emoji: "🤯" },
  { id: "greet",     label: "Greet",     emoji: "👋" },
  { id: "chill",     label: "Chill",     emoji: "🛌" },
  { id: "sad",       label: "Feelings",  emoji: "💧" },
  { id: "adult",     label: "18+",       emoji: "🔞", adult: true },
];

const ADULT_OK_KEY = "panda_adult_ok_v1";

export function isAdultUnlocked(): boolean {
  try { return localStorage.getItem(ADULT_OK_KEY) === "1"; } catch { return false; }
}
export function unlockAdult() {
  try { localStorage.setItem(ADULT_OK_KEY, "1"); } catch {}
}
export function lockAdult() {
  try { localStorage.removeItem(ADULT_OK_KEY); } catch {}
}



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
