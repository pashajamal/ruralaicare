import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_visit",
  title: "Get visit detail",
  description:
    "Fetch the full triage record for one visit: vitals, structured summary, risk tier, triggering rules, AI suggestion and doctor decision.",
  inputSchema: { visit_id: z.string().uuid().describe("The visit id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ visit_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("visits")
      .select("*, patients(name, age, sex, mobile_number, preferred_language)")
      .eq("id", visit_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Visit not found or not accessible." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { visit: data },
    };
  },
});
