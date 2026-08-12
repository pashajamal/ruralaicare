import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VitalsSchema = z.object({
  temperature_c: z.number().nullable(),
  systolic: z.number().int().nullable(),
  diastolic: z.number().int().nullable(),
  pulse: z.number().int().nullable(),
  spo2: z.number().int().nullable(),
  respiratory_rate: z.number().int().nullable(),
});

const RunSchema = z.object({
  vitals: VitalsSchema,
  symptoms: z.string().min(3).max(2000),
  prescription_id: z.string().uuid().nullable(),
});

export const loadEvalDatasetsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { loadEvalDatasets } = await import("./clinical-eval.server");
    return loadEvalDatasets();
  });

export const searchSymptomsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ query: z.string().min(2).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { searchSymptomDataset } = await import("./clinical-eval.server");
    return searchSymptomDataset(data.query);
  });

export const signPrescriptionFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ filename: z.string().min(1).max(300) }).parse(input))
  .handler(async ({ data }) => {
    const { signPrescription } = await import("./clinical-eval.server");
    return { url: await signPrescription(data.filename) };
  });

export const runClinicalEvalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunSchema.parse(input))
  .handler(async ({ data }) => {
    const { runClinicalEvaluation } = await import("./clinical-eval.server");
    return runClinicalEvaluation({
      vitals: data.vitals,
      symptoms: data.symptoms,
      prescriptionId: data.prescription_id,
    });
  });
