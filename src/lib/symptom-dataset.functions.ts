import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BatchSchema = z.object({ limit: z.number().int().min(1).max(50).default(50) });

async function assertStaff(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("doctor") && !roles.includes("admin")) {
    throw new Error("Only doctors or admins can manage the symptom dataset");
  }
}

export const embedSymptomDatasetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { embedSymptomDatasetBatch } = await import("./symptom-dataset.server");
    return embedSymptomDatasetBatch(data.limit);
  });
