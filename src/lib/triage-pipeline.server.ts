import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { specialtyFor } from "./specialty";
import type { ChronicCondition, PregnancyStatus } from "./conditions";
import { suggestMedicines, type MedicineSuggestion } from "./medicine-suggestion.server";
import {
  applyConditionModifiers,
  analyzeImage,
  fetchDrugSafety,
  historyAlerts,
  lookupAyurvedic,
  lookupProtocol,
  lookupStabilization,
  isRedAdjacent,
  reasonAssessment,
  criticalConditionCheck,
  scoreRisk,
  structureIntake,
  suggestionGuardrail,
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
  sex?: string | null | undefined;
  chronic_conditions?: ChronicCondition[] | undefined;
  pregnancy_status?: PregnancyStatus | null | undefined;
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
  if (!profile?.health_centre) {
    throw new Error("User profile is missing health centre configuration. Please update profile settings.");
  }
  const centre = profile.health_centre;
  const workerName = profile.full_name || "Health worker";

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
      .update({
        name: input.name,
        age: input.age,
        preferred_language: input.preferred_language,
        ...(input.sex ? { sex: input.sex } : {}),
      })
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
        sex: input.sex ?? null,
      })
      .select("id")
      .single();
    if (patientError || !created) throw new Error("Could not save patient record");
    patient = created;
  }

  // Chronic conditions are persistent per patient: upsert what was entered, then read back the full record.
  const submitted = input.chronic_conditions ?? [];
  if (submitted.length > 0) {
    await supabaseAdmin.from("patient_conditions").upsert(
      submitted.map((c) => ({
        patient_id: patient.id,
        health_centre: centre,
        condition_name: c.condition_name,
        on_medication: c.on_medication,
        medication_name: c.medication_name || null,
        diagnosed_note: c.diagnosed_note ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "patient_id,condition_name" },
    );
  }
  const { data: storedConditions } = await supabaseAdmin
    .from("patient_conditions")
    .select("condition_name, on_medication, medication_name, diagnosed_note")
    .eq("patient_id", patient.id);
  const chronic: ChronicCondition[] = (storedConditions ?? []).map((c) => ({
    condition_name: c.condition_name,
    on_medication: Boolean(c.on_medication),
    medication_name: c.medication_name ?? "",
    diagnosed_note: c.diagnosed_note ?? "",
  }));
  const pregnancy = input.pregnancy_status ?? null;
  const conditionCtx = { chronic, pregnancy };

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
      chronic_conditions: { conditions: chronic, alerts: [], guardrails: [] } as unknown as Json,
      pregnancy_status: (pregnancy ?? null) as unknown as Json,
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
  let reasoningProvider: string | null = null;
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

  // 2. Cautious preliminary assessment (never decides the tier) — Claude-backed
  try {
    const reasoning = await reasonAssessment(structured, imageAnalysis);
    assessment = reasoning.text;
    reasoningProvider = reasoning.provider;
  } catch (error) {
    console.error("reasoning failed", error);
    aiStatus = "unavailable";
  }

  // 3. Deterministic risk scoring — pure code, always runs, even if the AI failed
  const baseRisk = scoreRisk(structured, input.symptoms);
  // 3b. Condition-aware modifiers (chronic conditions / pregnancy) — deterministic, can only escalate
  const risk = applyConditionModifiers(
    baseRisk,
    conditionCtx,
    `${input.symptoms} ${structured.symptoms.join(" ")} ${input.history}`,
  );

  // 3c. Critical-condition escalation check (Claude) — advisory, can only escalate.
  try {
    const critical = await criticalConditionCheck(structured, input.symptoms, imageAnalysis);
    if (critical.critical && risk.tier !== "RED") {
      risk.tier = "RED";
      risk.rules.push(
        `Critical-condition check escalated to RED — ${critical.reason ?? "possible life-threatening presentation"} (${critical.provider})`,
      );
    }
  } catch (error) {
    console.error("critical-condition check failed", error);
  }

  // 4 + 5. Tier-scoped protocol lookup + OpenFDA drug safety.
  //   RED    -> emergency stabilization steps only, never a medicine.
  //   YELLOW -> conservative supportive protocol + OTC only when it is safe and confirmed by OpenFDA.
  //   GREEN  -> full protocol + OTC drug-safety note (unchanged behaviour).
  let protocolText: string | null = null;
  let drugSafety: DrugSafety | null = null;
  let ayurvedic: { condition_name: string; remedy_text: string; source_reference: string | null } | null = null;
  const guardrailNotes: string[] = [];
  let medicineSuggestion: MedicineSuggestion | null = null;

  if (risk.tier === "RED") {
    try {
      const stabilization = await lookupStabilization(structured, input.symptoms);
      if (stabilization) {
        protocolText = `${stabilization.condition_name}\n\n${stabilization.protocol_text}`;
      }
    } catch (error) {
      console.error("stabilization lookup failed", error);
    }
  }

  if (risk.tier === "YELLOW" || risk.tier === "GREEN") {
    try {
      const protocol = await lookupProtocol(structured, input.symptoms);
      if (protocol) {
        protocolText = `${protocol.condition_name}\n\n${protocol.protocol_text}`;
        const suppressForCaution =
          risk.tier === "YELLOW" && isRedAdjacent(structured, input.symptoms, risk.rules);
        if (protocol.otc_medicine && !suppressForCaution) {
          drugSafety = await fetchDrugSafety(protocol.otc_medicine);
          // Rule: no OpenFDA label data -> show protocol text only, never a medicine name.
          const hasLabelData = Boolean(
            drugSafety?.contraindications ||
              drugSafety?.warnings ||
              drugSafety?.pediatric_use ||
              drugSafety?.geriatric_use,
          );
          if (!hasLabelData) drugSafety = null;
        }
        if (drugSafety) {
          // Guardrail: cross-check the label text against the patient's flagged conditions.
          const labelText = [
            protocol.otc_medicine,
            drugSafety?.contraindications,
            drugSafety?.warnings,
            drugSafety?.pediatric_use,
            drugSafety?.geriatric_use,
          ]
            .filter(Boolean)
            .join(" ");
          const caution = suggestionGuardrail(labelText, conditionCtx);
          if (caution) {
            drugSafety = null;
            guardrailNotes.push(caution);
          }
        }
        if (risk.tier === "YELLOW" && suppressForCaution) {
          guardrailNotes.push(
            "Medicine suggestion suppressed — findings sit close to the emergency threshold, so a doctor decides treatment.",
          );
        }
      }
    } catch (error) {
      console.error("protocol/drug lookup failed", error);
    }
  }

  if (risk.tier === "GREEN") {
    try {
      ayurvedic = await lookupAyurvedic(structured, input.symptoms);
      if (ayurvedic) {
        const caution = suggestionGuardrail(`${ayurvedic.condition_name} ${ayurvedic.remedy_text}`, conditionCtx);
        if (caution) {
          ayurvedic = { condition_name: ayurvedic.condition_name, remedy_text: caution, source_reference: null };
          guardrailNotes.push(caution);
        }
      }
    } catch (error) {
      console.error("ayurvedic lookup failed", error);
    }

    // 5c. Retrieval-only medicine suggestion from the drug_safety knowledge base (GREEN only).
    medicineSuggestion = await suggestMedicines({
      structured,
      symptomsText: input.symptoms,
      assessment,
      conditions: conditionCtx,
    });
    if (medicineSuggestion.override_reason) {
      risk.rules.push(`No medicine suggested — ${medicineSuggestion.override_reason}`);
    }
  }

  // 5b. Cautious, non-directive context notes for the doctor about relevant history.
  let alerts: Array<{ condition: string; note: string }> = [];
  try {
    alerts = await historyAlerts(conditionCtx, `${input.symptoms} ${input.history}`, risk.rules);
  } catch (error) {
    console.error("history alerts failed", error);
  }

  await supabaseAdmin
    .from("visits")
    .update({
      structured_summary: structured as unknown as Json,
      chronic_conditions: { conditions: chronic, alerts, guardrails: guardrailNotes } as unknown as Json,
      preliminary_assessment:
        assessment ??
        "AI assessment unavailable. Risk classification is based on predefined safety rules and requires professional review.",
      confirmation_message: structured.confirmation_message ?? null,
      risk_tier: risk.tier,
      triggering_rules: risk.rules,
      protocol_text: protocolText,
      drug_safety_info: drugSafety as unknown as Json,
      medicine_suggestion: (medicineSuggestion ?? null) as unknown as Json,
      ayurvedic_condition: ayurvedic?.condition_name ?? null,
      ayurvedic_remedy: ayurvedic?.remedy_text ?? null,
      ayurvedic_source: ayurvedic?.source_reference ?? null,
      hospital_specialty_tag: specialtyFor(`${input.symptoms} ${structured.symptoms.join(" ")} ${assessment ?? ""}`),
      reasoning_provider: reasoningProvider,
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
