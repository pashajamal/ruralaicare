import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TranscribeSchema = z.object({
  audio_base64: z.string().min(100),
  format: z.string().default("wav"),
  field: z.enum(["symptoms", "history"]),
  language_hint: z.string().default("Auto-detect"),
});

const SpeakSchema = z.object({
  text: z.string().min(1).max(4000),
  language: z.string().default("English"),
});

export const transcribeVoiceNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TranscribeSchema.parse(input))
  .handler(async ({ data }) => {
    const { transcribeIntakeAudio } = await import("./voice.server");
    return transcribeIntakeAudio({
      audioBase64: data.audio_base64,
      format: data.format,
      field: data.field,
      languageHint: data.language_hint,
    });
  });

export const speakText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SpeakSchema.parse(input))
  .handler(async ({ data }) => {
    const { synthesizeSpeech } = await import("./voice.server");
    const audio_base64 = await synthesizeSpeech(data.text, data.language);
    return { audio_base64 };
  });
