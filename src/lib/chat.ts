import { supabase } from "@/integrations/supabase/client";

export const STICKERS = [
  "🐼", "🌸", "💜", "🫶", "🥺", "😘", "🤗", "😴",
  "🍿", "🎬", "🌙", "⭐", "🔥", "💫", "🌷", "🍓",
  "☕", "🍜", "🎀", "💌", "🧸", "🪐", "🦋", "🌈",
];

export const DISAPPEAR_OPTIONS = [
  { label: "Off", seconds: null as number | null },
  { label: "1 min", seconds: 60 },
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
];

export type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id: string | null;
  content: string;
  created_at: string;
  type: string;
  media_url: string | null;
  media_meta: Record<string, unknown> | null;
  reply_to_id: string | null;
  reactions: Record<string, string[]>;
  read_at: string | null;
  pinned: boolean;
  expires_at: string | null;
};

export function chatChannelKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export async function uploadChatMedia(
  file: Blob,
  userId: string,
  kind: "voice" | "image" | "file" | "video",
  ext: string,
) {
  const path = `${userId}/${kind}/${crypto.randomUUID()}.${ext}`;
  // Supabase storage rejects mime types with codec parameters
  // (e.g. "audio/webm;codecs=opus"). Strip them to the base type.
  const rawType = file.type || "";
  const baseType = rawType.split(";")[0].trim();
  const fallback =
    kind === "voice" ? "audio/webm" :
    kind === "image" ? "image/jpeg" :
    kind === "video" ? "video/mp4" :
    "application/octet-stream";
  const contentType = baseType || fallback;
  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}


export async function signMedia(path: string) {
  const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export function expirySeconds(secs: number | null): string | null {
  if (!secs) return null;
  return new Date(Date.now() + secs * 1000).toISOString();
}
