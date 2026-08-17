import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/clinic";

const TYPE_LABEL: Record<string, string> = {
  daily_log: "Daily vitals log",
  follow_up: "Follow-up review",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** In-app reminder list generated from doctor care plans. Actionable from either dashboard. */
export function DueReminders({ limit = 8, compact = false }: { limit?: number; compact?: boolean }) {
  const qc = useQueryClient();
  const { profile, role } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["due-reminders", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("id, type, due_date, status, patient_id, care_plan_id, patients(name, age)")
        .eq("status", "pending")
        .lte("due_date", todayISO())
        .order("due_date", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function markDone(id: string, patientId: string, label: string) {
    setBusy(id);
    const { error } = await supabase.from("reminders").update({ status: "done" }).eq("id", id);
    setBusy(null);
    if (error) {
      toast.error("Could not update the reminder");
      return;
    }
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "staff", healthCentre: profile?.health_centre },
      { patientId, action: "Reminder completed", detail: label },
    );
    toast.success("Reminder marked done");
    void qc.invalidateQueries({ queryKey: ["due-reminders"] });
    void qc.invalidateQueries({ queryKey: ["reminders-due"] });
  }

  const rows = data ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <BellRing className="size-4 text-primary" aria-hidden /> Reminders due ({rows.length})
      </h2>
      {!compact ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Generated automatically from doctor care plans. In-app only — no SMS or push in this version.
        </p>
      ) : null}
      {isLoading ? (
        <Loader2 className="mt-4 size-4 animate-spin" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-risk-green" aria-hidden /> Nothing due right now.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => {
            const p = r.patients as { name?: string; age?: number } | null;
            const label = TYPE_LABEL[r.type] ?? r.type;
            const overdue = r.due_date < todayISO();
            return (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                  overdue ? "border-risk-amber/30 bg-risk-amber-soft" : "border-border bg-secondary"
                }`}
              >
                <b>{p?.name ?? "Patient"}</b>
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-semibold">
                  {overdue ? "Overdue" : "Due today"} · {r.due_date}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/monitoring" search={{ tab: "tracker" }}>Open tracker</Link>
                  </Button>
                  <Button size="sm" disabled={busy === r.id} onClick={() => markDone(r.id, r.patient_id, label)}>
                    {busy === r.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Mark done
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}