import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  analyzeImage,
  fetchDrugSafety,
  lookupProtocol,
  reasonAssessment,
  scoreRisk,
  structureIntake,
  type DrugSafety,
  type Vitals,
} from "./triage.server";

export type IntakeInput = {
  name: string;
  age: number;
  preferred_language: string;
  symptoms: string;
  duration: string;
  history: string;
  vitals: Vitals;
  image_path?: string | null | undefined;
};

export async function runIntakePipeline(input: IntakeInput) {
  // 1. Persist patient + visit immediately (status: pending_review)
  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .insert({
      name: input.name,
      age: input.age,
      preferred_language: input.preferred_language,
    })
    .select("id")
    .single();
  if (patientError || !patient) throw new Error("Could not save patient record");

  const { data: visit, error: visitError } = await supabaseAdmin
    .from("visits")
    .insert({
      patient_id: patient.id,
      symptoms_text: input.symptoms,
      duration: input.duration,
      history_text: input.history,
      vitals: (input.vitals as unknown as Json),
      image_url: input.image_path ?? null,
      status: "pending_review",
    })
    .select("id")
    .single();
  if (visitError || !visit) throw new Error("Could not save visit record");

  try {
    // 0. Multimodal image understanding (observational only)
    const imageAnalysis = input.image_path ? await analyzeImage(input.image_path) : null;
    if (imageAnalysis) {
      await supabaseAdmin.from("visits").update({ image_analysis: imageAnalysis }).eq("id", visit.id);
    }

    // 1. Structuring + multilingual confirmation
    const structured = await structureIntake({
      name: input.name,
      age: input.age,
      language: input.preferred_language,
      symptoms: input.symptoms,
      duration: input.duration,
      history: input.history,
      vitals: input.vitals,
      imageAnalysis,
    });

    // 2. Cautious preliminary assessment (never decides the tier)
    const assessment = await reasonAssessment(structured, imageAnalysis);

    // 3. Deterministic risk scoring — pure code, no LLM
    const risk = scoreRisk(structured, input.symptoms);

    // 4 + 5. GREEN only: fixed protocol lookup + OpenFDA drug safety
    let protocolText: string | null = null;
    let drugSafety: DrugSafety | null = null;
    if (risk.tier === "GREEN") {
      const protocol = await lookupProtocol(structured, input.symptoms);
      if (protocol) {
        protocolText = `${protocol.condition_name}\n\n${protocol.protocol_text}`;
        if (protocol.otc_medicine) {
          drugSafety = await fetchDrugSafety(protocol.otc_medicine);
        }
      }
    }

    await supabaseAdmin
      .from("visits")
      .update({
        structured_summary: (structured as unknown as Json),
        preliminary_assessment: assessment,
        confirmation_message: structured.confirmation_message ?? null,
        risk_tier: risk.tier,
        triggering_rules: risk.rules,
        protocol_text: protocolText,
        drug_safety_info: (drugSafety as unknown as Json),
      })
      .eq("id", visit.id);

    return { visitId: visit.id, tier: risk.tier };
  } catch (error) {
    await supabaseAdmin
      .from("visits")
      .update({
        risk_tier: "YELLOW",
        triggering_rules: [
          "AI assessment could not be completed — flagged for doctor review as a precaution",
        ],
        preliminary_assessment:
          "The automated assessment did not complete. This record has been routed to a doctor for manual review.",
      })
      .eq("id", visit.id);
    console.error(error);
    return { visitId: visit.id, tier: "YELLOW" as const };
  }
}