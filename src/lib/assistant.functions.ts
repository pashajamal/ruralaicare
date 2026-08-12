import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskSchema = z.object({
  patient_id: z.string().uuid(),
  question: z.string().min(2).max(600),
  audience: z.enum(["health_worker", "doctor"]).default("health_worker"),
});

/** Case-scoped AI assistant. Never writes back to any clinical decision field. */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Access check runs as the caller (RLS), before the privileged read.
    const { data: allowed } = await context.supabase
      .from("patients")
      .select("id")
      .eq("id", data.patient_id)
      .maybeSingle();
    if (!allowed) throw new Error("You do not have access to this patient record");

    const { answerScopedQuestion } = await import("./assistant.server");
    return { answer: await answerScopedQuestion({ patientId: data.patient_id, question: data.question, audience: data.audience }) };
  });
