import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { statusLabel, t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import {
  CONSULT_STATUS_LABEL,
  TIER_ORDER,
  logAudit,
  notify,
  waitingSince,
} from "@/lib/clinic";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Patient Queue | AI Virtual Clinic" },
      {
        name: "description",
        content: "Live patient queue sorted by clinical urgency, with emergency cases pinned to the top.",
      },
      { property: "og:title", content: "Patient Queue | AI Virtual Clinic" },
      { property: "og:description", content: "Urgency-sorted triage queue awaiting doctor review." },
    ],
  }),
  component: QueuePage,
});

const TIER_FILTERS = ["All", "RED", "YELLOW", "GREEN"] as const;
const STATUS_FILTERS = ["Pending", "All", "Finalized"] as const;

function QueuePage() {
  const { profile, role } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<(typeof TIER_FILTERS)[number]>("All");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("Pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["queue"],
    queryFn: async () => {
      const [visits, consults] = await Promise.all([
        supabase
          .from("visits")
          .select("id, patient_id, risk_tier, status, created_at, patients(name, age)")
          .order("created_at", { ascending: true }),
        supabase.from("consultations").select("id, visit_id, status, priority"),
      ]);
      if (visits.error) throw visits.error;
      return { visits: visits.data ?? [], consults: consults.data ?? [] };
    },
    refetchInterval: 30000,
  });

  const rows = useMemo(() => {
    const consultByVisit = new Map((data?.consults ?? []).map((c) => [c.visit_id, c]));
    return (data?.visits ?? [])
      .map((v) => ({ ...v, consult: consultByVisit.get(v.id) ?? null }))
      .filter((v) => {
        const name = (v.patients as { name?: string } | null)?.name ?? "";
        if (!name.toLowerCase().includes(search.toLowerCase())) return false;
        if (tier !== "All" && v.risk_tier !== tier) return false;
        if (statusFilter === "Pending" && v.status === "finalized") return false;
        if (statusFilter === "Finalized" && v.status !== "finalized") return false;
        return true;
      })
      .sort((a, b) => {
        const t = (TIER_ORDER[a.risk_tier ?? "GREEN"] ?? 3) - (TIER_ORDER[b.risk_tier ?? "GREEN"] ?? 3);
        if (t !== 0) return t;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [data, search, tier, statusFilter]);

  async function requestConsult(
    visit: { id: string; patient_id: string; risk_tier: string | null },
    priority: "routine" | "urgent" | "emergency",
  ) {
    setBusyId(visit.id);
    const { error } = await supabase.from("consultations").insert({
      visit_id: visit.id,
      patient_id: visit.patient_id,
      health_centre: profile?.health_centre ?? "Unassigned",
      priority,
      status: "waiting",
    });
    setBusyId(null);
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
      body: `${profile?.health_centre ?? "Clinic"} requested a remote doctor consultation`,
      kind: "consultation",
      visitId: visit.id,
      healthCentre: profile?.health_centre ?? null,
    });
    toast.success("Consultation requested — the patient is now in the doctor queue");
    void qc.invalidateQueries({ queryKey: ["queue"] });
  }

  const redCount = rows.filter((r) => r.risk_tier === "RED").length;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t(lang, "queue")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(lang, "queueSubtitle")}</p>
        </header>

        {redCount > 0 ? (
          <p className="flex items-center gap-2 rounded-2xl border border-risk-red/30 bg-risk-red-soft px-4 py-3 text-sm font-semibold text-risk-red">
            <AlertTriangle className="size-4" aria-hidden /> {redCount} {t(lang, "emergencyTop")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, "searchByName")}
              className="pl-9"
            />
          </div>
          <FilterChips
            options={TIER_FILTERS}
            value={tier}
            onChange={setTier}
            label={(o) => (o === "All" ? t(lang, "all") : o)}
          />
          <FilterChips
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={setStatusFilter}
            label={(o) =>
              o === "All" ? t(lang, "all") : o === "Pending" ? t(lang, "pending") : t(lang, "finalized")
            }
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "patient")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "riskTier")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "waitingCol")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "status")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "consultation")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <Loader2 className="mx-auto size-4 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {t(lang, "noMatchFilters")}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const patient = row.patients as { name?: string; age?: number } | null;
                  return (
                    <tr key={row.id} className={`border-t border-border ${row.risk_tier === "RED" ? "bg-risk-red-soft/40" : ""}`}>
                      <td className="px-4 py-3 text-xs font-bold text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          to="/patients/$patientId"
                          params={{ patientId: row.patient_id }}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {patient?.name ?? "—"}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {patient?.age ?? "—"} {t(lang, "yrs")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RiskPill tier={row.risk_tier} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{waitingSince(row.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{statusLabel(lang, row.status)}</td>
                      <td className="px-4 py-3 text-xs">
                        {row.consult ? (
                          <span className="font-medium">{CONSULT_STATUS_LABEL[row.consult.status] ?? row.consult.status}</span>
                        ) : row.status === "finalized" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex gap-1">
                            {(["routine", "urgent", "emergency"] as const).map((p) => (
                              <button
                                key={p}
                                disabled={busyId === row.id}
                                onClick={() => requestConsult(row, p)}
                                className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold hover:border-primary hover:text-primary disabled:opacity-50"
                              >
                                {t(lang, p)}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/review/$visitId" params={{ visitId: row.id }}>
                            {t(lang, "view")}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="pb-2 text-xs text-muted-foreground">{t(lang, "queueFooter")}</p>
      </div>
    </AppShell>
  );
}

function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: (option: T) => string;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            value === option
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          {label ? label(option) : option}
        </button>
      ))}
    </div>
  );
}
