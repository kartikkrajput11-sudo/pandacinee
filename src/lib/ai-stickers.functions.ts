import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SOLO_MOODS = [
  "happy", "love", "kiss", "hug", "shy", "wink",
  "laugh", "cry", "wow", "cool", "sleepy", "wave",
  "dance", "party", "heart-hands", "angry", "think", "blush",
] as const;

const COUPLE_MOODS = [
  "couple-kiss", "couple-hug", "couple-hearts", "couple-holding-hands",
  "couple-forehead-kiss", "couple-dance", "couple-piggyback", "couple-selfie",
  "couple-cuddle", "couple-picnic", "couple-umbrella", "couple-sleepy",
] as const;

const ALL_MOODS = [...SOLO_MOODS, ...COUPLE_MOODS] as const;

const Input = z.object({
  mood: z.enum(ALL_MOODS),
});

export type AiStickerMood = (typeof ALL_MOODS)[number];
export type AiStickerSoloMood = (typeof SOLO_MOODS)[number];
export type AiStickerCoupleMood = (typeof COUPLE_MOODS)[number];
export const AI_STICKER_SOLO_MOODS = SOLO_MOODS;
export const AI_STICKER_COUPLE_MOODS = COUPLE_MOODS;
export const AI_STICKER_MOODS = ALL_MOODS;

const SOLO_MOOD_PROMPTS: Record<AiStickerSoloMood, string> = {
  happy: "beaming a wide joyful smile, eyes sparkling with tiny highlights",
  love: "big glossy heart-shaped pupils, blowing a small kiss, floating pink hearts around",
  kiss: "eyes gently closed, cheeks softly pink, puckering lips into a big cute kiss with a floating heart",
  hug: "arms wide open for a warm hug, soft blush on cheeks, cozy smile",
  shy: "both hands over mouth, cheeks flushed deep pink, glancing away shyly",
  wink: "playful one-eye wink, tongue slightly out, one hand near face doing a peace sign",
  laugh: "laughing hard with eyes squinted into happy arcs, hand near mouth, sparkles",
  cry: "big glossy anime tears streaming, pouty trembling lip, adorable sad face",
  wow: "wide sparkling eyes, mouth open in surprise 'o', tiny stars around head",
  cool: "wearing pink heart-shaped sunglasses, cool confident smirk, chin slightly up",
  sleepy: "eyes softly closed, tiny 'zzz' floating above, hugging a small pillow",
  wave: "smiling brightly and waving one open hand hello, other hand relaxed",
  dance: "mid-dance pose with arms raised, hips shifted, music notes and sparkles around",
  party: "wearing tiny party hat, confetti falling, huge open-mouth grin, cheeks pink",
  "heart-hands": "making a small heart with both hands over chest, soft warm smile",
  angry: "cute pouty angry face, small cartoon steam puff from head, brows furrowed",
  think: "one finger to chin, eyes glancing up thoughtfully, small floating question mark",
  blush: "cheeks glowing pink, soft closed-mouth smile, tiny sparkles around face",
};

const COUPLE_MOOD_PROMPTS: Record<AiStickerCoupleMood, string> = {
  "couple-kiss": "the two characters sharing a sweet innocent peck, faces close together with eyes gently closed and cheeks softly pink, a big glossy heart floating above their heads — wholesome and cute",
  "couple-hug": "the two characters wrapped in a tight warm hug, one cheek pressed against the other's shoulder, soft blush, tiny sparkles",
  "couple-hearts": "the two characters standing close together, both making heart-hands together forming one big heart in the middle, glowing pink hearts around",
  "couple-holding-hands": "the two characters holding hands and looking at each other with soft smiles, tiny pink hearts floating between them",
  "couple-forehead-kiss": "one character tenderly kissing the other on the forehead, the other's eyes gently closed with a shy smile, warm glow",
  "couple-dance": "the two characters slow-dancing together, one hand joined, the other on the waist, music notes and sparkles around",
  "couple-piggyback": "one character giving the other a playful piggyback ride, both laughing brightly, motion lines and sparkles",
  "couple-selfie": "the two characters cheek to cheek taking a cute selfie, one holding a tiny phone, both giving peace signs, big smiles",
  "couple-cuddle": "the two characters cuddling under a shared blanket, sleepy soft smiles, tiny 'zzz' and hearts",
  "couple-picnic": "the two characters sitting on a picnic blanket sharing a strawberry, tiny basket, hearts and sparkles",
  "couple-umbrella": "the two characters sharing a small pink umbrella in gentle rain, leaning close, warm blush, tiny heart raindrops",
  "couple-sleepy": "the two characters napping side by side, heads leaned together, eyes closed, 'zzz' floating above, cozy",
};

const BASE_STYLE = `Ultra-professional kawaii chibi anime sticker in the style of a premium LINE / Kakao sticker pack.
Rendering: soft cel-shaded anime with clean crisp ink lineart of consistent weight, glossy highlights, subtle rim light, delicate blush gradients, tiny catchlights in the eyes, big expressive eyes.
Finish: die-cut sticker with a thin uniform white outer border and a soft drop shadow beneath — like a real vinyl sticker.
Faithful likeness — study the reference photo(s) carefully and reproduce EXACTLY:
  • hair color, hair length, hairstyle, parting, bangs, and any distinctive strands
  • skin tone
  • face shape and jawline proportions
  • eye shape and eye color
  • eyebrows shape
  • facial hair if present (beard / stubble / mustache) — match density and shape
  • eyeglasses / sunglasses — same frame shape, color and thickness
  • earrings, piercings, necklaces or any visible accessories
  • outfit — same top color, neckline, collar, pattern and layering as in the photo (stylized into chibi proportions but recognizable)
The person must be instantly recognizable to their friends. Do NOT invent hairstyles, outfits or glasses that are not in the photo. Do NOT change gender, age bracket or ethnicity.
Composition: head and upper torso only, centered, character fills most of the frame.
Background: PURE SOLID WHITE (#FFFFFF), no scenery, no props behind the character, no gradients.
Absolutely no text, no captions, no watermark, no logo, no signature.`;

const COUPLE_STYLE = `Ultra-professional kawaii chibi anime COUPLE sticker in the style of a premium LINE / Kakao sticker pack.
Render BOTH people from the reference photos together in ONE sticker as chibi anime characters.
Rendering: soft cel-shaded anime, clean crisp ink lineart of consistent weight, glossy highlights, subtle rim light, delicate blush, tiny catchlights in the eyes, big expressive eyes.
Finish: die-cut sticker with a thin uniform white outer border and a soft drop shadow beneath.
For EACH person, faithfully reproduce from their reference photo:
  • hair color, hair length, hairstyle, parting, bangs
  • skin tone
  • face shape and jawline proportions
  • eye shape and eye color
  • eyebrows
  • facial hair if present (match density and shape)
  • eyeglasses / sunglasses — same frame shape, color and thickness
  • earrings / piercings / necklaces
  • outfit — same top color, neckline, collar and pattern as their photo (stylized into chibi but recognizable)
Both must be instantly recognizable as themselves. Do NOT swap features between them. Do NOT invent hairstyles, outfits or glasses.
The FIRST reference image is Person A, the SECOND reference image is Person B — keep their identities distinct and consistent.
Composition: both characters together, full upper body or full body as needed, centered, filling most of the frame.
Background: PURE SOLID WHITE (#FFFFFF), no scenery behind them, no gradients.
Absolutely no text, no captions, no watermark, no logo.`;

async function fetchAvatarDataUrl(
  supabase: any,
  rawAvatar: string,
): Promise<string> {
  let fetchUrl = rawAvatar;
  if (!/^https?:\/\//i.test(rawAvatar)) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(rawAvatar, 300);
    if (!signed?.signedUrl) throw new Error("Couldn't access a profile photo.");
    fetchUrl = signed.signedUrl;
  }
  const imgRes = await fetch(fetchUrl);
  if (!imgRes.ok) throw new Error("Couldn't load a profile photo.");
  const mime = imgRes.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(bin)}`;
}

export const generateAiSticker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const isCouple = (COUPLE_MOODS as readonly string[]).includes(data.mood);

    const { data: me } = await (context.supabase as any)
      .from("profiles")
      .select("avatar_url, partner_id")
      .eq("id", context.userId)
      .maybeSingle();

    const myAvatar = me?.avatar_url as string | null | undefined;
    if (!myAvatar) {
      throw new Error("Add a profile photo first to generate AI stickers.");
    }

    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [];

    if (isCouple) {
      if (!me?.partner_id) {
        throw new Error("Pair with your partner first to make couple stickers.");
      }
      const { data: partner } = await (context.supabase as any)
        .from("profiles")
        .select("avatar_url")
        .eq("id", me.partner_id)
        .maybeSingle();
      const partnerAvatar = partner?.avatar_url as string | null | undefined;
      if (!partnerAvatar) {
        throw new Error("Your partner needs to upload a profile photo first.");
      }
      const [aUrl, bUrl] = await Promise.all([
        fetchAvatarDataUrl(context.supabase, myAvatar),
        fetchAvatarDataUrl(context.supabase, partnerAvatar),
      ]);
      const prompt = `${COUPLE_STYLE}
Scene / pose: ${COUPLE_MOOD_PROMPTS[data.mood as AiStickerCoupleMood]}.`;
      content.push({ type: "text", text: prompt });
      content.push({ type: "text", text: "Reference for Person A (the first person):" });
      content.push({ type: "image_url", image_url: { url: aUrl } });
      content.push({ type: "text", text: "Reference for Person B (the second person):" });
      content.push({ type: "image_url", image_url: { url: bUrl } });
    } else {
      const dataUrl = await fetchAvatarDataUrl(context.supabase, myAvatar);
      const prompt = `${BASE_STYLE}
Pose / expression: ${SOLO_MOOD_PROMPTS[data.mood as AiStickerSoloMood]}.`;
      content.push({ type: "text", text: prompt });
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      if (aiRes.status === 429) throw new Error("The sticker studio is busy — try again shortly.");
      if (aiRes.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`Sticker generation failed (${aiRes.status}). ${errText.slice(0, 200)}`);
    }

    const payload = (await aiRes.json()) as any;
    // Try both image_generations and chat_completions response shapes.
    let outB64: string | undefined = payload?.data?.[0]?.b64_json;
    if (!outB64) {
      const url: string | undefined = payload?.data?.[0]?.url;
      if (url?.startsWith("data:")) outB64 = url.split(",")[1];
    }
    if (!outB64) {
      // Chat-completions style: choices[0].message.images[0].image_url.url
      const imgs = payload?.choices?.[0]?.message?.images;
      const u = imgs?.[0]?.image_url?.url ?? imgs?.[0]?.url;
      if (typeof u === "string" && u.startsWith("data:")) outB64 = u.split(",")[1];
    }
    if (!outB64) {
      // Content parts array
      const parts = payload?.choices?.[0]?.message?.content;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          const u = p?.image_url?.url ?? p?.image?.url;
          if (typeof u === "string" && u.startsWith("data:")) { outB64 = u.split(",")[1]; break; }
          if (typeof p?.b64_json === "string") { outB64 = p.b64_json; break; }
        }
      }
    }
    if (!outB64) {
      const refusal =
        payload?.choices?.[0]?.message?.content?.toString?.() ||
        payload?.data?.[0]?.revised_prompt ||
        "";
      throw new Error(
        isCouple
          ? `Couldn't generate this couple sticker — try a gentler pose or a different mood.${refusal ? ` (${String(refusal).slice(0, 120)})` : ""}`
          : "The model didn't return a sticker. Try again.",
      );
    }

    const binary = atob(outB64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);

    const path = `${context.userId}/ai-sticker/${data.mood}-${crypto.randomUUID()}.png`;
    const { error: upErr } = await context.supabase.storage
      .from("chat-media")
      .upload(path, out, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(upErr.message);

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
