import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchPatientsTool from "./tools/search-patients";
import listVisitsTool from "./tools/list-visits";
import getVisitTool from "./tools/get-visit";
import addDoctorNoteTool from "./tools/add-doctor-note";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "ai-virtual-clinic",
  title: "AI Virtual Clinic",
  version: "0.1.0",
  instructions:
    "Tools for AI Virtual Clinic, a rural clinical triage app. Use `search_patients` to find a patient, `list_visits` for the triage queue (filter by risk tier RED/YELLOW/GREEN), `get_visit` for the full record including vitals, triggering rules and the AI suggestion, and `add_doctor_note` to record a reviewing note. Risk tiers are computed deterministically by the app — never restate an AI suggestion as a diagnosis, and case finalization happens in the app, not over MCP.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchPatientsTool, listVisitsTool, getVisitTool, addDoctorNoteTool] as never,
});
