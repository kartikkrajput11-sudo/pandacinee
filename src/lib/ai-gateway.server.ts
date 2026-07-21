import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

/**
 * Preferred AI provider for game/card generation.
 * Uses OpenAI directly when OPENAI_API_KEY is set, otherwise falls back to
 * the Lovable AI gateway (which needs credits).
 *
 * Returns { provider, model } — pass `provider(model)` to the AI SDK.
 */
export function createGameAiProvider(): { provider: ReturnType<typeof createOpenAICompatible>; model: string } {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const provider = createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${openaiKey}` },
    });
    return { provider, model: "gpt-4o-mini" };
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("AI is not configured (no OPENAI_API_KEY or LOVABLE_API_KEY)");
  return { provider: createLovableAiGatewayProvider(lovableKey), model: "google/gemini-2.5-flash" };
}
