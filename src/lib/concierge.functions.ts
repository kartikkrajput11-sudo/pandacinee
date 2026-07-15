import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const KINDS = ["date", "gift", "trip", "note", "ritual"] as const;

const SuggestionSchema = z.object({
  kind: z.string(),
  title: z.string(),
  body: z.string(),
});

const BatchSchema = z.object({
  suggestions: z.array(SuggestionSchema),
});

const Input = z.object({
  partnerId: z.string().uuid(),
  mood: z.string().max(60).optional(),
  budget: z.enum(["cozy", "modest", "splurge"]).default("modest"),
  focus: z.array(z.enum(KINDS)).default(["date", "gift", "trip", "note", "ritual"]),
  hints: z.string().max(600).optional(),
});

/**
 * Generates a small batch (5) of tailored couple ideas across kinds and
 * persists them to concierge_suggestions so both partners see the same set.
 */
export const generateConciergeIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    // Confirm this actually is the caller's partner (or accepted friend).
    const { data: me } = await (context.supabase as any)
      .from("profiles")
      .select("partner_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me || me.partner_id !== data.partnerId) {
      const { data: friend } = await (context.supabase as any).rpc("is_accepted_friend", {
        _other: data.partnerId,
      });
      if (!friend) throw new Error("Not connected to that panda.");
    }

    const gateway = createLovableAiGatewayProvider(key);
    const seed = Math.floor(Math.random() * 1_000_000);
    const system =
      "You are a warm, tasteful concierge who plans small luxurious moments for a committed couple. Every idea is specific, doable in one week, and quietly romantic — never generic. No emojis. No brand names. Always respond with valid JSON only, no prose, no fences.";
    const kinds = data.focus.length ? data.focus : (KINDS as readonly string[]);
    const prompt = `Return ONLY a JSON object like {"suggestions":[{"kind":"date","title":"...","body":"..."}]} with exactly 5 suggestions. Each "kind" is one of: ${kinds.join(", ")}. Rotate across kinds. Title under 7 words. Body 20-45 words, second-person plural ("the two of you"), evocative, one concrete detail. Budget: ${data.budget}. ${data.mood ? `Mood right now: ${data.mood}.` : ""} ${data.hints ? `Extra hints: ${data.hints}.` : ""} No emojis. Seed:${seed}`;

    let output: z.infer<typeof BatchSchema> | null = null;
    try {
      const res = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system,
        prompt,
        output: Output.object({ schema: BatchSchema as z.ZodType<any> }),
      });
      output = res.output as any;
    } catch (err: any) {
      if (NoObjectGeneratedError.isInstance?.(err) || err?.text) {
        const raw = String(err.text ?? "");
        try {
          const stripped = raw.replace(/```json\s*|```/g, "").trim();
          const m = stripped.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = BatchSchema.safeParse(JSON.parse(m[0]));
            if (parsed.success) output = parsed.data;
          }
        } catch {
          /* fall through */
        }
      }
      if (!output) {
        const msg = String(err?.message ?? "");
        if (msg.includes("429")) throw new Error("The concierge is busy — try again shortly.");
        if (msg.includes("402")) throw new Error("AI credits exhausted.");
      }
    }

    const fallback: z.infer<typeof BatchSchema> = {
      suggestions: [
        {
          kind: "date",
          title: "Candlelit kitchen dinner",
          body: "Cook one shared favorite by candlelight tonight. Phones face-down, a bottle of something, and a slow playlist you both grew up on.",
        },
        {
          kind: "note",
          title: "Three-line letter, hidden",
          body: "Write three lines about a moment this week. Slip it into a coat pocket, a book, a wallet — somewhere they'll find it tomorrow.",
        },
        {
          kind: "gift",
          title: "A tiny recurring thing",
          body: "Not a grand gift — a small daily one. Their favorite tea reserved on the top shelf. A tab left open with what you know they'd love.",
        },
        {
          kind: "trip",
          title: "One-night nowhere",
          body: "Book a nearby stay under an hour away — no itinerary. Bring one book to share aloud. Return late, sun-tired, holding hands.",
        },
        {
          kind: "ritual",
          title: "Sunday phone amnesty",
          body: "For three hours on Sunday, both phones live in a drawer. Just tea, one long walk, and the conversations you keep forgetting to finish.",
        },
      ],
    };

    const chosen = output ?? fallback;

    // Persist all suggestions. Ignore individual insert errors so partial
    // failure still shows something.
    const rows = chosen.suggestions.slice(0, 5).map((s) => ({
      author_id: context.userId,
      partner_id: data.partnerId,
      kind: (KINDS as readonly string[]).includes(s.kind) ? s.kind : "date",
      title: s.title.slice(0, 120),
      body: s.body.slice(0, 800),
      meta: {
        mood: data.mood ?? null,
        budget: data.budget,
        seed,
      },
    }));

    const { data: inserted, error } = await (context.supabase as any)
      .from("concierge_suggestions")
      .insert(rows)
      .select("*");
    if (error) throw new Error(error.message);
    return inserted ?? [];
  });
