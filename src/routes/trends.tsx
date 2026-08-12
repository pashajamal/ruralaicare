import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LineChart as LineChartIcon, Loader2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/AppShell";
import { PatientPicker, usePatients } from "@/components/PatientPicker";
import { supabase } from "@/integrations/supabase/client";

type Search = { patient?: string | undefined };

export const Route = createFileRoute("/trends")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    patient: typeof search["patient"] === "string" ? search["patient"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Health Trends | AI Virtual Clinic" },
      {
        name: "description",
        content: "Per-patient vitals timelines from home monitoring, with the points where escalation rules fired.",
      },
      { property: "og:title", content: "Health Trends | AI Virtual Clinic" },
      { property: "og:description", content: "Vitals over time, with deterministic escalation points highlighted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrendsPage,
});

function TrendsPage() {
  const { patient: initial } = Route.useSearch();
  const { data: patients } = usePatients();
  const [patientId, setPatientId] = useState(initial ?? "");

  const { data: entries, isLoading } = useQuery({
    enabled: Boolean(patientId),
    queryKey: ["trend-entries", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_tracker_entries")
        .select("entry_date, temperature, pulse, spo2, severity_score, escalation_flag, note")
        .eq("patient_id", patientId)
        .order("entry_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const chart = useMemo(
    () =>
      (entries ?? []).map((e) => ({
        date: String(e.entry_date).slice(5),
        SpO2: e.spo2,
        Temperature: e.temperature === null ? null : Number(e.temperature),
        Pulse: e.pulse,
        Severity: e.severity_score,
        flagged: e.escalation_flag,
      })),
    [entries],
  );

  const { data: totals } = useQuery({
    queryKey: ["trend-totals"],
    queryFn: async () => {
      const [{ count: logs }, { count: flags }, { count: plans }] = await Promise.all([
        supabase.from("daily_tracker_entries").select("id", { count: "exact", head: true }),
        supabase.from("escalations").select("id", { count: "exact", head: true }),
        supabase.from("care_plans").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return { logs: logs ?? 0, flags: flags ?? 0, plans: plans ?? 0 };
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-8">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <LineChartIcon className="size-6 text-primary" aria-hidden /> Health trends
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Home-monitoring vitals over time. Highlighted points are where the deterministic escalation engine fired.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Daily logs recorded", totals?.logs ?? 0],
            ["Escalations raised", totals?.flags ?? 0],
            ["Active care plans", totals?.plans ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <PatientPicker value={patientId} onChange={setPatientId} patients={patients ?? []} />

        {!patientId ? null : isLoading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : chart.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            No home-monitoring history for this patient yet.
          </p>
        ) : (
          <section className="space-y-6">
            {(["SpO2", "Temperature", "Pulse", "Severity"] as const).map((key) => (
              <div key={key} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{key}</h2>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} domain={["auto", "auto"]} />
                      <Tooltip />
                      <Line type="monotone" dataKey={key} stroke="hsl(var(--primary))" dot />
                      {chart
                        .filter((c) => c.flagged && c[key] !== null && c[key] !== undefined)
                        .map((c) => (
                          <ReferenceDot
                            key={`${key}-${c.date}`}
                            x={c.date}
                            y={c[key] as number}
                            r={5}
                            fill="hsl(var(--risk-red))"
                            stroke="none"
                          />
                        ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
