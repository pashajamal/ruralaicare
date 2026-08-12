import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export const ASSISTANT_DISCLAIMER =
  "This is general guidance, not a medical decision — confirm with the reviewing doctor.";

export async function answerScopedQuestion(args: {
  patientId: string;
  question: string;
  audience: "health_worker" | "doctor";
}): Promise<string> {
  const [{ data: patient }, { data: visits }, { data: entries }, { data: plans }] = await Promise.all([
    supabaseAdmin.from("patients").select("name, age, preferred_language").eq("id", args.patientId).maybeSingle(),
    supabaseAdmin
      .from("visits")
      .select(
        "created_at, symptoms_text, duration, history_text, vitals, risk_tier, triggering_rules, preliminary_assessment, protocol_text, status, doctor_decision, doctor_notes, image_analysis",
      )
      .eq("patient_id", args.patientId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("daily_tracker_entries")
      .select("entry_date, temperature, pulse, spo2, severity_score, note, escalation_flag")
      .eq("patient_id", args.patientId)
      .order("entry_date", { ascending: false })
      .limit(14),
    supabaseAdmin
      .from("care_plans")
      .select("medication_instructions, monitoring_instructions, watch_symptoms, follow_up_date, status")
      .eq("patient_id", args.patientId)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  if (!patient) throw new Error("Patient record not found");

  const caseData = JSON.stringify({ patient, visits: visits ?? [], daily_tracker: entries ?? [], care_plans: plans ?? [] });

  const system =
    args.audience === "doctor"
      ? `You are a clinical case assistant for a reviewing doctor. Answer ONLY from the supplied case data (visits, vitals, deterministic risk tiers, tracker history, care plans). Summarize trends and changes over time. Never state a definitive diagnosis, never assign or change a risk tier, never prescribe. If the data does not contain the answer, say so plainly. Max 160 words, plain prose.`
      : `You are a case-support assistant for a rural health worker. Answer ONLY from the supplied case data. Explain what vitals and findings mean in simple language, and what to prepare before the doctor call. Never diagnose, never recommend or change medication, never assign a risk tier. If the data does not contain the answer, say so plainly. Max 140 words, plain prose.`;

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI assistant is temporarily unavailable");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `CASE DATA:\n${caseData}\n\nQUESTION: ${args.question}` },
      ],
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = (json.choices?.[0]?.message?.content ?? "").trim() || "No answer could be generated from this case data.";

  // Disclaimer is enforced server-side in the response formatting, not just in the prompt.
  return `${answer}\n\n${ASSISTANT_DISCLAIMER}`;
}
