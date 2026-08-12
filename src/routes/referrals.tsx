import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer, Send } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { REFERRAL_STATUS, REFERRAL_STATUS_LABEL, formatDateTime, logAudit } from "@/lib/clinic";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals | AI Virtual Clinic" },
      {
        name: "description",
        content: "Track hospital referrals raised from emergency triage and print clinical referral summaries.",
      },
      { property: "og:title", content: "Referrals | AI Virtual Clinic" },
      { property: "og:description", content: "Referral tracking from recommendation to completion." },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const qc = useQueryClient();
  const { profile, role, isDoctor } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["referrals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*, patients(name, age)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function advance(id: string, status: string, visitId: string | null) {
    const { error } = await supabase.from("referrals").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast.error("Could not update referral");
      return;
    }
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "staff", healthCentre: profile?.health_centre },
      { visitId, action: `Referral marked ${REFERRAL_STATUS_LABEL[status]}` },
    );
    toast.success(`Referral marked ${REFERRAL_STATUS_LABEL[status]}`);
    void qc.invalidateQueries({ queryKey: ["referrals"] });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Send className="size-5 text-primary" aria-hidden /> Referrals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Referrals are raised when deterministic emergency rules fire or a doctor decides a transfer is needed.
          </p>
        </header>

        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            No referrals raised yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {(data ?? []).map((r) => {
              const patient = r.patients as { name?: string; age?: number } | null;
              return (
                <li key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <RiskPill tier={r.risk_tier} />
                    <p className="font-semibold">{patient?.name ?? "—"}</p>
                    <span className="text-xs text-muted-foreground">{patient?.age ?? "—"} yrs</span>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold">
                      {REFERRAL_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                  </div>
                  <p className="mt-3 text-sm">{r.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Facility: {r.facility ?? "Nearest hospital"}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {r.visit_id ? (
                      <>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/review/$visitId" params={{ visitId: r.visit_id }}>
                            Open case
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/referral/$visitId" params={{ visitId: r.visit_id }}>
                            <Printer className="size-4" aria-hidden /> Printable summary
                          </Link>
                        </Button>
                      </>
                    ) : null}
                    {REFERRAL_STATUS.filter((s) => s !== r.status).map((s) => (
                      <Button key={s} size="sm" variant="ghost" onClick={() => advance(r.id, s, r.visit_id)}>
                        Mark {REFERRAL_STATUS_LABEL[s]}
                      </Button>
                    ))}
                  </div>
                  {!isDoctor ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Status updates are logged in the audit trail with your name.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
