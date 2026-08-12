import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UploadSchema = z.object({
  filename: z.string().min(1).max(200),
  base64: z.string().min(10),
});

const BatchSchema = z.object({ limit: z.number().int().min(1).max(10).default(10) });

async function assertStaff(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("doctor") && !roles.includes("admin")) {
    throw new Error("Only doctors or admins can manage the prescription dataset");
  }
}

export const uploadPrescriptionImageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { uploadPrescriptionImage } = await import("./prescriptions.server");
    return uploadPrescriptionImage(data.filename, data.base64);
  });

export const processPrescriptionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { processPrescriptionBatch } = await import("./prescriptions.server");
    return processPrescriptionBatch(data.limit);
  });