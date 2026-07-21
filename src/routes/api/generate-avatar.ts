import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-avatar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt } = (await request.json()) as { prompt?: string };
          const cleaned = (prompt ?? "").trim().slice(0, 300);
          if (!cleaned) return new Response("Missing prompt", { status: 400 });

          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const stylized = `Portrait avatar for a couple's romance app. ${cleaned}. Centered subject, soft cinematic lighting, luxury editorial aesthetic, painterly and warm, high detail, square framing, neutral vignette background. No text, no watermark.`;

          const upstream = await fetch(
            "https://ai.gateway.lovable.dev/v1/images/generations",
            {
              method: "POST",
              headers: {
                "Lovable-API-Key": key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [{ role: "user", content: stylized }],
                modalities: ["image", "text"],
              }),
            },
          );

          if (!upstream.ok) {
            const text = await upstream.text().catch(() => "");
            return new Response(text || "Image generation failed", {
              status: upstream.status,
            });
          }
          const json = (await upstream.json()) as {
            data?: Array<{ b64_json?: string }>;
          };
          const b64 = json?.data?.[0]?.b64_json;
          if (!b64) return new Response("No image returned", { status: 502 });
          return Response.json({ b64_json: b64 });
        } catch (err: any) {
          return new Response(err?.message ?? "Server error", { status: 500 });
        }
      },
    },
  },
});
