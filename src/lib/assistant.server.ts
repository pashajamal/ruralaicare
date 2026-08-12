import { geminiFetch } from "./gemini.server";
import { claudeChat, hasAnthropicKey } from "./claude.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODEL = "google/gemini-2.5-flash";

export const ASSISTANT_DISCLAIMER =
  "This is general guidance, not a medical decision — confirm with the reviewing doctor.";

export async function answerScopedQuestion(args: {
  patientId: string | null;
  question: string;
  audience: "health_worker" | "doctor";
  language?: string;
}): Promise<string> {
  const language = args.language && args.language !== "Auto-detect" ? args.language : null;
  const languageRule = language
    ? `Reply ONLY in ${language}, using the script normally used for that language (for Hinglish, use Roman script). Keep the wording simple.`
    : `Reply in the same language the question was asked in.`;

  if (!args.patientId) {
    const system =
      `You are a general health-information assistant for rural health workers and clinic staff. ` +
      `Answer general medical, first-aid, medicine, hygiene, maternal and child health, and public-health questions in clear, practical language. ` +
      `You are NOT diagnosing or treating any specific patient: never give a definitive diagnosis, never prescribe doses for an individual, and never assign a risk tier. ` +
      `If a question needs a real examination, say the patient must be assessed and escalated to a doctor. Max 160 words, plain prose. ${languageRule}`;
    return `${await callAI(system, args.question)}\n\n${ASSISTANT_DISCLAIMER}`;
  }

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
      ? `You are a clinical case assistant for a reviewing doctor. Answer ONLY from the supplied case data (visits, vitals, deterministic risk tiers, tracker history, care plans). Summarize trends and changes over time. Never state a definitive diagnosis, never assign or change a risk tier, never prescribe. If the data does not contain the answer, say so plainly. Max 160 words, plain prose. ${languageRule}`
      : `You are a case-support assistant for a rural health worker. Answer ONLY from the supplied case data. Explain what vitals and findings mean in simple language, and what to prepare before the doctor call. Never diagnose, never recommend or change medication, never assign a risk tier. If the data does not contain the answer, say so plainly. Max 140 words, plain prose. ${languageRule}`;

  const answer = await callAI(system, `CASE DATA:\n${caseData}\n\nQUESTION: ${args.question}`);

  // Disclaimer is enforced server-side in the response formatting, not just in the prompt.
  return `${answer}\n\n${ASSISTANT_DISCLAIMER}`;
}

/** Tries Claude first if ANTHROPIC_API_KEY is configured, with Gemini fallback. */
async function callAI(system: string, user: string): Promise<string> {
  if (hasAnthropicKey()) {
    try {
      const text = await claudeChat({ system, content: user, maxTokens: 800 });
      if (text) return text;
    } catch (error) {
      console.error("[assistant] Claude call failed, falling back to Gemini:", error);
    }
  }

  const res = await geminiFetch("/chat/completions", {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  if (res.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (json.choices?.[0]?.message?.content ?? "").trim() || "No answer could be generated.";
}
