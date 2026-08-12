import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Loader2,
  Printer,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AuditTimeline } from "@/components/AuditTimeline";
import { DocumentViewer } from "@/components/DocumentViewer";
import { VitalsCards } from "@/components/VitalsCards";
import { RiskPill, TIER_BLURB, TIER_LABEL, tierClasses, type Tier } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { STATUS_LABEL, formatDateTime, logAudit, notify, safetyGate } from "@/lib/clinic";

export const Route = createFileRoute("/review/$visitId")({
  head: () => ({
    meta: [
      { title: "Clinical Review | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "AI suggestion versus doctor decision: deterministic risk rules, explainability, safety gate and final sign-off.",
      },
      { property: "og:title", content: "Clinical Review | AI Virtual Clinic" },
      { property: "og:description", content: "AI assistance is advisory; the doctor makes the final decision." },
    ],
  }),
  component: ReviewPage,
});

type Decision = "approve" | "modify" | "override";

function ReviewPage() {
  const { visitId } = Route.useParams();
  const qc = useQueryClient();
  const { profile, role, isDoctor } = useAuth();

  const [decision, setDecision] = useState<Decision | "">("");
  const [notes, setNotes] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [facility, setFacility] = useState("");
  const [needFollowUp, setNeedFollowUp] = useState(false);
  const [followDate, setFollowDate] = useState("");
  const [followReason, setFollowReason] = useState("");
  const [followInstructions, setFollowInstructions] = useState("");
  const [followPriority, setFollowPriority] = useState("routine");
  const [saving, setSaving] = useState(false);
  const [confirmReferral, setConfirmReferral] = useState(false);
  const openedRef = useRef(false);

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ["visit", visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, patients(id, name, age, preferred_language, contact, location, health_centre)")
        .eq("id", visitId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: referral } = useQuery({
    queryKey: ["visit-referral", visitId],
    queryFn: async () => {
      const { data } = await supabase.from("referrals").select("*").eq("visit_id", visitId).maybeSingle();
      return data;
    },
  });

  const { data: consultation } = useQuery({
    queryKey: ["visit-consultation", visitId],
    queryFn: async () => {
      const { data } = await supabase.from("consultations").select("*").eq("visit_id", visitId).maybeSingle();
      return data;
    },
  });

  const patient = (visit?.patients ?? null) as
    | { id: string; name: string; age: number; preferred_language: string; contact: string | null; location: string | null; health_centre: string | null }
    | null;
  const tier = (visit?.risk_tier ?? "YELLOW") as Tier;
  const rules = Array.isArray(visit?.triggering_rules) ? (visit.triggering_rules as string[]) : [];
  const finalized = visit?.status === "finalized";
  const doctorOpened = isDoctor || visit?.status === "doctor_reviewing" || finalized;

  useEffect(() => {
    if (!visit || !isDoctor || finalized || openedRef.current) return;
    openedRef.current = true;
    void (async () => {
      if (visit.status === "pending_review") {
        await supabase
          .from("visits")
          .update({ status: "doctor_reviewing", assigned_doctor: profile?.id ?? null, updated_at: new Date().toISOString() })
          .eq("id", visit.id);
      }
      await logAudit(
        { id: profile?.id, name: profile?.full_name, role: role ?? "doctor", healthCentre: profile?.health_centre },
        { visitId: visit.id, patientId: visit.patient_id, action: "Doctor opened case" },
      );
      void qc.invalidateQueries({ queryKey: ["visit", visitId] });
    })();
  }, [visit, isDoctor, finalized, profile, role, qc, visitId]);

  const checks = visit
    ? safetyGate(
        {
          risk_tier: visit.risk_tier,
          triggering_rules: visit.triggering_rules,
          status: visit.status,
          doctor_decision: visit.doctor_decision,
          emergency_acknowledged: Boolean(visit.emergency_acknowledged),
        },
        { doctorOpened, decisionSelected: Boolean(decision) || finalized, acknowledged },
      )
    : [];
  const passed = checks.filter((c) => c.done).length;
  const gateOpen = checks.length > 0 && passed === checks.length;

  async function acknowledgeEmergency() {
    if (!visit) return;
    await supabase.from("visits").update({ emergency_acknowledged: true, updated_at: new Date().toISOString() }).eq("id", visit.id);
    setAcknowledged(true);
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "staff", healthCentre: profile?.health_centre },
      { visitId: visit.id, patientId: visit.patient_id, action: "Emergency indicators acknowledged" },
    );
    toast.success("Emergency indicators acknowledged");
    void qc.invalidateQueries({ queryKey: ["visit", visitId] });
  }

  async function requestConsultation(priority: "routine" | "urgent" | "emergency") {
    if (!visit) return;
    const { error } = await supabase.from("consultations").insert({
      visit_id: visit.id,
      patient_id: visit.patient_id,
      health_centre: profile?.health_centre ?? "Unassigned",
      priority,
      status: "waiting",
    });
    if (error) {
      toast.error("Could not request consultation");
      return;
    }
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "health_worker", healthCentre: profile?.health_centre },
      { visitId: visit.id, patientId: visit.patient_id, action: "Doctor consultation requested", detail: `Priority: ${priority}` },
    );
    await notify({
      audience: "doctor",
      title: `Consultation requested (${priority})`,
      body: `${patient?.name ?? "Patient"} — ${profile?.health_centre ?? "Clinic"}`,
      kind: "consultation",
      visitId: visit.id,
      healthCentre: profile?.health_centre ?? null,
    });
    toast.success("Consultation requested");
    void qc.invalidateQueries({ queryKey: ["visit-consultation", visitId] });
  }

  async function createReferral() {
    if (!visit) return;
    if (!confirmReferral) {
      setConfirmReferral(true);
      return;
    }
    const { error } = await supabase.from("referrals").insert({
      visit_id: visit.id,
      patient_id: visit.patient_id,
      health_centre: profile?.health_centre ?? "Unassigned",
      risk_tier: visit.risk_tier,
      reason: rules.join(" · ") || "Clinical escalation",
      facility: facility || "Nearest hospital",
      doctor_id: isDoctor ? profile?.id ?? null : null,
      status: "recommended",
    });
    if (error) {
      toast.error("Could not create referral");
      return;
    }
    await supabase.from("visits").update({ referral_required: true, updated_at: new Date().toISOString() }).eq("id", visit.id);
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "staff", healthCentre: profile?.health_centre },
      { visitId: visit.id, patientId: visit.patient_id, action: "Referral created", detail: facility || "Nearest hospital" },
    );
    await notify({
      audience: "all",
      title: "Hospital referral recorded",
      body: `${patient?.name ?? "Patient"} — ${facility || "Nearest hospital"}`,
      kind: "emergency",
      visitId: visit.id,
      healthCentre: profile?.health_centre ?? null,
    });
    setConfirmReferral(false);
    toast.success("Referral recorded");
    void qc.invalidateQueries({ queryKey: ["visit-referral", visitId] });
  }

  async function finalize() {
    if (!visit || !decision) return;
    setSaving(true);
    const { error } = await supabase
      .from("visits")
      .update({
        status: "finalized",
        doctor_decision: decision,
        doctor_notes: notes || null,
        assigned_doctor: profile?.id ?? null,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", visit.id);
    if (error) {
      setSaving(false);
      toast.error("Could not finalize — please try again");
      return;
    }

    const actor = { id: profile?.id, name: profile?.full_name, role: role ?? "doctor", healthCentre: profile?.health_centre };
    if (decision !== "approve") {
      await logAudit(actor, {
        visitId: visit.id,
        patientId: visit.patient_id,
        action: decision === "modify" ? "Doctor modified AI suggestion" : "Doctor overrode AI suggestion",
        ...(notes ? { detail: notes } : {}),
      });
    }
    await logAudit(actor, {
      visitId: visit.id,
      patientId: visit.patient_id,
      action: "Doctor finalized decision",
      detail: `Decision: ${decision} · Safety Gate ${passed}/${checks.length}`,
    });

    if (needFollowUp && followDate) {
      await supabase.from("follow_ups").insert({
        visit_id: visit.id,
        patient_id: visit.patient_id,
        health_centre: profile?.health_centre ?? "Unassigned",
        due_date: followDate,
        reason: followReason || "Doctor-requested follow-up",
        instructions: followInstructions || null,
        priority: followPriority,
        created_by: profile?.id ?? null,
        status: "scheduled",
      });
      await logAudit(actor, { visitId: visit.id, patientId: visit.patient_id, action: "Follow-up scheduled", detail: followDate });
    }

    await notify({
      audience: "health_worker",
      title: "Doctor has finalized this visit",
      body: `${patient?.name ?? "Patient"} — decision: ${decision}`,
      kind: "info",
      visitId: visit.id,
      healthCentre: profile?.health_centre ?? null,
    });

    setSaving(false);
    toast.success("Decision finalized by doctor");
    void qc.invalidateQueries({ queryKey: ["visit", visitId] });
    void qc.invalidateQueries({ queryKey: ["audit", visitId] });
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading clinical record…
        </div>
      </AppShell>
    );
  }
  if (isError || !visit) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold">Unable to load this visit.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The record may not exist, or your account may not have access to this health centre.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/queue">Back to queue</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const structured = (visit.structured_summary ?? null) as Record<string, unknown> | null;
  const drug = (visit.drug_safety_info ?? null) as { medicine?: string; warnings?: string[] } | null;
  const isRed = tier === "RED";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {patient ? (
                <Link to="/patients/$patientId" params={{ patientId: patient.id }} className="underline-offset-4 hover:underline">
                  {patient.name}
                </Link>
              ) : (
                "Patient"
              )}
              <span className="ml-2 text-base font-normal text-muted-foreground">{patient?.age} yrs</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Visit ID {visit.id.slice(0, 8)} · {formatDateTime(visit.created_at)} · Status{" "}
              <b>{STATUS_LABEL[visit.status] ?? visit.status}</b>
              {patient?.health_centre ? ` · ${patient.health_centre}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/referral/$visitId" params={{ visitId: visit.id }}>
                <Printer className="size-4" aria-hidden /> Print summary
              </Link>
            </Button>
          </div>
        </header>

        {visit.ai_status === "unavailable" ? (
          <p className="rounded-2xl border border-risk-amber/30 bg-risk-amber-soft p-4 text-sm font-medium text-risk-amber">
            AI assessment unavailable. Risk classification is based on predefined safety rules and requires
            professional review.
          </p>
        ) : null}

        {/* Risk banner */}
        <section className={`rounded-2xl border p-6 shadow-sm ${tierClasses(tier)}`} aria-live="polite">
          <div className="flex flex-wrap items-center gap-3">
            <RiskPill tier={tier} withLabel />
            <h2 className="text-xl font-bold uppercase tracking-wide">RISK TIER: {TIER_LABEL[tier]}</h2>
          </div>
          <p className="mt-2 text-sm">{TIER_BLURB[tier]}</p>
        </section>

        {/* Explainability */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Why this tier?</h2>
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary">
              <ShieldCheck className="size-3.5" aria-hidden /> Risk tier calculated by deterministic clinical rules
            </span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {rules.length === 0 ? (
              <li className="text-sm text-muted-foreground">No rules recorded for this visit.</li>
            ) : (
              rules.map((rule) => (
                <li key={rule} className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium">
                  {rule}
                </li>
              ))
            )}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            AI reasoning does not determine emergency severity. These rules are fixed in code and reviewed by clinicians.
          </p>
        </section>

        {/* Vitals */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h2>
          <VitalsCards vitals={(visit.vitals ?? {}) as never} age={patient?.age ?? null} />
        </section>

        {/* Emergency interface */}
        {isRed ? (
          <section className="rounded-2xl border border-risk-red/40 bg-risk-red-soft p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-risk-red">
              <AlertTriangle className="size-5" aria-hidden /> Urgent medical attention required
            </h2>
            <p className="mt-2 text-sm text-risk-red">
              Refer to hospital / nearest doctor immediately. First-aid protocols, OTC medicines and drug-safety
              suggestions are withheld for emergency cases by design.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-medium text-risk-red">
              {rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-3 text-sm text-risk-red sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-80">Patient contact</dt>
                <dd>{patient?.contact ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-80">Location</dt>
                <dd>{patient?.location ?? patient?.health_centre ?? "Not recorded"}</dd>
              </div>
            </dl>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="facility">Nearest hospital / receiving facility</Label>
                <Input
                  id="facility"
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                  placeholder="e.g. District Hospital, Rampur"
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Referral status</p>
                <p className="text-sm">{referral ? `Recorded — ${referral.status}` : "No referral recorded yet"}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={() => requestConsultation("emergency")} disabled={Boolean(consultation)}>
                <Stethoscope className="size-4" aria-hidden />
                {consultation ? "Consultation requested" : "Start doctor consultation"}
              </Button>
              <Button size="sm" variant="outline" onClick={createReferral} disabled={Boolean(referral)}>
                {referral ? "Referral recorded" : confirmReferral ? "Confirm hospital referral" : "Mark hospital referral"}
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/referral/$visitId" params={{ visitId: visit.id }}>
                  <Printer className="size-4" aria-hidden /> Print referral summary
                </Link>
              </Button>
            </div>
            {confirmReferral && !referral ? (
              <p className="mt-2 text-xs font-semibold text-risk-red">
                Press “Confirm hospital referral” again to record it. This is written to the patient record.
              </p>
            ) : null}

            {!visit.emergency_acknowledged ? (
              <label className="mt-5 flex items-start gap-3 rounded-xl border border-risk-red/30 bg-card p-4 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={acknowledged}
                  onChange={(e) => {
                    setAcknowledged(e.target.checked);
                    if (e.target.checked) void acknowledgeEmergency();
                  }}
                />
                <span>I have reviewed the emergency indicators and referral recommendation.</span>
              </label>
            ) : (
              <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-risk-red">
                <CheckCircle2 className="size-4" aria-hidden /> Emergency indicators acknowledged
              </p>
            )}
          </section>
        ) : null}

        {/* AI vs doctor flow */}
        <div className="flex flex-col items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>AI suggestion</span>
          <ArrowDown className="size-4" aria-hidden />
          <span>Doctor review</span>
          <ArrowDown className="size-4" aria-hidden />
          <span>Final clinical decision</span>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* AI panel */}
          <section className="rounded-2xl border border-risk-amber/30 bg-risk-amber-soft p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-risk-amber">
              <Sparkles className="size-4" aria-hidden /> AI suggestion — pending doctor review
            </h2>

            {structured ? (
              <div className="mt-4 rounded-xl bg-card p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  AI structured summary
                </p>
                <ul className="mt-2 space-y-1">
                  <li>
                    <b>Symptoms:</b>{" "}
                    {Array.isArray(structured['symptoms']) ? (structured['symptoms'] as string[]).join(", ") : visit.symptoms_text}
                  </li>
                  <li>
                    <b>Duration:</b> {String(structured['duration'] ?? visit.duration ?? "—")}
                  </li>
                  <li>
                    <b>History:</b> {String(structured['history'] ?? visit.history_text ?? "—")}
                  </li>
                  <li>
                    <b>Detected language:</b> {String(structured['detected_language'] ?? patient?.preferred_language ?? "—")}
                  </li>
                </ul>
              </div>
            ) : null}

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-risk-amber">Preliminary assessment</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{visit.preliminary_assessment ?? "AI assessment unavailable."}</p>
            </div>

            {visit.confirmation_message ? (
              <p className="mt-4 rounded-xl bg-card p-3 text-sm" lang="und">
                {visit.confirmation_message}
              </p>
            ) : null}

            {!isRed && visit.protocol_text ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-risk-amber">
                  First-aid protocol (from the clinic protocol library, not AI-written)
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {visit.protocol_text
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line) => (
                      <li key={line}>{line.replace(/^\d+[.)]\s*/, "")}</li>
                    ))}
                </ol>
              </div>
            ) : null}

            {!isRed && drug ? (
              <div className="mt-4 rounded-xl bg-card p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Drug safety note — {drug.medicine}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {(drug.warnings ?? []).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Source: openFDA drug label data.</p>
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-risk-amber/30 p-3 text-xs text-risk-amber">
              <p className="font-semibold">AI limitations</p>
              <p className="mt-1">
                This is a preliminary assessment of clinical patterns, not a diagnosis. The AI cannot examine the
                patient, cannot set the risk tier, and cannot finalize or approve treatment. AI-generated information
                is advisory only. It does not replace a qualified medical professional.
              </p>
            </div>
          </section>

          {/* Doctor panel */}
          <section className="rounded-2xl border border-risk-green/30 bg-risk-green-soft p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-risk-green">
              <Stethoscope className="size-4" aria-hidden /> Doctor decision
            </h2>

            {finalized ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="rounded-xl bg-card p-4">
                  <b className="capitalize">{visit.doctor_decision}</b>
                  {visit.finalized_at ? ` · ${formatDateTime(visit.finalized_at)}` : ""}
                  {visit.doctor_notes ? <span className="mt-2 block whitespace-pre-wrap">{visit.doctor_notes}</span> : null}
                </p>
                <p className="rounded-xl border border-risk-green/30 p-3 text-xs font-semibold text-risk-green">
                  Final decision made by: Doctor. AI output was advisory only.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-risk-green">
                    Select a decision
                  </legend>
                  {([
                    ["approve", "Approve — the AI summary matches my clinical judgement"],
                    ["modify", "Modify — I am adjusting the AI summary"],
                    ["override", "Override — I disagree with the AI summary"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex items-start gap-3 rounded-xl bg-card p-3 text-sm">
                      <input
                        type="radio"
                        name="decision"
                        value={value}
                        checked={decision === value}
                        onChange={() => setDecision(value)}
                        disabled={!isDoctor}
                        className="mt-0.5 size-4"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>

                <div className="space-y-2">
                  <Label htmlFor="notes">Clinical notes</Label>
                  <Textarea
                    id="notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!isDoctor}
                    className="bg-card"
                    placeholder="Advice given, medication prescribed, escalation instructions…"
                  />
                </div>

                <div className="rounded-xl bg-card p-4">
                  <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={needFollowUp}
                      disabled={!isDoctor}
                      onChange={(e) => setNeedFollowUp(e.target.checked)}
                    />
                    Follow-up required
                  </label>
                  {needFollowUp ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="fdate">Follow-up date</Label>
                          <Input id="fdate" type="date" value={followDate} onChange={(e) => setFollowDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="fprio">Priority</Label>
                          <select
                            id="fprio"
                            value={followPriority}
                            onChange={(e) => setFollowPriority(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="routine">Routine</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="freason">Reason</Label>
                        <Input id="freason" value={followReason} onChange={(e) => setFollowReason(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="finstr">Instructions</Label>
                        <Textarea id="finstr" rows={2} value={followInstructions} onChange={(e) => setFollowInstructions(e.target.value)} />
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Safety gate */}
                <div className="rounded-xl border border-risk-green/30 bg-card p-4">
                  <p className="text-sm font-bold">
                    Safety Gate: {passed}/{checks.length} checks completed
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {checks.map((c) => (
                      <li key={c.label} className="flex items-start gap-2">
                        <span aria-hidden className={c.done ? "text-risk-green" : "text-muted-foreground"}>
                          {c.done ? "✓" : "○"}
                        </span>
                        <span className={c.done ? "" : "text-muted-foreground"}>
                          {c.label}
                          <span className="sr-only">{c.done ? " — complete" : " — incomplete"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {!isDoctor ? (
                  <p className="text-xs font-medium text-muted-foreground">
                    Only a doctor account can finalize this case. Health workers can request a consultation below.
                  </p>
                ) : null}

                <Button className="w-full" size="lg" disabled={!isDoctor || !gateOpen || saving} onClick={finalize}>
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Finalize decision
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* Documents */}
        {visit.image_url ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Uploaded image / document
            </h2>
            <DocumentViewer path={visit.image_url} analysis={visit.image_analysis} />
          </section>
        ) : null}

        {/* Consultation controls */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Remote doctor consultation
          </h2>
          {consultation ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold capitalize">
                {consultation.priority}
              </span>
              <span className="font-medium capitalize">{consultation.status.replace("_", " ")}</span>
              <span className="text-xs text-muted-foreground">Requested {formatDateTime(consultation.created_at)}</span>
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link to="/doctor">Open consultation queue</Link>
              </Button>
            </div>
          ) : finalized ? (
            <p className="mt-2 text-sm text-muted-foreground">This case is finalized.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["routine", "urgent", "emergency"] as const).map((p) => (
                <Button key={p} size="sm" variant="outline" className="capitalize" onClick={() => requestConsultation(p)}>
                  Request doctor consultation — {p}
                </Button>
              ))}
            </div>
          )}
        </section>

        {/* Audit */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity timeline</h2>
          <AuditTimeline visitId={visit.id} />
        </section>
      </div>
    </AppShell>
  );
}
