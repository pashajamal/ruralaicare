/**
 * Anthropic (Claude) access layer — used ONLY for the symptom-reasoning node and
 * the critical-condition escalation check. Every other AI call stays on Gemini.
 * The key is read from the ANTHROPIC_API_KEY secret at call time and never
 * leaves the server.
 */

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

export const CLAUDE_MODEL = "claude-opus-4-8";
export const CLAUDE_KEY_ERROR = "Anthropic API key not configured or invalid";

export function hasAnthropicKey(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

/** Single text completion against the Anthropic Messages API. */
export async function claudeChat(input: {
  system: string;
  content: string;
  maxTokens?: number;
}): Promise<string> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error(CLAUDE_KEY_ERROR);

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
