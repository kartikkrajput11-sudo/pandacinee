import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MOODS = [
  "happy", "love", "kiss", "hug", "shy", "wink",
  "laugh", "cry", "wow", "cool", "sleepy", "wave",
  "dance", "party", "heart-hands", "angry", "think", "blush",
] as const;

const Input = z.object({
  mood: z.enum(MOODS),
});

export type AiStickerMood = (typeof MOODS)[number];
export const AI_STICKER_MOODS = MOODS;

const MOOD_PROMPTS: Record<AiStickerMood, string> = {
  happy: "beaming a wide joyful smile, eyes sparkling",
  love: "big heart eyes, blowing a small kiss, floating hearts around",
  kiss: "eyes closed, cheeks pink, sending a big cute kiss with a heart",
  hug: "arms wide open for a warm hug, soft blush",
  shy: "hands over mouth, cheeks flushed, looking away shyly",
  wink: "playful wink with tongue slightly out, one hand near face",
  laugh: "laughing hard with eyes squinted, hand near mouth",
  cry: "big anime tears streaming, pouty lip, adorable",
  wow: "wide sparkling eyes, mouth open in surprise, stars around",
  cool: "wearing pink heart-shaped sunglasses, cool confident smirk",
  sleepy: "eyes closed, tiny 'zzz' floating, holding a small pillow",
  wave: "smiling brightly and waving one hand hello",
  dance: "mid-dance pose, arms raised, music notes and sparkles",
  party: "wearing tiny party hat, confetti falling, huge grin",
  "heart-hands": "making a heart with both hands over chest, soft smile",
  angry: "cute pouty angry face, small cartoon steam puff, brows furrowed",
  think: "one finger to chin, thoughtful expression, small question mark",
  blush: "cheeks glowing pink, soft smile, sparkles around face",
};

export const generateAiSticker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const { data: profile } = await (context.supabase as any)
      .from("profiles")
      .select("avatar_url")
      .eq("id", context.userId)
      .maybeSingle();

    const rawAvatar = profile?.avatar_url as string | null | undefined;
    if (!rawAvatar) {
      throw new Error("Add a profile photo first to generate AI stickers of yourself.");
    }

    let fetchUrl = rawAvatar;
    if (!/^https?:\/\//i.test(rawAvatar)) {
      const { data: signed } = await context.supabase.storage
        .from("avatars")
        .createSignedUrl(rawAvatar, 300);
      if (!signed?.signedUrl) throw new Error("Couldn't access your profile photo.");
      fetchUrl = signed.signedUrl;
    }

    // Fetch avatar bytes and inline as base64 for the model.
    const imgRes = await fetch(fetchUrl);
    if (!imgRes.ok) throw new Error("Couldn't load your profile photo.");
    const mime = imgRes.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const dataUrl = `data:${mime};base64,${b64}`;

    const prompt = `Turn the person in the reference photo into a CUTE ANIME CHIBI STICKER.
Style: kawaii chibi, soft cel-shaded anime, thick clean outline, big expressive eyes, glossy shading, sticker vibe.
Pose / expression: ${MOOD_PROMPTS[data.mood]}.
Keep it clearly recognizable as the same person (hair color, hair style, skin tone, any glasses).
Only head and upper torso. Centered composition.
Background: PLAIN SOLID WHITE, no scene, no props behind the character.
No text, no watermark, no logo.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      if (aiRes.status === 429) throw new Error("The sticker studio is busy — try again shortly.");
      if (aiRes.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`Sticker generation failed (${aiRes.status}). ${errText.slice(0, 200)}`);
    }

    const payload = (await aiRes.json()) as { data?: { b64_json?: string }[] };
    const outB64 = payload.data?.[0]?.b64_json;
    if (!outB64) throw new Error("The model didn't return a sticker. Try again.");

    // Decode base64 → bytes
    const binary = atob(outB64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);

    const path = `${context.userId}/ai-sticker/${data.mood}-${crypto.randomUUID()}.png`;
    const { error: upErr } = await context.supabase.storage
      .from("chat-media")
      .upload(path, out, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(upErr.message);

    // Upsert row (unique per user+mood). Delete previous row for that mood.
    await (context.supabase as any)
      .from("ai_stickers")
      .delete()
      .eq("user_id", context.userId)
      .eq("mood", data.mood);

    const { data: inserted, error: insErr } = await (context.supabase as any)
      .from("ai_stickers")
      .insert({ user_id: context.userId, mood: data.mood, storage_path: path })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    return inserted as {
      id: string;
      user_id: string;
      mood: AiStickerMood;
      storage_path: string;
      created_at: string;
    };
  });
