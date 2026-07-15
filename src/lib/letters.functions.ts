import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

/**
 * Called by the recipient to break the seal on a letter (once the unlock
 * time has passed). Uses the SECURITY DEFINER RPC created in the
 * love-letters migration.
 */
export const openLoveLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).rpc("open_love_letter", {
      _id: data.id,
    });
    if (error) throw new Error(error.message ?? "Could not open letter");
    return row;
  });

/**
 * AI-assisted love-letter draft. Sender gives a few notes (mood, memory,
 * intent) and the assistant produces a short, tender draft they can edit.
 */
const DraftInput = z.object({
  hints: z.string().max(600).optional(),
  tone: z.enum(["tender", "playful", "poetic", "vulnerable"]).default("tender"),
  partnerName: z.string().max(60).optional(),
});

export const draftLoveLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const seed = Math.floor(Math.random() * 1_000_000);
    const schema = z.object({ title: z.string(), body: z.string() });
    const system =
      "You ghostwrite short love letters for a person to send to their committed partner. Warm, specific, unashamedly sincere. Never generic Hallmark filler. No emojis. No headings. Always respond with valid JSON only.";
    const prompt = `Return ONLY a JSON object like {"title":"...","body":"..."} for one love letter draft. Tone: ${data.tone}. ${data.partnerName ? `Addressed to: ${data.partnerName}.` : ""} Writer's notes: ${data.hints ?? "(none — improvise a small, specific memory)"}. Title under 6 words. Body 60-140 words, in 2-3 short paragraphs, in the voice of the writer speaking to their beloved. No emojis. No sign-off name. Seed:${seed}`;

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system,
        prompt,
        output: Output.object({ schema: schema as z.ZodType<any> }),
      });
      return output;
    } catch (err: any) {
      if (NoObjectGeneratedError.isInstance?.(err) || err?.text) {
        const raw = String(err.text ?? "");
        try {
          const stripped = raw.replace(/```json\s*|```/g, "").trim();
          const m = stripped.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = schema.safeParse(JSON.parse(m[0]));
            if (parsed.success) return parsed.data;
          }
        } catch {
          /* fall through */
        }
      }
      const msg = String(err?.message ?? "");
      if (msg.includes("429")) throw new Error("AI is busy — try again in a moment.");
      if (msg.includes("402")) throw new Error("AI credits exhausted.");
      throw new Error("The muse is quiet. Try again.");
    }
  });
