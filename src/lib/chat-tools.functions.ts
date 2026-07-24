import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createGameAiProvider } from "./ai-gateway.server";

/**
 * Translate a short chat message into the requested target language.
 * Returns just the translated text — no quotes, no notes.
 */
export const translateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(1).max(4000),
        // BCP-47-ish language name or code — the model handles both.
        target: z.string().min(2).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { provider, model: modelId } = createGameAiProvider();
    const system =
      "You are a chat message translator. Translate the user's message into the requested target language. Output ONLY the translated text — no quotes, no explanations, no romanization, no source text. Preserve emojis and line breaks. If the message is already in the target language, return it unchanged.";
    const prompt = `Target language: ${data.target}\n\nMessage:\n${data.text}`;
    try {
      const { text } = await generateText({
        model: provider(modelId),
        system,
        prompt,
        maxOutputTokens: 600,
      });
      const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
      return { translation: cleaned || data.text };
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("429")) throw new Error("Translator is busy — try again in a moment.");
      if (msg.includes("402")) throw new Error("AI credits exhausted.");
      throw new Error("Couldn't translate right now.");
    }
  });
