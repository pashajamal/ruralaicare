import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const IntakeSchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().min(0).max(120),
  mobile_number: z.string().min(6).max(20),
  preferred_language: z.string().min(1),
  symptoms: z.string().min(1),
  duration: z.string().default(""),
  history: z.string().default(""),
  vitals: z.object({
    temp: z.number().nullable().optional(),
    bp: z.string().nullable().optional(),
    pulse: z.number().nullable().optional(),
    spo2: z.number().nullable().optional(),
  }),
  image_path: z.string().nullable().optional(),
});

const ChronicSchema = z.array(
  z.object({
    condition_name: z.string().min(1),
    on_medication: z.boolean().default(false),
    medication_name: z.string().default(""),
    diagnosed_note: z.string().optional(),
  }),
).default([]);

const PregnancySchema = z
  .object({
    status: z.enum(["Not Pregnant", "Pregnant", "Not Sure"]),
    trimester: z.string().nullable().optional(),
    symptoms: z.array(z.string()).default([]),
    other: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const FullIntakeSchema = IntakeSchema.extend({
  sex: z.string().nullable().optional(),
  chronic_conditions: ChronicSchema,
  pregnancy_status: PregnancySchema,
});

export const submitIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FullIntakeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { runIntakePipeline } = await import("./triage-pipeline.server");
    return runIntakePipeline(data, context.userId);
  });
