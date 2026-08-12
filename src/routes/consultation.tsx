import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Phone, Radio, Video } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CallRoom, type CallVisit } from "@/components/CallRoom";
import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CONSULT_STATUS_LABEL, formatDateTime, waitingSince } from "@/lib/clinic";
import { useClinicPresence } from "@/lib/presence";
import type { CallMode } from "@/lib/webrtc";

export const Route = createFileRoute("/consultation")({
  head: () => ({
    meta: [
      { title: "Live Consultations | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Live video and audio consultations between rural health workers and doctors, with the patient's intake summary, vitals and AI suggestion alongside the call.",
      },
      { property: "og:title", content: "Live Consultations | AI Virtual Clinic" },
      { property: "og:description", content: "Escalate a case to a live doctor call without leaving the review workflow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsultationPage,
});

type Row = {
  id: string;
  visit_id: string;
  patient_id: string;
  type: string;
  priority: string;
  status: string;
  urgent_flag: boolean;
  notes: string | null;
  created_at: string;
  visits: {
    id: string;
    patient_id: string;
    created_at: string;
    symptoms_text: string;
    duration: string | null;
    history_text: string | null;
    vitals: unknown;
    risk_tier: string | null;
    triggering_rules: unknown;
    preliminary_assessment: string | null;
    protocol_text: string | null;
    doctor_notes: string | null;
    patients: { name: string; age: number } | null;
  } | null;
};

function ConsultationPage() {
  const qc = useQueryClient();
  const { doctorOnline, doctors } = useClinicPresence();
  const [active, setActive] = useState<{ id: string; visit: CallVisit; mode: CallMode } | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["consultation-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select(
          "id, visit_id, patient_id, type, priority, status, urgent_flag, notes, created_at, visits(id, patient_id, created_at, symptoms_text, duration, history_text, vitals, risk_tier, triggering_rules, preliminary_assessment, protocol_text, doctor_notes, patients(name, age))",
        )
        .neq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("consultation-queue-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, () => {
        void qc.invalidateQueries({ queryKey: ["consultation-queue"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  async function join(row: Row, mode: CallMode) {
    if (!row.visits) return;
    await supabase
      .from("consultations")
      .update({ status: "in_consultation", started_at: new Date().toISOString() })
      .eq("id", row.id);
    setActive({
      id: row.id,
      mode,
      visit: {
        id: row.visits.id,
        patient_id: row.visits.patient_id,
        created_at: row.visits.created_at,
        symptoms_text: row.visits.symptoms_text,
        duration: row.visits.duration,
        history_text: row.visits.history_text,
        vitals: row.visits.vitals,
        risk_tier: row.visits.risk_tier,
        triggering_rules: row.visits.triggering_rules,
        preliminary_assessment: row.visits.preliminary_assessment,
        protocol_text: row.visits.protocol_text,
        doctor_notes: row.visits.doctor_notes,
        patient_name: row.visits.patients?.name ?? "Patient",
        patient_age: row.visits.patients?.age ?? null,
      },
    });
  }

  const queue = (rows ?? []).filter((r) => r.type !== "chat" || r.urgent_flag);

  return (
    <AppShell>
      <div className="space-y-5 pb-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Live consultations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            An escalation path for cases that need live discussion. Routine cases stay in the async AI-suggestion →
            doctor-approval queue.
          </p>
        </header>

        <p
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
            doctorOnline
              ? "border-risk-green/30 bg-risk-green-soft text-risk-green"
              : "border-risk-amber/30 bg-risk-amber-soft text-risk-amber"
          }`}
          aria-live="polite"
        >
          <Radio className="size-4" aria-hidden />
          {doctorOnline
            ? `Doctor online (${doctors.length}) — live calls can connect now`
            : "Doctor offline — case remains in async review queue"}
        </p>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending consultation requests
          </h2>

          {isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading requests…
            </p>
          ) : queue.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No live consultation requests. Raise one from a case's review screen when async review isn't enough.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {queue.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{row.visits?.patients?.name ?? "Patient"}</p>
                      <RiskPill tier={row.visits?.risk_tier ?? null} />
                      {row.urgent_flag ? (
                        <span className="rounded-full bg-risk-red px-2 py-0.5 text-[11px] font-bold text-white">URGENT</span>
                      ) : null}
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] capitalize">
                        {CONSULT_STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {formatDateTime(row.created_at)} · waiting {waitingSince(row.created_at)} · priority{" "}
                      {row.priority}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {row.notes || row.visits?.symptoms_text || "No reason recorded"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" onClick={() => void join(row, "video")} disabled={!row.visits}>
                      <Video className="size-4" aria-hidden /> Join call
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void join(row, "audio")} disabled={!row.visits}>
                      <Phone className="size-4" aria-hidden /> Audio only
                    </Button>
                    {row.visit_id ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/review/$visitId" params={{ visitId: row.visit_id }}>
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
      </div>

      {active ? (
        <CallRoom
          consultationId={active.id}
          visit={active.visit}
          mode={active.mode}
          onClose={() => {
            setActive(null);
            void qc.invalidateQueries({ queryKey: ["consultation-queue"] });
          }}
        />
      ) : null}
    </AppShell>
  );
}
