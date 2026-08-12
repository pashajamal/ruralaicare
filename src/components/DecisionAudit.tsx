import { Sparkles, Stethoscope } from "lucide-react";

import { formatDateTime } from "@/lib/clinic";

type VisitRow = {
  id: string;
  created_at: string;
  risk_tier: string | null;
  triggering_rules: unknown;
  structured_summary: unknown;
  preliminary_assessment: string | null;
  protocol_text: string | null;
  drug_safety_info: unknown;
  image_analysis: string | null;
  ai_status: string | null;
  status: string;
  doctor_decision: string | null;
  doctor_notes: string | null;
  finalized_at: string | null;
  updated_at: string | null;
};

const DECISION_LABEL: Record<string, string> = {
  approve: "Approved the AI draft",
  modify: "Modified the AI draft",
  override: "Overrode the AI draft",
};

/** Side-by-side record of exactly what the AI suggested versus what the doctor decided. */
export function DecisionAudit({ visit }: { visit: VisitRow }) {
  const aiPayload = {
    ai_status: visit.ai_status,
    risk_tier: visit.risk_tier,
    risk_tier_source: "deterministic_rules",
    triggering_rules: visit.triggering_rules ?? [],
    structured_summary: visit.structured_summary ?? null,
    preliminary_assessment: visit.preliminary_assessment,
    protocol_text: visit.protocol_text,
    drug_safety_info: visit.drug_safety_info ?? null,
    image_analysis: visit.image_analysis,
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Decision audit trail
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The unedited AI suggestion is retained permanently next to the doctor's decision, so the two can never be
        confused for one another.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-risk-amber/30 bg-risk-amber-soft p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-risk-amber">
            <Sparkles className="size-4" aria-hidden /> Original AI suggestion (JSON)
          </h3>
          <p className="mt-1 text-xs text-risk-amber">Recorded {formatDateTime(visit.created_at)} · never edited</p>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-card p-3 text-xs leading-relaxed">
            <code>{JSON.stringify(aiPayload, null, 2)}</code>
          </pre>
        </div>

        <div className="rounded-xl border border-risk-green/30 bg-risk-green-soft p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-risk-green">
            <Stethoscope className="size-4" aria-hidden /> Doctor decision
          </h3>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Decision</dt>
              <dd className="font-semibold">
                {visit.doctor_decision
                  ? DECISION_LABEL[visit.doctor_decision] ?? visit.doctor_decision
                  : "Not decided yet — case is not finalized"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Clinical notes</dt>
              <dd className="whitespace-pre-wrap">{visit.doctor_notes || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Finalized at</dt>
              <dd className="tabular-nums">
                {visit.finalized_at ? formatDateTime(visit.finalized_at) : "Not finalized"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Last updated</dt>
              <dd className="tabular-nums">{visit.updated_at ? formatDateTime(visit.updated_at) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Record status</dt>
              <dd className="capitalize">{visit.status.replace("_", " ")}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}