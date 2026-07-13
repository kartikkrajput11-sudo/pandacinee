import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const INTENSITIES = ["sweet", "playful", "spicy", "deep"] as const;
type Intensity = (typeof INTENSITIES)[number];

const KIND_PROMPTS: Record<
  string,
  { system: string; schema: z.ZodTypeAny; user: (i: Intensity, seed: number) => string }
> = {
  "truth-or-dare": {
    system:
      "You generate romantic couple game cards for a private app used by two partners. Keep it consensual, warm, and specific. Never include anything unsafe, illegal, or explicit sexual content.",
    schema: z.object({
      type: z.enum(["truth", "dare"]),
      text: z.string(),
    }),
    user: (i, seed) =>
      `Generate one Truth or Dare card at intensity "${i}". Vary between truth and dare. Seed:${seed}. Keep under 22 words. No emojis.`,
  },
  "would-you-rather": {
    system:
      "You generate 'Would You Rather' dilemmas for a couple. Balanced, imaginative, fun. Never unsafe or explicit.",
    schema: z.object({ a: z.string(), b: z.string() }),
    user: (i, seed) =>
      `Generate one 'Would You Rather' dilemma at intensity "${i}". Two options, roughly equal appeal. Seed:${seed}. Each option under 12 words. No emojis. No 'Would you rather' prefix.`,
  },
  "this-or-that": {
    system: "You generate quick taste comparisons for a couple. Simple, evocative pairs.",
    schema: z.object({ a: z.string(), b: z.string() }),
    user: (i, seed) =>
      `Generate one 'This or That' pair at intensity "${i}". Each option 1-3 words. Seed:${seed}. No emojis.`,
  },
  "never-have-i-ever": {
    system:
      "You generate 'Never Have I Ever' statements for a couple. Playful, revealing, safe. Never illegal or explicit.",
    schema: z.object({ text: z.string() }),
    user: (i, seed) =>
      `Generate one 'Never Have I Ever' statement at intensity "${i}". Under 18 words. Seed:${seed}. Do NOT include the 'Never have I ever' prefix — just the action.`,
  },
  "guess-me": {
    system: "You generate 'How well do you know me?' prompts for a couple.",
    schema: z.object({ text: z.string() }),
    user: (i, seed) =>
      `Generate one 'Guess Me' prompt at intensity "${i}". A single question the partner must guess about the other. Under 16 words. Seed:${seed}.`,
  },
};

export const generateGameCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum([
          "truth-or-dare",
          "would-you-rather",
          "this-or-that",
          "never-have-i-ever",
          "guess-me",
        ]),
        intensity: z.enum(INTENSITIES).default("playful"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const cfg = KIND_PROMPTS[data.kind];
    const gateway = createLovableAiGatewayProvider(key);
    const seed = Math.floor(Math.random() * 1_000_000);
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: cfg.system,
        prompt: cfg.user(data.intensity, seed),
        output: Output.object({ schema: cfg.schema as z.ZodType<any> }),
      });
      return { card: output, seed };
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("429")) throw new Error("AI is busy — try again in a moment.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits to keep playing.");
      throw new Error("AI couldn't generate a card. Try again.");
    }
  });
