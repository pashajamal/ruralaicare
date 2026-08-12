import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Sparkles, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RiskPill, TIER_BLURB, TIER_LABEL, tierClasses, type Tier } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/review/$visitId")({
  head: () => ({
    meta: [
      { title: "AI Review & Doctor Decision | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Review the AI triage suggestion alongside the doctor decision panel before a case is finalized.",
      },
      { property: "og:title", content: "AI Review & Doctor Decision | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "AI suggestion on the left, doctor decision on the right. Nothing is final until a doctor signs off.",
      },
    ],
  }),
  component: ReviewPage,
});

type Structured = {
  symptoms?: string[];
  duration?: string;
  age?: number;
  vitals?: { temp?: number | null; bp?: string | null; pulse?: number | null; spo2?: number | null };
  history?: string;
  detected_language?: string;
  confirmation_message?: string;
};

function ReviewPage() {
  const { visitId } = Route.useParams();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState("approve");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["visit", visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, patients(name, age, preferred_language)")
        .eq("id", visitId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data?.doctor_decision) setDecision(data.doctor_decision);
    if (data?.doctor_notes) setNotes(data.doctor_notes);
  }, [data?.doctor_decision, data?.doctor_notes]);

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading assessment…
        </div>
      </AppShell>
    );
  }

  const tier = (data.risk_tier ?? "YELLOW") as Tier;
  const structured = (data.structured_summary ?? {}) as Structured;
  const rules = Array.isArray(data.triggering_rules) ? (data.triggering_rules as string[]) : [];
  const drug = data.drug_safety_info as Record<string, string> | null;
  const patient = data.patients as { name: string; age: number; preferred_language: string } | null;
  const finalized = data.status === "finalized";

  async function finalize() {
    setSaving(true);
    const { error } = await supabase
      .from("visits")
      .update({ doctor_decision: decision, doctor_notes: notes, status: "finalized" })
      .eq("id", visitId);
    setSaving(false);
    if (error) {
      toast.error("Could not save decision");
      return;
    }
    toast.success("Decision finalized");
    void queryClient.invalidateQueries({ queryKey: ["visit", visitId] });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/queue" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to queue
          </Link>
          <RiskPill tier={data.status === "finalized" ? tier : tier} />
        </div>

        <section className={`rounded-2xl border p-6 shadow-sm ${tierClasses(tier)}`}>
          <p className="text-xl font-bold tracking-tight sm:text-2xl">{TIER_LABEL[tier]}</p>
          <p className="mt-2 max-w-3xl text-sm opacity-90">{TIER_BLURB[tier]}</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Explainability — rules that fired
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rules.length === 0 ? (
              <span className="text-sm text-muted-foreground">No rules recorded.</span>
            ) : (
              rules.map((rule) => (
                <span
                  key={rule}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${tierClasses(tier)}`}
                >
                  {rule}
                </span>
              ))
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Risk tier is set by deterministic clinical rules in code — never by the AI model.
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* AI SUGGESTION */}
          <section className="rounded-2xl border border-ai-border bg-ai-panel p-6 shadow-sm">
            <header className="mb-4 flex items-center gap-2">
              <Sparkles className="size-4 text-risk-amber" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-risk-amber">
                AI Suggestion — Pending Doctor Review
              </h2>
            </header>

            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-1 font-semibold">Patient summary</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    <span className="text-foreground">Patient:</span> {patient?.name} · {patient?.age} yrs ·{" "}
                    {structured.detected_language ?? patient?.preferred_language}
                  </li>
                  <li>
                    <span className="text-foreground">Symptoms:</span>{" "}
                    {(structured.symptoms ?? [data.symptoms_text]).join(", ")}
                  </li>
                  <li>
                    <span className="text-foreground">Duration:</span> {structured.duration || data.duration || "—"}
                  </li>
                  <li>
                    <span className="text-foreground">Vitals:</span> Temp {fmt(structured.vitals?.temp)}°C · BP{" "}
                    {structured.vitals?.bp ?? "—"} · Pulse {fmt(structured.vitals?.pulse)} · SpO2{" "}
                    {fmt(structured.vitals?.spo2)}%
                  </li>
                  <li>
                    <span className="text-foreground">History:</span> {structured.history || data.history_text || "—"}
                  </li>
                </ul>
              </div>

              {data.image_analysis ? (
                <div>
                  <p className="mb-1 font-semibold">Image observation</p>
                  <p className="whitespace-pre-line text-muted-foreground">{data.image_analysis}</p>
                </div>
              ) : null}

              <div>
                <p className="mb-1 font-semibold">Preliminary assessment (not a diagnosis)</p>
                <p className="whitespace-pre-line text-muted-foreground">
                  {data.preliminary_assessment ?? "Pending…"}
                </p>
              </div>

              {tier === "RED" ? (
                <div className="rounded-xl border border-risk-red/30 bg-risk-red-soft p-4">
                  <p className="flex items-center gap-2 font-bold text-risk-red">
                    <AlertTriangle className="size-4" /> Refer to hospital / nearest doctor immediately
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-risk-red">
                    {rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-risk-red/80">
                    First-aid protocol and medicine guidance are withheld for RED cases by design.
                  </p>
                </div>
              ) : null}

              {tier === "GREEN" && data.protocol_text ? (
                <div>
                  <p className="mb-1 font-semibold">First-aid protocol (from clinic protocol library)</p>
                  <p className="whitespace-pre-line text-muted-foreground">{data.protocol_text}</p>
                </div>
              ) : null}

              {tier === "GREEN" && drug ? (
                <div className="rounded-xl border border-ai-border/70 bg-card/60 p-4">
                  <p className="mb-1 font-semibold">Drug safety note — {drug["medicine"]}</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {drug["note"] ? <p>{drug["note"]}</p> : null}
                    {drug["contraindications"] ? <p><b>Contraindications:</b> {drug["contraindications"]}</p> : null}
                    {drug["pediatric_use"] ? <p><b>Pediatric:</b> {drug["pediatric_use"]}</p> : null}
                    {drug["geriatric_use"] ? <p><b>Geriatric:</b> {drug["geriatric_use"]}</p> : null}
                    <p className="italic">Source: {drug["source"]}</p>
                  </div>
                </div>
              ) : null}

              {structured.confirmation_message ? (
                <p className="rounded-lg bg-card/60 px-3 py-2 text-xs text-muted-foreground">
                  {structured.confirmation_message}
                </p>
              ) : null}
            </div>
          </section>

          {/* DOCTOR DECISION */}
          <section className="rounded-2xl border border-doctor-border bg-doctor-panel p-6 shadow-sm">
            <header className="mb-4 flex items-center gap-2">
              <Stethoscope className="size-4 text-risk-green" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-risk-green">Doctor Decision</h2>
            </header>

            {finalized ? (
              <p className="mb-4 flex items-center gap-2 rounded-lg border border-risk-green/30 bg-risk-green-soft px-3 py-2 text-sm font-medium text-risk-green">
                <CheckCircle2 className="size-4" /> Finalized as “{data.doctor_decision}”
              </p>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                Nothing is stored as final until this decision is submitted.
              </p>
            )}

            <RadioGroup value={decision} onValueChange={setDecision} className="space-y-2">
              {[
                { value: "approve", label: "Approve", hint: "AI suggestion is clinically appropriate" },
                { value: "modify", label: "Modify", hint: "Accept with the changes noted below" },
                { value: "override", label: "Override", hint: "Reject the AI suggestion entirely" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-doctor-border/70 bg-card px-4 py-3"
                >
                  <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>

            <div className="mt-4 space-y-2">
              <Label htmlFor="notes">Doctor notes</Label>
              <Textarea
                id="notes"
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Clinical reasoning, changes to the plan, follow-up instructions…"
                className="bg-card"
              />
            </div>

            <Button onClick={finalize} disabled={saving} size="lg" className="mt-4 w-full">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {finalized ? "Update Decision" : "Finalize Decision"}
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function fmt(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : value;
}
