import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Loader2, Search, Stethoscope, Zap } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DueReminders } from "@/components/DueReminders";
import { CaseFilterChips, matchesPatient, type CaseFilter } from "@/components/CaseFilters";
import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CONSULT_STATUS_LABEL, TIER_ORDER, logAudit, notify, waitingSince } from "@/lib/clinic";

export const Route = createFileRoute("/doctor")({
  head: () => ({
    meta: [
      { title: "Doctor Workspace | AI Virtual Clinic" },
      {
        name: "description",
        content: "Doctor workspace for emergency cases, pending reviews and remote consultation status tracking.",
      },
      { property: "og:title", content: "Doctor Workspace | AI Virtual Clinic" },
      { property: "og:description", content: "Review AI-drafted triage and make the final clinical decision." },
    ],
  }),
  component: DoctorPage,
});

function DoctorPage() {
  const { profile, role, isDoctor } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CaseFilter>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-workspace"],
    queryFn: async () => {
      const [visits, consults] = await Promise.all([
        supabase
          .from("visits")
          .select("id, patient_id, risk_tier, status, created_at, emergency_acknowledged, patients(name, age, mobile_number)")
          .neq("status", "finalized")
          .order("created_at", { ascending: true }),
        supabase.from("consultations").select("*").neq("status", "completed"),
      ]);
      if (visits.error) throw visits.error;
      return { visits: visits.data ?? [], consults: consults.data ?? [] };
    },
    refetchInterval: 30000,
  });

  const consults = data?.consults ?? [];
  const urgentVisitIds = new Set(
    consults.filter((c) => c.urgent_flag && c.status !== "completed" && c.visit_id).map((c) => c.visit_id as string),
  );

  const visits = [...(data?.visits ?? [])]
    .filter((v) => {
      const p = v.patients as { name?: string; mobile_number?: string | null } | null;
      if (!matchesPatient(search, p?.name, p?.mobile_number)) return false;
      if (filter === "Pending") return v.status !== "finalized";
      if (filter === "Finalized") return v.status === "finalized";
      if (filter !== "All") return v.risk_tier === filter.toUpperCase();
      return true;
    })
    .sort((a, b) => {
      // Urgent doctor-consult requests are pinned above everything, including RED cases.
      const u = Number(urgentVisitIds.has(b.id)) - Number(urgentVisitIds.has(a.id));
      if (u !== 0) return u;
      const t = (TIER_ORDER[a.risk_tier ?? "GREEN"] ?? 3) - (TIER_ORDER[b.risk_tier ?? "GREEN"] ?? 3);
      return t !== 0 ? t : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  const urgent = visits.filter((v) => urgentVisitIds.has(v.id));
  const red = visits.filter((v) => v.risk_tier === "RED" && !urgentVisitIds.has(v.id));
  const others = visits.filter((v) => v.risk_tier !== "RED" && !urgentVisitIds.has(v.id));

  async function setConsultStatus(id: string, status: "waiting" | "in_consultation" | "completed") {
    setBusy(id);
    const now = new Date().toISOString();
    const patch = {
      status,
      assigned_doctor: profile?.id ?? null,
      updated_at: now,
      ...(status === "in_consultation" ? { started_at: now } : {}),
      ...(status === "completed" ? { completed_at: now } : {}),
    };
    const { data: row, error } = await supabase.from("consultations").update(patch).eq("id", id).select("visit_id, patient_id").maybeSingle();
    setBusy(null);
    if (error) {
      toast.error("Could not update consultation status");
      return;
    }
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "doctor", healthCentre: profile?.health_centre },
      { visitId: row?.visit_id ?? null, patientId: row?.patient_id ?? null, action: `Consultation ${CONSULT_STATUS_LABEL[status]}` },
    );
    await notify({
      audience: "health_worker",
      title: `Consultation ${CONSULT_STATUS_LABEL[status]?.toLowerCase()}`,
      body: "Doctor updated the remote consultation status",
      kind: "consultation",
      visitId: row?.visit_id ?? null,
      healthCentre: profile?.health_centre ?? null,
    });
    void qc.invalidateQueries({ queryKey: ["doctor-workspace"] });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Stethoscope className="size-6 text-primary" aria-hidden /> Doctor Workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isDoctor
              ? "Every case here is waiting for your clinical decision. The AI draft is advisory only."
              : "Read-only view for health workers — only a doctor can finalize a case."}
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient name or mobile number"
              aria-label="Search patient name or mobile number"
              className="pl-9"
            />
          </div>
          <CaseFilterChips value={filter} onChange={setFilter} />
        </div>

        {urgent.length > 0 ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-risk-red">
              <Zap className="size-4" aria-hidden /> Urgent consult requests ({urgent.length})
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {urgent.map((v) => {
                const patient = v.patients as { name?: string; age?: number } | null;
                return (
                  <li key={v.id} className="rounded-2xl border-2 border-risk-red bg-risk-red-soft p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-risk-red">{patient?.name ?? "—"}</p>
                        <p className="text-xs text-risk-red/80">
                          {patient?.age ?? "—"} yrs · waiting {waitingSince(v.created_at)}
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 rounded-full bg-risk-red px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                        <span className="inline-block size-2 animate-pulse rounded-full bg-white" aria-hidden /> Urgent
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-risk-red">
                      Fast-track requested by the health worker — chat and call are already open on the case.
                    </p>
                    <Button asChild size="sm" variant="destructive" className="mt-3 w-full">
                      <Link to="/review/$visitId" params={{ visitId: v.id }}>
                        Connect now
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-risk-red">
            <AlertTriangle className="size-4" aria-hidden /> Emergency cases ({red.length})
          </h2>
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : red.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              No emergency cases open.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {red.map((v) => {
                const patient = v.patients as { name?: string; age?: number } | null;
                return (
                  <li key={v.id} className="rounded-2xl border border-risk-red/30 bg-risk-red-soft p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-risk-red">{patient?.name ?? "—"}</p>
                        <p className="text-xs text-risk-red/80">
                          {patient?.age ?? "—"} yrs · waiting {waitingSince(v.created_at)}
                        </p>
                      </div>
                      <RiskPill tier="RED" />
                    </div>
                    <p className="mt-3 text-xs text-risk-red">
                      {v.emergency_acknowledged
                        ? "Emergency acknowledged by staff — referral in progress."
                        : "Referral acknowledgment still pending."}
                    </p>
                    <Button asChild size="sm" variant="destructive" className="mt-3 w-full">
                      <Link to="/review/$visitId" params={{ visitId: v.id }}>
                        Open emergency case
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Pending review ({others.length})
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">Risk tier</th>
                  <th className="px-4 py-3 font-semibold">Waiting</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {others.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Nothing pending.
                    </td>
                  </tr>
                ) : (
                  others.map((v) => {
                    const patient = v.patients as { name?: string; age?: number } | null;
                    return (
                      <tr key={v.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">
                          {patient?.name ?? "—"}{" "}
                          <span className="text-xs text-muted-foreground">{patient?.age ?? "—"} yrs</span>
                        </td>
                        <td className="px-4 py-3">
                          <RiskPill tier={v.risk_tier} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{waitingSince(v.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/review/$visitId" params={{ visitId: v.id }}>
                              Review
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
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Remote consultations ({consults.length})
          </h2>
          {consults.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              No consultation requests right now.
            </p>
          ) : (
            <ul className="space-y-3">
              {consults.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold capitalize">
                    {c.priority}
                  </span>
                  <span className="text-sm font-medium">{CONSULT_STATUS_LABEL[c.status] ?? c.status}</span>
                  <span className="text-xs text-muted-foreground">
                    requested {waitingSince(c.created_at)} ago · {c.health_centre ?? "—"}
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {isDoctor ? (
                      <>
                        <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => setConsultStatus(c.id, "in_consultation")}>
                          Start consultation
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => setConsultStatus(c.id, "completed")}>
                          Mark completed
                        </Button>
                      </>
                    ) : null}
                    {c.visit_id ? (
                      <Button asChild size="sm">
                        <Link to="/review/$visitId" params={{ visitId: c.visit_id }}>
                          Open case
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DueReminders limit={6} />
      </div>
    </AppShell>
  );
}
