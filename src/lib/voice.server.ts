import { geminiFetch } from "./gemini.server";
/**
 * Isolated audio service layer: speech-in (via the same multimodal intake call)
 * and speech-out (TTS). Swapping providers only touches this file — the triage
 * pipeline and the deterministic risk scoring are untouched.
 */

const CHAT_MODEL = "google/gemini-2.5-flash";
const TTS_MODEL = "openai/gpt-4o-mini-tts";

function mapError(status: number): Error {
  if (status === 429) return new Error("AI rate limit reached. Please retry in a moment.");
  if (status === 402) return new Error("AI credits exhausted. Add credits to continue.");
  return new Error(`AI request failed (${status})`);
}

export type VoiceIntakeResult = { transcript: string; detected_language: string };

/**
 * Single multimodal call: transcription + cleanup + language detection together.
 * No separate STT provider, no structured-JSON pipeline change — the transcript
 * simply fills the existing intake text field for the worker to review.
 */
export async function transcribeIntakeAudio(input: {
  audioBase64: string;
  format: string;
  field: "symptoms" | "history" | "question";
  languageHint: string;
}): Promise<VoiceIntakeResult> {
  const fieldLabel =
    input.field === "symptoms"
      ? "the patient's presenting symptoms"
      : input.field === "history"
        ? "the patient's basic medical history"
        : "a spoken health question asked to a clinical assistant";

  const res = await geminiFetch("/chat/completions", ({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You transcribe a rural health worker's spoken note about ${fieldLabel}.
Preferred language hint: ${input.languageHint}. Speakers often code-switch (e.g. Hindi mixed with English) — transcribe faithfully in the language and script actually spoken instead of forcing the hint.
Return ONLY JSON: {"transcript":string,"detected_language":string}
"transcript" is a clean, readable clinical note of what was said (fix obvious filler and false starts, keep every clinical detail, add nothing that was not said, never diagnose). "detected_language" is the language name, e.g. "Hindi", "Hinglish", "Bangla", "Tamil", "English".`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this recording." },
            { type: "input_audio", input_audio: { data: input.audioBase64, format: input.format } },
          ],
        },
      ],
  }));

  if (!res.ok) throw mapError(res.status);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = (json.choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  let parsed: Partial<VoiceIntakeResult> = {};
  try {
    parsed = JSON.parse(raw) as Partial<VoiceIntakeResult>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]) as Partial<VoiceIntakeResult>;
      } catch {
        parsed = {};
      }
    }
  }

  const transcript = (parsed.transcript ?? "").trim();
  if (!transcript) throw new Error("Nothing could be transcribed from that recording. Please record again.");
  return { transcript, detected_language: parsed.detected_language || input.languageHint };
}

/** Text-to-speech. Returns base64 mp3 so the caller can play it on an explicit tap. */
export async function synthesizeSpeech(text: string, language: string): Promise<string> {
  const res = await geminiFetch("/audio/speech", ({
      model: TTS_MODEL,
      voice: "alloy",
      response_format: "mp3",
      input: text,
      instructions: `Read aloud calmly and clearly in ${language}, at a slow pace suitable for a patient in a clinic.`,
  }));

  if (!res.ok) throw mapError(res.status);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
