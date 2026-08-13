import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ visit_id: z.string().uuid() });

/**
 * Returns a short-lived signed URL for a visit's uploaded photo.
 * The visit row is read through the caller's own client first, so the existing
 * clinic/case RLS scope on `visits` decides who may see the image at all.
 */
export const getVisitImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { data: visit, error } = await context.supabase
      .from("visits")
      .select("id, image_url, image_analysis")
      .eq("id", data.visit_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!visit) return { url: null, analysis: null, missing: true as const };
    if (!visit.image_url) return { url: null, analysis: visit.image_analysis ?? null, missing: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("clinic-uploads")
      .createSignedUrl(visit.image_url, 600);

    return {
      url: signed?.signedUrl ?? null,
      analysis: visit.image_analysis ?? null,
      missing: false as const,
    };
  });
