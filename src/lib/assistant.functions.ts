import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskSchema = z.object({
  patient_id: z.string().uuid().nullish(),
  question: z.string().min(2).max(600),
  audience: z.enum(["health_worker", "doctor"]).default("health_worker"),
  language: z.string().default("English"),
});

/** AI assistant: general health information, optionally scoped to one patient case. */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.patient_id) {
      // Access check runs as the caller (RLS), before the privileged read.
      const { data: allowed } = await context.supabase
        .from("patients")
        .select("id")
        .eq("id", data.patient_id)
        .maybeSingle();
      if (!allowed) throw new Error("You do not have access to this patient record");
    }

    const { answerScopedQuestion } = await import("./assistant.server");
    return {
      answer: await answerScopedQuestion({
        patientId: data.patient_id ?? null,
        question: data.question,
        audience: data.audience,
        language: data.language,
      }),
    };
  });
