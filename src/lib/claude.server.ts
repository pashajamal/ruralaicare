/**
 * Anthropic (Claude) access layer — supports standard Anthropic API keys (sk-ant-...)
 * as well as proxy keys (sk-lit-..., sk-or-...).
 * The key is read from the ANTHROPIC_API_KEY secret at call time and never leaves the server.
 */

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
export const CLAUDE_KEY_ERROR = "Anthropic API key not configured or invalid";

export function hasAnthropicKey(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

/** Single text completion against Anthropic API (or OpenRouter/LiteLLM proxy). */
export async function claudeChat(input: {
  system: string;
  content: string;
  maxTokens?: number;
}): Promise<string> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error(CLAUDE_KEY_ERROR);

  const isProxyKey = key.startsWith("sk-lit-") || key.startsWith("sk-or-");

  if (isProxyKey) {
    // Proxy keys (LiteLLM / OpenRouter) use OpenAI-compatible completions format
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        max_tokens: input.maxTokens ?? 700,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.content },
        ],
      }),
    });

    if (res.status === 401 || res.status === 403) throw new Error(CLAUDE_KEY_ERROR);
    if (res.status === 429) throw new Error("Claude rate limit reached. Please retry in a moment.");
    if (!res.ok) throw new Error(`Claude proxy request failed (${res.status})`);

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  // Standard Anthropic Messages API
  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: input.maxTokens ?? 700,
      system: input.system,
      messages: [{ role: "user", content: input.content }],
    }),
  });

  if (res.status === 401 || res.status === 403) throw new Error(CLAUDE_KEY_ERROR);
  if (res.status === 429) throw new Error("Claude rate limit reached. Please retry in a moment.");
  if (!res.ok) throw new Error(`Claude request failed (${res.status})`);

  const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  return (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}
