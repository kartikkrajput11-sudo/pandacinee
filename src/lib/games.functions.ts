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

const INTENSITY_GUIDE: Record<Intensity, string> = {
  sweet:
    "Sweet tier: tender, wholesome, gentle. Memories, appreciation, cute gestures. Absolutely nothing suggestive.",
  playful:
    "Playful tier: light, flirty, silly, giggly. Small dares, fun confessions. Playful teasing only.",
  spicy:
    "Spicy tier: bold, flirty, sensual, seductive between committed partners. Kisses, teasing touches, sultry confessions, whispered fantasies, intimate compliments, roleplay ideas. Suggestive is REQUIRED at this tier — sweet or generic questions are wrong. Stay consensual and tasteful; no explicit sexual acts or graphic anatomy.",
  deep:
    "Deep tier: vulnerable, emotional, introspective. Fears, dreams, growth, relationship reflection. Serious, not flirty.",
};

const KIND_PROMPTS: Record<string, KindCfg & { userTyped?: (i: Intensity, seed: number, type: "truth" | "dare") => string }> = {
  "truth-or-dare": {
    system:
      "You generate romantic couple game cards for a private app used by two committed partners. Match the requested intensity tier precisely — if 'spicy' is asked, the card MUST feel spicy (flirty, sensual, seductive), not sweet. Keep it consensual and tasteful; never include illegal content, graphic anatomy, or explicit sexual acts. Always respond with valid JSON only, no prose, no code fences.",
    schema: z.object({ type: z.enum(["truth", "dare"]), text: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"type":"truth"|"dare","text":"..."} for one Truth or Dare card. Intensity: "${i}". ${INTENSITY_GUIDE[i]} If it's a DARE, it MUST be an interactive action the player performs and SENDS to their partner right now — strongly favor: send a selfie doing X, send a photo of Y around them, send a voice note singing/whispering/reading Z, record a short video doing W, draw a doodle and send it, type a poem/love note. The dare must be doable from a phone in under 2 minutes and produce something the partner receives. Vary between truth and dare. Under 22 words. No emojis. Seed:${seed}.`,
    userTyped: (i, seed, type) =>
      type === "dare"
        ? `Return ONLY a JSON object like {"type":"dare","text":"..."} for one DARE card. Intensity: "${i}". ${INTENSITY_GUIDE[i]} The dare MUST be an interactive action the player performs on their phone and SENDS to their partner. Strongly favor one of: send a selfie doing X, send a photo of Y around them, send a voice note singing/whispering/reading Z, record a short video doing W, draw a doodle & send it, type a heartfelt note. Doable in under 2 minutes; must produce something the partner receives. The "type" field MUST be "dare". Under 22 words. No emojis. Seed:${seed}.`
        : `Return ONLY a JSON object like {"type":"truth","text":"..."} for one TRUTH question card. Intensity: "${i}". ${INTENSITY_GUIDE[i]} The "type" field MUST be "truth". Under 22 words. No emojis. Seed:${seed}.`,
  },
  "would-you-rather": {
    system:
      "You generate 'Would You Rather' dilemmas for a committed couple. Match the intensity tier precisely — spicy means flirty/sensual dilemmas, not generic ones. Balanced, imaginative, consensual, tasteful. Always respond with valid JSON only.",
    schema: z.object({ a: z.string(), b: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"a":"...","b":"..."} for one 'Would You Rather' dilemma. Intensity: "${i}". ${INTENSITY_GUIDE[i]} Two options, roughly equal appeal, each under 12 words. No emojis. No 'Would you rather' prefix. Seed:${seed}.`,
  },
  "this-or-that": {
    system:
      "You generate quick taste comparisons for a couple. Match the intensity tier — spicy means sensual/flirty pairs. Always respond with valid JSON only.",
    schema: z.object({ a: z.string(), b: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"a":"...","b":"..."} for one 'This or That' pair. Intensity: "${i}". ${INTENSITY_GUIDE[i]} Each option 1-3 words. No emojis. Seed:${seed}.`,
  },
  "never-have-i-ever": {
    system:
      "You generate 'Never Have I Ever' statements for a committed couple. Match the intensity tier — spicy means flirty/sensual, sweet means wholesome. Consensual and tasteful; never illegal or graphic. Always respond with valid JSON only.",
    schema: z.object({ text: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"text":"..."} for one 'Never Have I Ever' statement. Intensity: "${i}". ${INTENSITY_GUIDE[i]} Under 18 words. Do NOT include the 'Never have I ever' prefix — just the action. Seed:${seed}.`,
    fallback: (raw) => ({ text: stripQuotes(raw) }),
  },
  "guess-me": {
    system:
      "You generate 'How well do you know me?' prompts for a couple. Match the intensity tier. Always respond with valid JSON only.",
    schema: z.object({ text: z.string() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"text":"..."} for one 'Guess Me' prompt. Intensity: "${i}". ${INTENSITY_GUIDE[i]} A single question the partner must guess about the other. Under 16 words. Seed:${seed}.`,
    fallback: (raw) => ({ text: stripQuotes(raw) }),
  },
  "two-truths-lie": {
    system:
      "You invent 'Two Truths & a Lie' rounds for a committed couple. Return three short first-person statements that a person in a relationship might say — two plausibly true, one a convincing lie. Match the intensity tier. Consensual and tasteful; never illegal or graphic. Always respond with valid JSON only.",
    schema: z.object({
      statements: z.array(z.string()),
      lie: z.number(),
      reveal: z.string(),
    }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"statements":["...","...","..."],"lie":0,"reveal":"one sentence explaining the lie"} for one Two Truths & a Lie round. Intensity: "${i}". ${INTENSITY_GUIDE[i]} Exactly three first-person statements ("I once…", "I secretly…"), 6-14 words each, believable, no emojis, no numbering. "lie" is an integer 0, 1, or 2 — randomize which index. Seed:${seed}.`,
  },
  "hot-takes": {
    system:
      "You write bold, opinionated 'hot takes' about love and relationships for a committed couple to react to. Provocative but respectful. Match the intensity tier. Always respond with valid JSON only.",
    schema: z.object({ text: z.string(), tag: z.string().optional() }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"text":"one hot take","tag":"short topic tag"} for one relationship hot take. Intensity: "${i}". ${INTENSITY_GUIDE[i]} A single opinionated statement (not a question) that partners will strongly agree or disagree with. Under 20 words. No emojis. No "hot take:" prefix. Tag is 1-2 words. Seed:${seed}.`,
    fallback: (raw) => ({ text: stripQuotes(raw) }),
  },
  "emoji-riddle": {
    system:
      "You encode a well-known movie, song, book, phrase, or shared-life vibe as a short emoji sequence for a couple to guess. Iconic, guessable, playful. Always respond with valid JSON only.",
    schema: z.object({
      emojis: z.string(),
      answer: z.string(),
      category: z.string(),
      hint: z.string(),
    }),
    user: (i, seed) =>
      `Return ONLY a JSON object like {"emojis":"🦁👑","answer":"The Lion King","category":"movie","hint":"Disney classic"} for one emoji riddle. Intensity: "${i}". ${INTENSITY_GUIDE[i]} 2-6 emojis, iconic and solvable. Answer is 1-5 words. Category is one of: movie, song, book, phrase, vibe. Hint is under 6 words. Rotate categories. Seed:${seed}.`,
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
          "two-truths-lie",
          "hot-takes",
          "emoji-riddle",
        ]),
        intensity: z.enum(INTENSITIES).default("playful"),
        type: z.enum(["truth", "dare"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const cfg = KIND_PROMPTS[data.kind];
    const gateway = createLovableAiGatewayProvider(key);
    const seed = Math.floor(Math.random() * 1_000_000);
    const prompt =
      data.kind === "truth-or-dare" && data.type && cfg.userTyped
        ? cfg.userTyped(data.intensity, seed, data.type)
        : cfg.user(data.intensity, seed);

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: cfg.system,
        prompt,
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

/** Generate a 5-question quiz about the couple based on hints they provide. */
const QuizQuestion = z.object({
  q: z.string().min(4),
  options: z.array(z.string().min(1)).length(4),
  answer: z.number().int().min(0).max(3),
});
const QuizSchema = z.object({ questions: z.array(QuizQuestion).length(5) });

export const generateLoveQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        // Optional hints: nicknames, favorites, memories the couple shared.
        hints: z.string().max(2000).optional(),
        seed: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const seed = data.seed ?? Math.floor(Math.random() * 1_000_000);

    const system =
      "You generate short, warm 'how well do you know your partner' quizzes for couples. Playful, consensual, safe. Always respond with valid JSON only, no prose, no code fences.";
    const prompt = `Return ONLY a JSON object like {"questions":[{"q":"...","options":["a","b","c","d"],"answer":0}, ...]} with exactly 5 questions. Each question has 4 concise options (2-6 words) and one correct answer index (0-3). Use general couple-relatable questions like favorites, habits, love languages, ideal dates. Keep questions under 14 words. Seed:${seed}. ${
      data.hints ? `Couple hints: ${data.hints}` : ""
    }`.trim();

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system,
        prompt,
        output: Output.object({ schema: QuizSchema as z.ZodType<any> }),
      });
      return { quiz: output, seed };
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("429")) throw new Error("AI is busy — try again in a moment.");
      if (msg.includes("402"))
        throw new Error("AI credits exhausted. Add credits to keep playing.");
      // Fallback quiz so the game is always playable
      return {
        quiz: {
          questions: [
            { q: "Their ideal weekend?", options: ["Cozy in", "Wild night out", "Nature trip", "Café hopping"], answer: 0 },
            { q: "Their comfort snack?", options: ["Chocolate", "Chips", "Ice cream", "Instant noodles"], answer: 2 },
            { q: "Preferred love language?", options: ["Words", "Touch", "Gifts", "Quality time"], answer: 3 },
            { q: "Their morning mood?", options: ["Sunshine", "Grumpy", "Sleepy", "Chatty"], answer: 2 },
            { q: "Their dream trip?", options: ["Beach", "Mountains", "City", "Countryside"], answer: 0 },
          ],
        },
        seed,
      };
    }
  });

