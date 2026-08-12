import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Clock, Loader2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { waitingSince } from "@/lib/clinic";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Caseload Analytics | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Doctor caseload analytics: cases reviewed, risk-tier breakdown, average time to review and most common triggering rules.",
      },
      { property: "og:title", content: "Caseload Analytics | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "See review volume, risk-tier mix and which deterministic rules fire most often.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

const TIER_BAR: Record<string, string> = {
  RED: "bg-risk-red",
  YELLOW: "bg-risk-amber",
  GREEN: "bg-risk-green",
};

function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("id, risk_tier, status, doctor_decision, triggering_rules, created_at, finalized_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const visits = data ?? [];
  const finalized = visits.filter((v) => v.status === "finalized");
  const tiers = ["RED", "YELLOW", "GREEN"] as const;
  const counts = tiers.map((t) => ({ tier: t, count: visits.filter((v) => v.risk_tier === t).length }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  const durations = finalized
    .filter((v) => v.finalized_at)
    .map((v) => new Date(v.finalized_at as string).getTime() - new Date(v.created_at).getTime())
    .filter((ms) => ms >= 0);
  const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const ruleCounts = new Map<string, number>();
  for (const v of visits) {
    const rules = Array.isArray(v.triggering_rules) ? (v.triggering_rules as unknown[]) : [];
    for (const r of rules) {
      const key = String(r);
      ruleCounts.set(key, (ruleCounts.get(key) ?? 0) + 1);
    }
  }
  const topRules = [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const approved = finalized.filter((v) => v.doctor_decision === "approve").length;
  const agreement = finalized.length ? Math.round((approved / finalized.length) * 100) : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Caseload analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Patterns across triaged cases. Risk tiers come from deterministic clinical rules, not the AI.
          </p>
        </header>

        {isLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Cases reviewed" value={finalized.length} icon={BarChart3} />
              <Stat label="Awaiting review" value={visits.length - finalized.length} icon={Activity} />
              <Stat
                label="Avg. time to review"
                value={avgMs ? waitingSince(new Date(Date.now() - avgMs).toISOString()) : "—"}
                icon={Clock}
              />
              <Stat label="AI–doctor agreement" value={agreement === null ? "—" : `${agreement}%`} icon={Activity} />
            </div>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Risk tier breakdown
              </h2>
              <div className="mt-4 space-y-3">
                {counts.map(({ tier, count }) => (
                  <div key={tier} className="flex items-center gap-3">
                    <span className="w-20 text-xs font-bold">{tier}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${TIER_BAR[tier]}`}
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Most common triggering rules
              </h2>
              {topRules.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No rules recorded yet.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {topRules.map(([rule, count]) => (
                    <li
                      key={rule}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                    >
                      <span>{rule}</span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {count}×
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}