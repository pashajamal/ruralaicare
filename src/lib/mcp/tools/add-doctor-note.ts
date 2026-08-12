import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_doctor_note",
  title: "Add doctor note to a visit",
  description:
    "Append a reviewing-doctor note to a visit. Does not finalize the case or change the AI risk tier; finalization stays in the app.",
  inputSchema: {
    visit_id: z.string().uuid().describe("The visit id."),
    note: z.string().trim().min(1).max(2000).describe("Note text to record on the visit."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ visit_id, note }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data: existing, error: readError } = await supabase
      .from("visits")
      .select("id, doctor_notes")
      .eq("id", visit_id)
      .maybeSingle();
    if (readError) return { content: [{ type: "text", text: readError.message }], isError: true };
    if (!existing) return { content: [{ type: "text", text: "Visit not found or not accessible." }], isError: true };

    const stamp = new Date().toISOString();
    const merged = [existing.doctor_notes?.trim(), `[${stamp}] ${note}`].filter(Boolean).join("\n");
    const { data, error } = await supabase
      .from("visits")
      .update({ doctor_notes: merged })
      .eq("id", visit_id)
      .select("id, doctor_notes")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Note added to visit ${visit_id}.` }],
      structuredContent: { visit: data },
    };
  },
});
