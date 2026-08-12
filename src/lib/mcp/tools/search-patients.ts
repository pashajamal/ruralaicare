import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_patients",
  title: "Search patients",
  description: "Search patients you have access to by name or mobile number.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Name fragment or mobile number to search for."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of patients to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, age, sex, mobile_number, preferred_language, health_centre, created_at")
      .or(`name.ilike.%${query}%,mobile_number.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});
