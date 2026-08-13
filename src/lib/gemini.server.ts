/**
 * Single Gemini access layer for ALL backend AI calls (chat, vision, embeddings).
 * The key is read from the GEMINI_API_KEY secret at call time and never leaves
 * the server. Falls back to the Lovable AI Gateway when GEMINI_API_KEY is absent.
 */

const GOOGLE_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const GATEWAY_BASE = "https://ai.gateway.lovable.dev/v1";

export const KEY_ERROR = "Gemini API key not configured or invalid";

/** Google rejects gateway-style "google/" prefixes and some retired aliases. */
function mapModel(model: string): string {
  const m = model.replace(/^google\//, "");
  if (m === "gemini-2.5-flash" || m === "gemini-2.0-flash" || m === "gemini-flash-latest") return "gemini-3.5-flash";
  if (m === "gemini-2.5-pro") return "gemini-3.5-flash";
  return m;
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env["GEMINI_API_KEY"]);
}

type Path = "/chat/completions" | "/embeddings" | "/audio/speech";

/**
 * OpenAI-compatible request against Gemini. Returns the raw Response so callers
 * keep their existing status handling.
 */
export async function geminiFetch(
  path: Path,
  body: Record<string, unknown>,
): Promise<Response> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];

  // TTS is not available on the Google OpenAI-compatible surface.
  const useGoogle = Boolean(geminiKey) && path !== "/audio/speech";

  if (!useGoogle && !lovableKey) throw new Error(KEY_ERROR);

  const base = useGoogle ? GOOGLE_BASE : GATEWAY_BASE;
  const key = (useGoogle ? geminiKey : lovableKey) as string;
  const payload =
    typeof body["model"] === "string" && useGoogle
      ? { ...body, model: mapModel(body["model"]) }
      : body;

  const send = async (b: string, k: string, p: Record<string, unknown>) => {
    const maxRetries = 3;
    let lastRes: Response | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const res = await fetch(`${b}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
        body: JSON.stringify(p),
      });
      if (res.status === 401 || res.status === 403) throw new Error(KEY_ERROR);
      if (res.status !== 429 || attempt === maxRetries) return res;
      lastRes = res;
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
    return lastRes!;
  };

  const res = await send(base, key, payload);

  // Google's per-key quota is easily exhausted; fall back to the Lovable AI
  // Gateway (same OpenAI-compatible surface) instead of failing the request.
  if (res.status === 429 && useGoogle && lovableKey) {
    try {
      const fallback = await send(GATEWAY_BASE, lovableKey, body);
      if (fallback.ok) return fallback;
      return fallback.status === 429 ? res : fallback;
    } catch {
      return res;
    }
  }

  return res;
}

export async function geminiChat(input: {
  model?: string;
  system?: string;
  content: unknown;
  jsonMode?: boolean;
  temperature?: number;
}): Promise<string> {
  const res = await geminiFetch("/chat/completions", {
    model: input.model ?? "gemini-2.5-flash",
    messages: [
      ...(input.system ? [{ role: "system", content: input.system }] : []),
      { role: "user", content: input.content },
    ],
    ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function geminiEmbed(content: string, dimensions = 768): Promise<number[]> {
  const res = await geminiFetch("/embeddings", {
    model: "gemini-embedding-001",
    input: content,
    dimensions,
    encoding_format: "float",
  });
  if (!res.ok) throw new Error(`Embedding failed (${res.status})`);
  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vec = json.data?.[0]?.embedding;
  if (!vec?.length) throw new Error("Embedding response was empty");
  return vec;
}
