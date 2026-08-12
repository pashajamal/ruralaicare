import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Loader2, XCircle } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/care-plans")({
  head: () => ({
    meta: [
      { title: "Active Care Plans | AI Virtual Clinic" },
      {
        name: "description",
        content: "Patients under doctor-guided home monitoring, their daily-log compliance and recent vitals trend.",
      },
      { property: "og:title", content: "Active Care Plans | AI Virtual Clinic" },
      { property: "og:description", content: "Track home-monitoring compliance for every active care plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarePlansPage,
});

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">Not enough data</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-28" role="img" aria-label="Recent trend">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} className="text-primary" />
    </svg>
  );
}

function CarePlansPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["active-care-plans"],
    queryFn: async () => {
      const { data: plans, error } = await supabase
        .from("care_plans")
        .select("*, patients(id, name, age)")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (plans ?? []).map((p) => p.patient_id);
      const { data: entries } = ids.length
        ? await supabase
            .from("daily_tracker_entries")
            .select("patient_id, entry_date, spo2, severity_score, escalation_flag")
            .in("patient_id", ids)
            .order("entry_date", { ascending: false })
        : { data: [] };

      return (plans ?? []).map((p) => {
        const rows = (entries ?? []).filter((e) => e.patient_id === p.patient_id);
        return {
          plan: p,
          loggedToday: rows.some((e) => e.entry_date === today),
          flagged: rows.some((e) => e.escalation_flag),
          trend: rows
            .slice(0, 10)
            .reverse()
            .map((e) => Number(e.spo2 ?? 100 - e.severity_score * 2)),
          logs: rows.length,
        };
      });
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-8">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardList className="size-6 text-primary" aria-hidden /> Active care plans
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Patients on doctor-guided home monitoring, with today's logging compliance.
          </p>
        </header>

        {isLoading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            No active care plans. Create one when finalizing a GREEN or YELLOW case.
          </p>
        ) : (
          <div className="space-y-3">
            {(data ?? []).map(({ plan, loggedToday, flagged, trend, logs }) => {
              const p = plan.patients as { id: string; name: string; age: number } | null;
              return (
                <article key={plan.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-semibold">
                      {p?.name ?? "Patient"} <span className="text-sm font-normal text-muted-foreground">{p?.age} yrs</span>
                    </h2>
                    {loggedToday ? (
                      <span className="flex items-center gap-1.5 rounded-full border border-risk-green/30 bg-risk-green-soft px-2.5 py-1 text-xs font-semibold text-risk-green">
                        <CheckCircle2 className="size-3.5" aria-hidden /> Logged today
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full border border-risk-amber/30 bg-risk-amber-soft px-2.5 py-1 text-xs font-semibold text-risk-amber">
                        <XCircle className="size-3.5" aria-hidden /> Not logged today
                      </span>
                    )}
                    {flagged ? (
                      <span className="rounded-full border border-risk-red/30 bg-risk-red-soft px-2.5 py-1 text-xs font-semibold text-risk-red">
                        Escalation flagged
                      </span>
                    ) : null}
                    <div className="ml-auto flex items-center gap-3">
                      <Sparkline values={trend} />
                      <Button asChild size="sm" variant="outline">
                        <Link to="/trends" search={{ patient: plan.patient_id }}>
                          View trend
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Medication</dt>
                      <dd className="whitespace-pre-wrap">{plan.medication_instructions || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Monitoring</dt>
                      <dd className="whitespace-pre-wrap">
                        {plan.monitoring_instructions || "—"} · {plan.monitoring_days} days · {logs} logs
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Follow-up</dt>
                      <dd>{plan.follow_up_date ?? "—"}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
