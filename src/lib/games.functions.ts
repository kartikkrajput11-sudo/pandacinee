import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const INTENSITIES = ["sweet", "playful", "spicy", "deep"] as const;
type Intensity = (typeof INTENSITIES)[number];

type KindCfg = {
  system: string;
  schema: z.ZodTypeAny;
  user: (i: Intensity, seed: number) => string;
  /** Parse a raw string response (when the model returns text instead of JSON). */
  fallback?: (raw: string) => unknown | null;
};

function stripQuotes(s: string) {
  return s.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

const KIND_PROMPTS: Record<string, KindCfg> = {
  "truth-or-dare": {
    system:
      "You generate romantic couple game cards for a private app used by two partners. Keep it consensual, warm, and specific. Never include anything unsafe, illegal, or explicit sexual content. Always respond with valid JSON only, no prose, no code fences.",
    schema: z.object({ type: z.enum(["truth", "dare"]), text: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"type":"truth"|"dare","text":"..."} for one Truth or Dare card at intensity "${i}". Vary between truth and dare. Under 22 words. No emojis. Seed:${seed}.`,
  },
  "would-you-rather": {
    system:
      "You generate 'Would You Rather' dilemmas for a couple. Balanced, imaginative, fun. Never unsafe or explicit. Always respond with valid JSON only.",
    schema: z.object({ a: z.string(), b: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"a":"...","b":"..."} for one 'Would You Rather' dilemma at intensity "${i}". Two options, roughly equal appeal, each under 12 words. No emojis. No 'Would you rather' prefix. Seed:${seed}.`,
  },
  "this-or-that": {
    system:
      "You generate quick taste comparisons for a couple. Simple, evocative pairs. Always respond with valid JSON only.",
    schema: z.object({ a: z.string(), b: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"a":"...","b":"..."} for one 'This or That' pair at intensity "${i}". Each option 1-3 words. No emojis. Seed:${seed}.`,
  },
  "never-have-i-ever": {
    system:
      "You generate 'Never Have I Ever' statements for a couple. Playful, revealing, safe. Never illegal or explicit. Always respond with valid JSON only.",
    schema: z.object({ text: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"text":"..."} for one 'Never Have I Ever' statement at intensity "${i}". Under 18 words. Do NOT include the 'Never have I ever' prefix — just the action. Seed:${seed}.`,
    fallback: (raw) => ({ text: stripQuotes(raw) }),
  },
  "guess-me": {
    system:
      "You generate 'How well do you know me?' prompts for a couple. Always respond with valid JSON only.",
    schema: z.object({ text: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"text":"..."} for one 'Guess Me' prompt at intensity "${i}". A single question the partner must guess about the other. Under 16 words. Seed:${seed}.`,
    fallback: (raw) => ({ text: stripQuotes(raw) }),
  },
};

/** Best-effort recover a JSON object from a model that returned prose / fenced code / bare string. */
function tryExtractJson(raw: string): unknown | null {
  if (!raw) return null;
  const stripped = raw.replace(/```json\s*|```/g, "").trim();
  // Direct parse
  try {
    return JSON.parse(stripped);
  } catch {
    // Find first { ... } block
    const m = stripped.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fallthrough */
      }
    }
  }
  return null;
}

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
      // Gemini often returns a bare string / prose despite response_format: json_object.
      // Recover from the raw text when possible before failing.
      if (NoObjectGeneratedError.isInstance?.(err) || err?.text) {
        const raw = String(err.text ?? "");
        const extracted = tryExtractJson(raw);
        if (extracted) {
          const parsed = cfg.schema.safeParse(extracted);
          if (parsed.success) return { card: parsed.data, seed };
        }
        if (cfg.fallback) {
          const fb = cfg.fallback(raw);
          const parsed = cfg.schema.safeParse(fb);
          if (parsed.success) return { card: parsed.data, seed };
        }
      }
      const msg = String(err?.message ?? "");
      if (msg.includes("429")) throw new Error("AI is busy — try again in a moment.");
      if (msg.includes("402"))
        throw new Error("AI credits exhausted. Add credits to keep playing.");
      throw new Error("AI couldn't generate a card. Try again.");
    }
  });
