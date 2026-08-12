import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime, logAudit } from "@/lib/clinic";

export const Route = createFileRoute("/followups")({
  head: () => ({
    meta: [
      { title: "Follow-ups | AI Virtual Clinic" },
      {
        name: "description",
        content: "Scheduled patient follow-ups with due dates, priorities and completion tracking.",
      },
      { property: "og:title", content: "Follow-ups | AI Virtual Clinic" },
      { property: "og:description", content: "Never lose track of a patient after the first visit." },
    ],
  }),
  component: FollowUpsPage,
});

function FollowUpsPage() {
  const qc = useQueryClient();
  const { profile, role } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["followups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*, patients(name, age)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function complete(id: string, visitId: string | null) {
    const { error } = await supabase
      .from("follow_ups")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Could not update follow-up");
      return;
    }
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "staff", healthCentre: profile?.health_centre },
      { visitId, action: "Follow-up completed" },
    );
    toast.success("Follow-up marked completed");
    void qc.invalidateQueries({ queryKey: ["followups"] });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CalendarClock className="size-5 text-primary" aria-hidden /> Follow-ups
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scheduled by the doctor at finalization. Overdue items are highlighted.
          </p>
        </header>

        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            No follow-ups scheduled.
          </p>
        ) : (
          <ul className="space-y-3">
            {(data ?? []).map((f) => {
              const patient = f.patients as { name?: string; age?: number } | null;
              const overdue = f.status !== "completed" && f.due_date <= today;
              return (
                <li
                  key={f.id}
                  className={`rounded-2xl border p-5 shadow-sm ${
                    overdue ? "border-risk-amber/30 bg-risk-amber-soft" : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-semibold">{patient?.name ?? "—"}</p>
                    <span className="text-xs text-muted-foreground">{patient?.age ?? "—"} yrs</span>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold capitalize">
                      {f.priority}
                    </span>
                    <span className="text-xs font-semibold">
                      {f.status === "completed" ? "Completed" : overdue ? "Overdue" : "Scheduled"}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">Due {f.due_date}</span>
                  </div>
                  <p className="mt-3 text-sm">{f.reason}</p>
                  {f.instructions ? <p className="mt-1 text-xs text-muted-foreground">{f.instructions}</p> : null}
                  <p className="mt-2 text-xs text-muted-foreground">Created {formatDateTime(f.created_at)}</p>
                  <div className="mt-4 flex gap-2">
                    {f.visit_id ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/review/$visitId" params={{ visitId: f.visit_id }}>
                          Open case
                        </Link>
                      </Button>
                    ) : null}
                    {f.status !== "completed" ? (
                      <Button size="sm" onClick={() => complete(f.id, f.visit_id)}>
                        Mark completed
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
