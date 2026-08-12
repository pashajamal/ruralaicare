import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BatchSchema = z.object({ limit: z.number().int().min(1).max(50).default(50) });

export const embedMedicineDatasetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await (context.supabase as { from: (t: string) => any })
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("doctor") && !roles.includes("admin")) {
      throw new Error("Only doctors or admins can manage the medicine dataset");
    }
    const { embedMedicineDatasetBatch } = await import("./medicine-dataset.server");
    return embedMedicineDatasetBatch(data.limit);
  });
