import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, BellRing, HeartPulse, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PatientPicker, usePatients } from "@/components/PatientPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { ESCALATION_RULES } from "@/lib/escalation";
import { logTrackerEntry } from "@/lib/tracker.functions";

const today = () => new Date().toISOString().slice(0, 10);

export function TrackerPanel() {
  const qc = useQueryClient();
  const { data: patients } = usePatients();
  const [patientId, setPatientId] = useState("");
  const [form, setForm] = useState({
    entry_date: today(),
    temperature: "",
    pulse: "",
    spo2: "",
    severity_score: 2,
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [alertBanner, setAlertBanner] = useState<{ tier: string; reasons: string[] } | null>(null);
  const logEntry = useServerFn(logTrackerEntry);

  const { data: plan } = useQuery({
    enabled: Boolean(patientId),
    queryKey: ["care-plan", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("care_plans")
        .select("*")
        .eq("patient_id", patientId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: entries, isLoading } = useQuery({
    enabled: Boolean(patientId),
    queryKey: ["tracker-entries", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_tracker_entries")
        .select("*")
        .eq("patient_id", patientId)
        .order("entry_date", { ascending: false })
        .limit(14);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dueToday } = useQuery({
    queryKey: ["reminders-due"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reminders")
        .select("id, type, due_date, status, patients(name)")
        .eq("status", "pending")
        .lte("due_date", today())
        .order("due_date");
      return data ?? [];
    },
  });

  const chartData = useMemo(
    () =>
      [...(entries ?? [])]
        .reverse()
        .map((e) => ({
          date: String(e.entry_date).slice(5),
          Temperature: e.temperature === null ? null : Number(e.temperature),
          SpO2: e.spo2,
          Severity: e.severity_score,
        })),
    [entries],
  );

  async function submit() {
    if (!patientId) {
      toast.error("Select a patient first");
      return;
    }
    setSaving(true);
    setAlertBanner(null);
    try {
      const result = await logEntry({
        data: {
          patient_id: patientId,
          care_plan_id: plan?.id ?? null,
          entry_date: form.entry_date,
          temperature: form.temperature ? Number(form.temperature) : null,
          pulse: form.pulse ? Number(form.pulse) : null,
          spo2: form.spo2 ? Number(form.spo2) : null,
          severity_score: Number(form.severity_score),
          note: form.note,
        },
      });
      if (result.escalated) {
        setAlertBanner({ tier: result.tier, reasons: result.reasons });
        toast.warning("This reading was flagged for doctor review");
      } else {
        toast.success("Daily log saved");
      }
      setForm({ ...form, temperature: "", pulse: "", spo2: "", note: "" });
      void qc.invalidateQueries({ queryKey: ["tracker-entries", patientId] });
      void qc.invalidateQueries({ queryKey: ["reminders-due"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the log");
    }
    setSaving(false);
  }

  const dueList = dueToday ?? [];

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6 pb-8">

        {dueList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-risk-amber/30 bg-risk-amber-soft px-4 py-3 text-sm text-risk-amber">
            <BellRing className="size-4" aria-hidden />
            <b>{dueList.filter((r) => r.type === "daily_log").length}</b> daily logs due ·{" "}
            <b>{dueList.filter((r) => r.type === "follow_up").length}</b> follow-ups due
          </div>
        ) : null}

        <PatientPicker value={patientId} onChange={setPatientId} patients={patients ?? []} />

        {patientId ? (
          <>
            {plan ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Active doctor care plan
                </h2>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Medication instructions</dt>
                    <dd className="whitespace-pre-wrap">{plan.medication_instructions || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Home monitoring</dt>
                    <dd className="whitespace-pre-wrap">
                      {plan.monitoring_instructions || "—"} ({plan.monitoring_days} days)
                    </dd>
                  </div>
                </dl>
                {Array.isArray(plan.watch_symptoms) && plan.watch_symptoms.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-risk-red">Watch for these symptoms</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(plan.watch_symptoms as string[]).map((s) => (
                        <span key={s} className="rounded-full border border-risk-red/30 bg-risk-red-soft px-2.5 py-1 text-xs font-semibold text-risk-red">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {plan.follow_up_date ? (
                  <p className="mt-3 text-xs text-muted-foreground">Follow-up due {plan.follow_up_date}</p>
                ) : null}
              </section>
            ) : (
              <p className="rounded-2xl border border-border bg-secondary p-4 text-sm text-muted-foreground">
                No active care plan for this patient. You can still log readings — escalation rules run on every entry.
              </p>
            )}

            {alertBanner ? (
              <div
                className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
                  alertBanner.tier === "RED"
                    ? "border-risk-red/30 bg-risk-red-soft text-risk-red"
                    : "border-risk-amber/30 bg-risk-amber-soft text-risk-amber"
                }`}
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-bold">This reading may need doctor attention — flagged for review.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {alertBanner.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today's log</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="temp">Temperature (°C)</Label>
                  <Input id="temp" inputMode="decimal" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} placeholder="37.0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pulse">Pulse (bpm)</Label>
                  <Input id="pulse" inputMode="numeric" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} placeholder="78" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spo2">SpO2 (%)</Label>
                  <Input id="spo2" inputMode="numeric" value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} placeholder="97" />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="sev">Symptom severity — {form.severity_score}/5</Label>
                <input
                  id="sev"
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={form.severity_score}
                  onChange={(e) => setForm({ ...form, severity_score: Number(e.target.value) })}
                  className="w-full accent-[hsl(var(--primary))]"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 — much better</span>
                  <span>5 — much worse</span>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <Label htmlFor="note">How are you feeling today?</Label>
                <Textarea id="note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Patient's own words…" />
              </div>

              <Button className="mt-4" onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save daily log
              </Button>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Last 14 days</h2>
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs recorded yet.</p>
              ) : (
                <>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="SpO2" stroke="hsl(var(--primary))" dot />
                        <Line type="monotone" dataKey="Temperature" stroke="hsl(var(--risk-amber))" dot />
                        <Line type="monotone" dataKey="Severity" stroke="hsl(var(--risk-red))" dot />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {(entries ?? []).map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2">
                        <b>{e.entry_date}</b>
                        <span className="text-muted-foreground">
                          {e.temperature ? `${e.temperature} °C · ` : ""}
                          {e.pulse ? `${e.pulse} bpm · ` : ""}
                          {e.spo2 ? `SpO2 ${e.spo2}% · ` : ""}
                          severity {e.severity_score}/5
                        </span>
                        {e.escalation_flag ? (
                          <span className="rounded-full border border-risk-red/30 bg-risk-red-soft px-2 py-0.5 text-xs font-semibold text-risk-red">
                            Flagged
                          </span>
                        ) : null}
                        {e.note ? <span className="w-full text-xs text-muted-foreground">“{e.note}”</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </>
        ) : null}

        <section className="rounded-2xl border border-border bg-secondary p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Escalation rules (deterministic, read-only)
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {ESCALATION_RULES.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
