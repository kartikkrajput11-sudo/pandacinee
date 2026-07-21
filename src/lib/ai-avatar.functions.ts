import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STYLE_PROMPTS: Record<string, string> = {
  anime:
    "premium chibi anime portrait, big expressive eyes with catchlights, clean cel-shaded lineart, soft blush, glossy highlights",
  watercolor:
    "loose romantic watercolor portrait, warm pigment blooms, delicate ink outlines, dreamy candlelit glow",
  oil:
    "renaissance oil-painting portrait, chiaroscuro lighting, rich burgundy and gold tones, painterly brushwork, museum grade",
  cinematic:
    "cinematic editorial portrait, moody film-grain, warm rim light, shallow depth of field, film still aesthetic",
  royal:
    "regal royal portrait, velvet cloak, ornate gold filigree background, candlelight, oil-painting finish",
  neon:
    "neon cyberpunk portrait, magenta and cyan rim lighting, soft bokeh city lights, glossy skin, editorial cool",
  storybook:
    "whimsical storybook illustration, soft gouache, gentle pastel palette, warm cozy mood",
  vintage:
    "vintage 35mm film portrait, faded warm tones, subtle grain, soft focus, nostalgic mood",
};

const Input = z.object({
  style: z.string().min(1).max(40).default("anime"),
  extra: z.string().max(240).optional(),
});

function isUploadedProfilePhoto(userId: string, avatar: string | null | undefined) {
  const value = avatar?.trim();
  if (!value) return false;
  if (/^(https?:|data:)/i.test(value)) return false;
  return value.startsWith(`${userId}/`);
}

async function fetchAvatarDataUrl(supabase: any, userId: string, rawAvatar: string): Promise<string> {
  const { data: signed } = await supabase.storage
    .from("avatars")
    .createSignedUrl(rawAvatar, 300);
  if (!signed?.signedUrl) throw new Error("Couldn't access your profile photo.");
  const res = await fetch(signed.signedUrl);
  if (!res.ok) throw new Error("Couldn't load your profile photo.");
  const mime = res.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(bin)}`;
}

export const generateAiAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const userId = context.userId;
    if (!userId) throw new Error("Sign in again to generate an avatar.");

    const { data: me } = await (context.supabase as any)
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const rawAvatar = me?.avatar_url as string | null | undefined;
    if (!isUploadedProfilePhoto(userId, rawAvatar)) {
      throw new Error("Upload a real profile photo first so the AI portrait can match your face.");
    }

    const dataUrl = await fetchAvatarDataUrl(context.supabase, userId, rawAvatar!.trim());
    const styleKey = data.style.toLowerCase();
    const stylePrompt = STYLE_PROMPTS[styleKey] ?? data.style;

    const prompt = `Ultra-luxury profile portrait for a private couple's app.
Style: ${stylePrompt}.
Faithful likeness — study the reference photo carefully and reproduce EXACTLY:
  • hair color, length, hairstyle, parting, bangs
  • skin tone
  • face shape, jawline, eye shape and eye color, eyebrows
  • facial hair if present (density and shape)
  • eyeglasses / sunglasses (same frame shape, color, thickness)
  • earrings / piercings / necklaces / distinctive accessories
Do NOT change gender, age bracket or ethnicity. Do NOT invent hairstyles or glasses that aren't in the photo.
Composition: centered head-and-shoulders, subject fills most of the frame, square 1:1 framing.
Background: soft luxurious vignette that complements the subject — no scenery, no text, no watermark, no logo.
${data.extra ? `Extra direction: ${data.extra}.` : ""}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
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
      if (aiRes.status === 429) throw new Error("The AI studio is busy — try again shortly.");
      if (aiRes.status === 402) throw new Error("AI credits exhausted. Ask the workspace owner to top up.");
      throw new Error(`Avatar generation failed (${aiRes.status}). ${errText.slice(0, 200)}`);
    }

    const payload = (await aiRes.json()) as any;
    let outB64: string | undefined = payload?.data?.[0]?.b64_json;
    if (!outB64) {
      const url: string | undefined = payload?.data?.[0]?.url;
      if (url?.startsWith("data:")) outB64 = url.split(",")[1];
    }
    if (!outB64) {
      const imgs = payload?.choices?.[0]?.message?.images;
      const u = imgs?.[0]?.image_url?.url ?? imgs?.[0]?.url;
      if (typeof u === "string" && u.startsWith("data:")) outB64 = u.split(",")[1];
    }
    if (!outB64) {
      const parts = payload?.choices?.[0]?.message?.content;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          const u = p?.image_url?.url ?? p?.image?.url;
          if (typeof u === "string" && u.startsWith("data:")) { outB64 = u.split(",")[1]; break; }
          if (typeof p?.b64_json === "string") { outB64 = p.b64_json; break; }
        }
      }
    }
    if (!outB64) throw new Error("The model didn't return an image. Try again.");

    const binary = atob(outB64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);

    const path = `${userId}/avatar.png`;
    const { error: upErr } = await context.supabase.storage
      .from("avatars")
      .upload(path, out, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { error: updErr } = await (context.supabase as any)
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);
    if (updErr) throw new Error(updErr.message);

    return { path };
  });
