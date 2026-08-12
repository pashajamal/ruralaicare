import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/gemini-test")({
  server: {
    handlers: {
      GET: async () => {
        const { geminiChat, geminiEmbed, hasGeminiKey } = await import("@/lib/gemini.server");
        try {
          const text = await geminiChat({ content: "Reply with exactly: GEMINI OK" });
          const vec = await geminiEmbed("fever and cough for three days");
          return Response.json({ ok: true, usingGeminiKey: hasGeminiKey(), text: text.trim(), embeddingDims: vec.length });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
