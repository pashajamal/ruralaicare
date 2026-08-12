import { supabase } from "@/integrations/supabase/client";

export type Tier = "RED" | "YELLOW" | "GREEN";

export const TIER_ORDER: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };

export const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  doctor_reviewing: "Doctor Reviewing",
  finalized: "Finalized",
};

export const CONSULT_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  waiting: "Waiting",
  in_consultation: "In Consultation",
  completed: "Completed",
  referral_required: "Referral Required",
};

export const REFERRAL_STATUS = ["recommended", "accepted", "in_transit", "completed"] as const;
export const REFERRAL_STATUS_LABEL: Record<string, string> = {
  recommended: "Recommended",
  accepted: "Accepted",
  in_transit: "In Transit",
  completed: "Completed",
};

export function waitingSince(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ${mins % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type AuditActor = {
  id?: string | undefined;
  name?: string | undefined;
  role?: string | undefined;
  healthCentre?: string | undefined;
};

export async function logAudit(
  actor: AuditActor,
  entry: { visitId?: string | null; patientId?: string | null; action: string; detail?: string },
) {
  await supabase.from("audit_logs").insert({
    visit_id: entry.visitId ?? null,
    patient_id: entry.patientId ?? null,
    health_centre: actor.healthCentre ?? null,
    actor_id: actor.id ?? null,
    actor_name: actor.name ?? "Unknown",
    actor_role: actor.role ?? "unknown",
    action: entry.action,
    detail: entry.detail ?? null,
  });
}

export async function notify(entry: {
  audience: "all" | "doctor" | "health_worker";
  title: string;
  body?: string;
  kind?: "info" | "emergency" | "consultation" | "followup";
  visitId?: string | null;
  healthCentre?: string | null;
}) {
  await supabase.from("notifications").insert({
    audience: entry.audience,
    title: entry.title,
    body: entry.body ?? null,
    kind: entry.kind ?? "info",
    visit_id: entry.visitId ?? null,
    health_centre: entry.healthCentre ?? null,
  });
}

export type SafetyCheck = { label: string; done: boolean };

export function safetyGate(visit: {
  risk_tier: string | null;
  triggering_rules: unknown;
  status: string;
  doctor_decision: string | null;
  emergency_acknowledged: boolean;
  doctor_opened?: boolean;
}, opts: { doctorOpened: boolean; decisionSelected: boolean; acknowledged: boolean }): SafetyCheck[] {
  const rules = Array.isArray(visit.triggering_rules) ? visit.triggering_rules : [];
  const checks: SafetyCheck[] = [
    { label: "Risk tier calculated by deterministic rules", done: Boolean(visit.risk_tier) },
    { label: "Triggering rules recorded and visible", done: rules.length > 0 },
    { label: "Case opened by a doctor", done: opts.doctorOpened },
    { label: "Doctor decision selected", done: opts.decisionSelected },
  ];
  if (visit.risk_tier === "RED") {
    checks.push({
      label: "Emergency indicators & referral acknowledged",
      done: opts.acknowledged || visit.emergency_acknowledged,
    });
  }
  return checks;
}
