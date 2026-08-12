import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_visits",
  title: "List patient visits",
  description: "List recent patient visits (the triage queue), optionally filtered by risk tier, status, or patient.",
  inputSchema: {
    risk_tier: z.enum(["RED", "YELLOW", "GREEN"]).optional().describe("Filter by deterministic risk tier."),
    status: z.enum(["pending_review", "finalized"]).optional().describe("Filter by review status."),
    patient_id: z.string().uuid().optional().describe("Restrict to a single patient."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of visits to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ risk_tier, status, patient_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("visits")
      .select("id, patient_id, symptoms_text, duration, risk_tier, status, doctor_decision, referral_required, created_at, patients(name, age, mobile_number)")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (risk_tier) q = q.eq("risk_tier", risk_tier);
    if (status) q = q.eq("status", status);
    if (patient_id) q = q.eq("patient_id", patient_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { visits: data ?? [] },
    };
  },
});
