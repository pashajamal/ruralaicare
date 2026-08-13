import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { checkEscalation, type TrackerRow } from "./escalation";

type EntryInput = {
  patient_id: string;
  care_plan_id?: string | null | undefined;
  entry_date: string;
  temperature?: number | null | undefined;
  pulse?: number | null | undefined;
  spo2?: number | null | undefined;
  severity_score: number;
  note: string;
};

type CarePlanInput = {
  visit_id: string;
  patient_id: string;
  medication_instructions: string;
  monitoring_instructions: string;
  watch_symptoms: string[];
  monitoring_days: number;
  follow_up_date?: string | null | undefined;
};

async function actorContext(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name, health_centre")
    .eq("id", userId)
    .maybeSingle();
  return {
    centre: data?.health_centre ?? "Rampur Health Centre",
    name: data?.full_name || "Clinic staff",
  };
}

/** True when the caller holds an elevated role that may work across health centres. */
async function isDoctorOrAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r) => r.role === "doctor" || r.role === "admin");
}

/**
 * Guards service-role writes: a caller may only touch records inside their own
 * health centre (doctors/admins excepted).
 */
async function assertCentreAccess(recordCentre: string | null, callerCentre: string, userId: string) {
  if (!recordCentre || recordCentre === callerCentre) return;
  if (await isDoctorOrAdmin(userId)) return;
  throw new Error("This record belongs to another health centre");
}

export async function saveTrackerEntry(input: EntryInput, userId: string) {
  const { centre, name } = await actorContext(userId);

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id, name, age, health_centre")
    .eq("id", input.patient_id)
    .maybeSingle();
  if (!patient) throw new Error("Patient not found");
  await assertCentreAccess(patient.health_centre ?? null, centre, userId);

  if (input.care_plan_id) {
    const { data: plan } = await supabaseAdmin
      .from("care_plans")
      .select("id, patient_id, health_centre")
      .eq("id", input.care_plan_id)
      .maybeSingle();
    if (!plan || plan.patient_id !== input.patient_id) throw new Error("Care plan not found for this patient");
    await assertCentreAccess(plan.health_centre ?? null, centre, userId);
  }

  const { data: history } = await supabaseAdmin
    .from("daily_tracker_entries")
    .select("entry_date, temperature, pulse, spo2, severity_score")
    .eq("patient_id", input.patient_id)
    .lt("entry_date", input.entry_date)
    .order("entry_date", { ascending: false })
    .limit(14);

  const current: TrackerRow = {
    entry_date: input.entry_date,
    temperature: input.temperature ?? null,
    pulse: input.pulse ?? null,
    spo2: input.spo2 ?? null,
    severity_score: input.severity_score,
  };

  const escalation = checkEscalation(
    current,
    ((history ?? []) as unknown[]).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        entry_date: String(row["entry_date"]),
        temperature: row["temperature"] === null ? null : Number(row["temperature"]),
        pulse: row["pulse"] === null ? null : Number(row["pulse"]),
        spo2: row["spo2"] === null ? null : Number(row["spo2"]),
        severity_score: Number(row["severity_score"] ?? 1),
      } satisfies TrackerRow;
    }),
  );

  const { data: entry, error } = await supabaseAdmin
    .from("daily_tracker_entries")
    .upsert(
      {
        patient_id: input.patient_id,
        care_plan_id: input.care_plan_id ?? null,
        health_centre: patient.health_centre ?? centre,
        entry_date: input.entry_date,
        temperature: input.temperature ?? null,
        pulse: input.pulse ?? null,
        spo2: input.spo2 ?? null,
        severity_score: input.severity_score,
        note: input.note || null,
        escalation_flag: Boolean(escalation),
        logged_by: userId,
      },
      { onConflict: "patient_id,entry_date" },
    )
    .select("id")
    .single();
  if (error || !entry) throw new Error("Could not save the daily log");

  // Mark today's daily-log reminder as done
  await supabaseAdmin
    .from("reminders")
    .update({ status: "done" })
    .eq("patient_id", input.patient_id)
    .eq("type", "daily_log")
    .eq("due_date", input.entry_date);

  await supabaseAdmin.from("audit_logs").insert({
    patient_id: input.patient_id,
    health_centre: patient.health_centre ?? centre,
    actor_id: userId,
    actor_name: name,
    actor_role: "health_worker",
    action: "Daily monitoring log recorded",
    detail: `${input.entry_date} · severity ${input.severity_score}/5${input.spo2 ? ` · SpO2 ${input.spo2}%` : ""}`,
  });

  if (!escalation) return { escalated: false as const, entryId: entry.id };

  // Deterministic escalation -> new pending case pinned in the doctor review queue
  const { data: visit } = await supabaseAdmin
    .from("visits")
    .insert({
      patient_id: input.patient_id,
      symptoms_text: `Escalation — Home Monitoring: ${input.note || "daily log reading outside safe range"}`,
      duration: "Home monitoring",
      history_text: "Raised automatically by the deterministic escalation engine from a daily tracker entry.",
      vitals: {
        temp: input.temperature ?? null,
        bp: null,
        pulse: input.pulse ?? null,
        spo2: input.spo2 ?? null,
      } as unknown as Json,
      risk_tier: escalation.tier,
      triggering_rules: escalation.reasons as unknown as Json,
      preliminary_assessment:
        "Escalation raised by deterministic home-monitoring rules. No AI assessment was generated for this entry — a doctor must review the readings directly.",
      status: "pending_review",
      health_centre: patient.health_centre ?? centre,
      created_by: userId,
      ai_status: "ok",
      referral_required: escalation.tier === "RED",
    })
    .select("id")
    .single();

  await supabaseAdmin.from("escalations").insert({
    patient_id: input.patient_id,
    care_plan_id: input.care_plan_id ?? null,
    daily_tracker_entry_id: entry.id,
    visit_id: visit?.id ?? null,
    health_centre: patient.health_centre ?? centre,
    reason: escalation.reasons.join(" · "),
    tier: escalation.tier,
    status: "open",
  });

  await supabaseAdmin.from("notifications").insert({
    audience: "doctor",
    health_centre: patient.health_centre ?? centre,
    visit_id: visit?.id ?? null,
    kind: escalation.tier === "RED" ? "emergency" : "info",
    title:
      escalation.tier === "RED"
        ? "Home-monitoring escalation — immediate review needed"
        : "Home-monitoring escalation flagged for review",
    body: `${patient.name}, ${patient.age} yrs — ${escalation.reasons[0] ?? ""}`,
  });

  await supabaseAdmin.from("audit_logs").insert({
    visit_id: visit?.id ?? null,
    patient_id: input.patient_id,
    health_centre: patient.health_centre ?? centre,
    actor_id: userId,
    actor_name: "Escalation engine",
    actor_role: "system",
    action: `Escalation raised: ${escalation.tier}`,
    detail: escalation.reasons.join(" · "),
  });

  return { escalated: true as const, entryId: entry.id, tier: escalation.tier, reasons: escalation.reasons };
}

export async function saveCarePlan(input: CarePlanInput, userId: string) {
  const { centre, name } = await actorContext(userId);

  const { data: visit } = await supabaseAdmin
    .from("visits")
    .select("id, patient_id, health_centre")
    .eq("id", input.visit_id)
    .maybeSingle();
  if (!visit || visit.patient_id !== input.patient_id) throw new Error("Visit not found for this patient");
  await assertCentreAccess(visit.health_centre ?? null, centre, userId);

  const { data: carePatient } = await supabaseAdmin
    .from("patients")
    .select("id, health_centre")
    .eq("id", input.patient_id)
    .maybeSingle();
  if (!carePatient) throw new Error("Patient not found");
  await assertCentreAccess(carePatient.health_centre ?? null, centre, userId);

  if (!(await isDoctorOrAdmin(userId))) throw new Error("Only a doctor can create a care plan");

  const { data: plan, error } = await supabaseAdmin
    .from("care_plans")
    .insert({
      visit_id: input.visit_id,
      patient_id: input.patient_id,
      doctor_id: userId,
      health_centre: centre,
      medication_instructions: input.medication_instructions || null,
      monitoring_instructions: input.monitoring_instructions || null,
      watch_symptoms: input.watch_symptoms as unknown as Json,
      monitoring_days: input.monitoring_days,
      follow_up_date: input.follow_up_date || null,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !plan) throw new Error("Could not create the care plan");

  const reminders: Array<{
    patient_id: string;
    care_plan_id: string;
    health_centre: string;
    type: string;
    due_date: string;
    status: string;
  }> = [];
  const today = new Date();
  for (let i = 0; i < input.monitoring_days; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    reminders.push({
      patient_id: input.patient_id,
      care_plan_id: plan.id,
      health_centre: centre,
      type: "daily_log",
      due_date: d.toISOString().slice(0, 10),
      status: "pending",
    });
  }
  if (input.follow_up_date) {
    reminders.push({
      patient_id: input.patient_id,
      care_plan_id: plan.id,
      health_centre: centre,
      type: "follow_up",
      due_date: input.follow_up_date,
      status: "pending",
    });
  }
  if (reminders.length > 0) await supabaseAdmin.from("reminders").insert(reminders);

  await supabaseAdmin.from("audit_logs").insert({
    visit_id: input.visit_id,
    patient_id: input.patient_id,
    health_centre: centre,
    actor_id: userId,
    actor_name: name,
    actor_role: "doctor",
    action: "Care plan created",
    detail: `${input.monitoring_days} days of home monitoring${input.follow_up_date ? ` · follow-up ${input.follow_up_date}` : ""}`,
  });

  await supabaseAdmin.from("notifications").insert({
    audience: "health_worker",
    health_centre: centre,
    visit_id: input.visit_id,
    kind: "followup",
    title: "Doctor created a home care plan",
    body: `Daily monitoring for ${input.monitoring_days} day(s). Log vitals in the Daily Tracker.`,
  });

  return { carePlanId: plan.id, reminders: reminders.length };
}
