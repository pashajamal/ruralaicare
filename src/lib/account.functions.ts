import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BootstrapSchema = z.object({
  full_name: z.string().default(""),
  role: z.enum(["health_worker", "doctor"]).default("health_worker"),
  health_centre: z.string().default("Rampur Health Centre"),
});

/**
 * Creates the profile + role row for a freshly signed-up user.
 * Roles are written server-side only (never from the browser) so a user
 * cannot grant themselves elevated access.
 */
export const bootstrapAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BootstrapSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("profiles").insert({
        id: userId,
        full_name: data.full_name,
        health_centre: data.health_centre,
      });
    }

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    if (!roles || roles.length === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
      return { role: data.role };
    }
    return { role: roles[0]!.role };
  });
