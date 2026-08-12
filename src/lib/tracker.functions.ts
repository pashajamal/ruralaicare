import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EntrySchema = z.object({
  patient_id: z.string().uuid(),
  care_plan_id: z.string().uuid().nullable().optional(),
  entry_date: z.string().min(4),
  temperature: z.number().nullable().optional(),
  pulse: z.number().nullable().optional(),
  spo2: z.number().nullable().optional(),
  severity_score: z.number().int().min(1).max(5),
  note: z.string().default(""),
});

const CarePlanSchema = z.object({
  visit_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  medication_instructions: z.string().default(""),
  monitoring_instructions: z.string().default(""),
  watch_symptoms: z.array(z.string()).default([]),
  monitoring_days: z.number().int().min(0).max(30).default(7),
  follow_up_date: z.string().nullable().optional(),
});

/** Logs a daily tracker entry and runs the deterministic escalation engine. */
export const logTrackerEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EntrySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { saveTrackerEntry } = await import("./tracker-pipeline.server");
    return saveTrackerEntry(data, context.userId);
  });

/** Creates a doctor care plan and generates the matching reminder records. */
export const createCarePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CarePlanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { saveCarePlan } = await import("./tracker-pipeline.server");
    return saveCarePlan(data, context.userId);
  });
