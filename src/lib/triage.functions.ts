import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const IntakeSchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().min(0).max(120),
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

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => IntakeSchema.parse(input))
  .handler(async ({ data }) => {
    const { runIntakePipeline } = await import("./triage-pipeline.server");
    return runIntakePipeline(data);
  });