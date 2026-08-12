import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, User } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, formatDateTime } from "@/lib/clinic";

export const Route = createFileRoute("/patients/$patientId")({
  head: () => ({
    meta: [
      { title: "Patient Profile | AI Virtual Clinic" },
      {
        name: "description",
        content: "Chronological patient timeline with every visit, risk tier and doctor decision in one place.",
      },
      { property: "og:title", content: "Patient Profile | AI Virtual Clinic" },
      { property: "og:description", content: "Full visit history for continuity of care." },
    ],
  }),
  component: PatientProfilePage,
});

function PatientProfilePage() {
  const { patientId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const [patient, visits, followups] = await Promise.all([
        supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
        supabase.from("visits").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
        supabase.from("follow_ups").select("*").eq("patient_id", patientId).order("due_date", { ascending: true }),
      ]);
      return { patient: patient.data, visits: visits.data ?? [], followups: followups.data ?? [] };
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </AppShell>
    );
  }

  const patient = data?.patient;
  if (!patient) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
              <User className="size-6 text-primary" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{patient.name}</h1>
              <p className="text-sm text-muted-foreground">
                {patient.age} yrs · {patient.preferred_language} · {patient.health_centre ?? "—"}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total visits</dt>
              <dd className="text-lg font-semibold">{data?.visits.length ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Registered</dt>
              <dd className="text-sm">{formatDateTime(patient.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Open follow-ups</dt>
              <dd className="text-lg font-semibold">
                {(data?.followups ?? []).filter((f) => f.status !== "completed").length}
              </dd>
            </div>
          </dl>
        </header>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visit timeline</h2>
          <ol className="relative space-y-4 border-l border-border pl-6">
            {(data?.visits ?? []).map((v) => (
              <li key={v.id} className="relative rounded-2xl border border-border bg-card p-5 shadow-sm">
                <span className="absolute -left-[31px] top-6 size-3 rounded-full bg-primary ring-4 ring-background" aria-hidden />
                <div className="flex flex-wrap items-center gap-3">
                  <RiskPill tier={v.risk_tier} withLabel />
                  <span className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</span>
                  <span className="ml-auto text-xs font-semibold">{STATUS_LABEL[v.status] ?? v.status}</span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm">{v.symptoms_text}</p>
                {v.doctor_decision ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Doctor decision: <b className="capitalize">{v.doctor_decision}</b>
                    {v.doctor_notes ? ` — ${v.doctor_notes}` : ""}
                  </p>
                ) : null}
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <Link to="/review/$visitId" params={{ visitId: v.id }}>
                    Open case
                  </Link>
                </Button>
              </li>
            ))}
            {(data?.visits ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">No visits recorded.</li>
            ) : null}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
