import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const searchSymptomKnowledgeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ query: z.string().min(3).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { searchSymptomKnowledge } = await import("./symptom-search.server");
    return { matches: await searchSymptomKnowledge(data.query) };
  });
