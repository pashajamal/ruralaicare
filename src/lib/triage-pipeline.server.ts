import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { specialtyFor } from "./specialty";
import {
  analyzeImage,
  fetchDrugSafety,
  lookupAyurvedic,
  lookupProtocol,
  reasonAssessment,
  scoreRisk,
  structureIntake,
  type DrugSafety,
  type StructuredSummary,
  type Vitals,
} from "./triage.server";

export type IntakeInput = {
  name: string;
  age: number;
  mobile_number: string;
  preferred_language: string;
  symptoms: string;
  duration: string;
  history: string;
  vitals: Vitals;
  image_path?: string | null | undefined;
};

async function audit(entry: {
  visitId: string;
  patientId?: string;
  centre: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  detail?: string;
}) {
  await supabaseAdmin.from("audit_logs").insert({
    visit_id: entry.visitId,
    patient_id: entry.patientId ?? null,
    health_centre: entry.centre,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    actor_role: entry.actorRole,
    action: entry.action,
    detail: entry.detail ?? null,
  });
}

export async function runIntakePipeline(input: IntakeInput, userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, health_centre")
    .eq("id", userId)
    .maybeSingle();
  const centre = profile?.health_centre ?? "Rampur Health Centre";
  const workerName = profile?.full_name || "Health worker";

  // 1. Persist patient + visit immediately (status: pending_review).
  // Mobile number is the lookup key: an existing patient is reused across visits.
  const mobile = input.mobile_number.trim();
  const { data: existing } = await supabaseAdmin
    .from("patients")
    .select("id")
    .eq("mobile_number", mobile)
    .eq("health_centre", centre)
    .maybeSingle();

  let patient = existing;
  if (patient) {
    await supabaseAdmin
      .from("patients")
      .update({ name: input.name, age: input.age, preferred_language: input.preferred_language })
      .eq("id", patient.id);
  } else {
    const { data: created, error: patientError } = await supabaseAdmin
      .from("patients")
      .insert({
        name: input.name,
        age: input.age,
        mobile_number: mobile,
        contact: mobile,
        preferred_language: input.preferred_language,
        health_centre: centre,
        created_by: userId,
      })
      .select("id")
      .single();
    if (patientError || !created) throw new Error("Could not save patient record");
    patient = created;
  }

  const { data: visit, error: visitError } = await supabaseAdmin
    .from("visits")
    .insert({
      patient_id: patient.id,
      symptoms_text: input.symptoms,
      duration: input.duration,
      history_text: input.history,
      vitals: input.vitals as unknown as Json,
      image_url: input.image_path ?? null,
      status: "pending_review",
      health_centre: centre,
      created_by: userId,
    })
    .select("id")
    .single();
  if (visitError || !visit) throw new Error("Could not save visit record");

  const base = { visitId: visit.id, patientId: patient.id, centre, actorId: userId, actorName: workerName, actorRole: "health_worker" };
  await audit({ ...base, action: "Patient created", detail: `${input.name}, ${input.age} yrs` });
  await audit({ ...base, action: "Visit created", detail: "Intake submitted for AI-assisted triage" });

  // Deterministic fallback structure — used if the AI is unavailable.
  const fallback: StructuredSummary = {
    symptoms: [input.symptoms],
    duration: input.duration,
    age: input.age,
    vitals: input.vitals,
    history: input.history,
    detected_language: input.preferred_language,
  };

  let structured = fallback;
  let assessment: string | null = null;
  let imageAnalysis: string | null = null;
  let aiStatus: "ok" | "unavailable" = "ok";

  // 0. Multimodal image understanding (observational only)
  if (input.image_path) {
    try {
      imageAnalysis = await analyzeImage(input.image_path);
      if (imageAnalysis) {
        await supabaseAdmin.from("visits").update({ image_analysis: imageAnalysis }).eq("id", visit.id);
        await audit({ ...base, action: "AI image observation generated", detail: "Observational description / OCR only" });
      }
    } catch (error) {
      console.error("image analysis failed", error);
      aiStatus = "unavailable";
    }
  }

  // 1. Structuring + multilingual confirmation
  try {
    structured = await structureIntake({
      name: input.name,
      age: input.age,
      language: input.preferred_language,
      symptoms: input.symptoms,
      duration: input.duration,
      history: input.history,
      vitals: input.vitals,
      imageAnalysis,
    });
  } catch (error) {
    console.error("structuring failed", error);
    aiStatus = "unavailable";
  }

  // 2. Cautious preliminary assessment (never decides the tier)
  try {
    assessment = await reasonAssessment(structured, imageAnalysis);
  } catch (error) {
    console.error("reasoning failed", error);
    aiStatus = "unavailable";
  }

  // 3. Deterministic risk scoring — pure code, always runs, even if the AI failed
  const risk = scoreRisk(structured, input.symptoms);

  // 4 + 5. GREEN only: fixed protocol lookup + OpenFDA drug safety. RED hard-stops.
  let protocolText: string | null = null;
  let drugSafety: DrugSafety | null = null;
  let ayurvedic: { condition_name: string; remedy_text: string; source_reference: string | null } | null = null;
  if (risk.tier === "GREEN") {
    try {
      const protocol = await lookupProtocol(structured, input.symptoms);
      if (protocol) {
        protocolText = `${protocol.condition_name}\n\n${protocol.protocol_text}`;
        if (protocol.otc_medicine) drugSafety = await fetchDrugSafety(protocol.otc_medicine);
      }
    } catch (error) {
      console.error("protocol/drug lookup failed", error);
    }
    try {
      ayurvedic = await lookupAyurvedic(structured, input.symptoms);
    } catch (error) {
      console.error("ayurvedic lookup failed", error);
    }
  }

  await supabaseAdmin
    .from("visits")
    .update({
      structured_summary: structured as unknown as Json,
      preliminary_assessment:
        assessment ??
        "AI assessment unavailable. Risk classification is based on predefined safety rules and requires professional review.",
      confirmation_message: structured.confirmation_message ?? null,
      risk_tier: risk.tier,
      triggering_rules: risk.rules,
      protocol_text: protocolText,
      drug_safety_info: drugSafety as unknown as Json,
      ayurvedic_condition: ayurvedic?.condition_name ?? null,
      ayurvedic_remedy: ayurvedic?.remedy_text ?? null,
      ayurvedic_source: ayurvedic?.source_reference ?? null,
      hospital_specialty_tag: specialtyFor(`${input.symptoms} ${structured.symptoms.join(" ")} ${assessment ?? ""}`),
      ai_status: aiStatus,
      referral_required: risk.tier === "RED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", visit.id);

  await audit({
    ...base,
    action: aiStatus === "ok" ? "AI assessment generated" : "AI assessment unavailable",
    detail:
      aiStatus === "ok"
        ? "Preliminary assessment drafted for doctor review"
        : "Deterministic safety rules used; case routed to doctor review",
  });
  await audit({
    ...base,
    action: `Risk tier generated: ${risk.tier}`,
    detail: risk.rules.join(" · "),
  });

  await supabaseAdmin.from("notifications").insert({
    audience: "doctor",
    health_centre: centre,
    visit_id: visit.id,
    kind: risk.tier === "RED" ? "emergency" : "info",
    title:
      risk.tier === "RED"
        ? "New RED patient requires immediate attention"
        : `New ${risk.tier} case awaiting review`,
    body: `${input.name}, ${input.age} yrs — ${centre}`,
  });

  return { visitId: visit.id, tier: risk.tier, aiStatus };
}
