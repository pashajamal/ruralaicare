import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CalendarClock, ClipboardPlus, Send, ShieldCheck, Stethoscope } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DueReminders } from "@/components/DueReminders";
import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { formatDateTime, STATUS_LABEL, TIER_ORDER, waitingSince } from "@/lib/clinic";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clinic Dashboard | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Safety-first rural clinic dashboard: deterministic risk triage, doctor-approved decisions, referrals and follow-ups in one place.",
      },
      { property: "og:title", content: "Clinic Dashboard | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "AI assists triage; a doctor makes every clinical decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, isDoctor } = useAuth();
  const { lang } = useLang();

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [visits, referrals, followups, decisions] = await Promise.all([
        supabase
          .from("visits")
          .select("id, risk_tier, status, created_at, emergency_acknowledged, patients(name, age)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("referrals").select("id, status"),
        supabase.from("follow_ups").select("id, status, due_date"),
        supabase.from("visits").select("doctor_decision").eq("status", "finalized"),
      ]);
      if (visits.error) throw visits.error;
      return {
        visits: visits.data ?? [],
        referrals: referrals.data ?? [],
        followups: followups.data ?? [],
        decisions: decisions.data ?? [],
      };
    },
  });

  const visits = data?.visits ?? [];
  const pending = visits.filter((v) => v.status !== "finalized");
  const red = pending.filter((v) => v.risk_tier === "RED");
  const finalized = data?.decisions ?? [];
  const approved = finalized.filter((d) => d.doctor_decision === "approve").length;
  const agreement = finalized.length > 0 ? Math.round((approved / finalized.length) * 100) : null;
  const openReferrals = (data?.referrals ?? []).filter((r) => r.status !== "completed").length;
  const openFollowups = (data?.followups ?? []).filter((f) => f.status !== "completed").length;

  const urgent = [...pending]
    .sort((a, b) => {
      const t = (TIER_ORDER[a.risk_tier ?? "GREEN"] ?? 3) - (TIER_ORDER[b.risk_tier ?? "GREEN"] ?? 3);
      return t !== 0 ? t : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .slice(0, 6);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isDoctor ? t(lang, "dashDoctor") : t(lang, "dashWorker")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.health_centre ?? "Clinic"} · {profile?.full_name}
            </p>
          </div>
          <div className="flex gap-2">
            {!isDoctor ? (
              <Button asChild>
                <Link to="/intake">
                  <ClipboardPlus className="size-4" aria-hidden /> {t(lang, "newIntake")}
                </Link>
              </Button>
            ) : null}
            {isDoctor ? (
              <Button asChild variant="outline">
                <Link to="/doctor">
                  <Stethoscope className="size-4" aria-hidden /> {t(lang, "reviewQueue")}
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/my-cases">{t(lang, "mySubmitted")}</Link>
              </Button>
            )}
          </div>
        </header>

        {red.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-risk-red/30 bg-risk-red-soft p-5 text-risk-red shadow-sm">
            <p className="flex items-center gap-2 text-sm font-bold">
              <AlertTriangle className="size-5" aria-hidden />
              {red.length} {t(lang, "emergencyAwaiting")}
            </p>
            <Button asChild size="sm" variant="destructive">
              <Link to="/doctor">{t(lang, "openEmergency")}</Link>
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t(lang, "statPending")} value={pending.length} icon={Activity} />
          <StatCard label={t(lang, "statRed")} value={red.length} icon={AlertTriangle} tone="red" />
          <StatCard label={t(lang, "statReferrals")} value={openReferrals} icon={Send} />
          <StatCard label={t(lang, "statFollowups")} value={openFollowups} icon={CalendarClock} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t(lang, "urgentQueue")}
              </h2>
              <Link to="/queue" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {t(lang, "viewAll")}
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {urgent.length === 0 ? (
                <li className="py-6 text-sm text-muted-foreground">{t(lang, "noWaiting")}</li>
              ) : (
                urgent.map((v, index) => {
                  const patient = v.patients as { name?: string; age?: number } | null;
                  return (
                    <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="w-8 text-xs font-bold text-muted-foreground">#{index + 1}</span>
                      <RiskPill tier={v.risk_tier} />
                      <span className="font-medium">{patient?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {patient?.age ?? "—"} {t(lang, "yrs")} · {t(lang, "waitingWord")} {waitingSince(v.created_at)}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">{STATUS_LABEL[v.status] ?? v.status}</span>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/review/$visitId" params={{ visitId: v.id }}>
                          {t(lang, "open")}
                        </Link>
                      </Button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t(lang, "agreementTitle")}
              </h2>
              <p className="mt-3 text-4xl font-semibold tabular-nums">{agreement === null ? "—" : `${agreement}%`}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {finalized.length} finalized case{finalized.length === 1 ? "" : "s"} · {approved} approved without change
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{t(lang, "agreementHelp")}</p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" aria-hidden /> {t(lang, "safetyModel")}
              </p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>{t(lang, "safety1")}</li>
                <li>{t(lang, "safety2")}</li>
                <li>{t(lang, "safety3")}</li>
              </ul>
            </div>
          </section>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TierCount label="RED" count={visits.filter((v) => v.risk_tier === "RED").length} />
          <TierCount label="YELLOW" count={visits.filter((v) => v.risk_tier === "YELLOW").length} />
          <TierCount label="GREEN" count={visits.filter((v) => v.risk_tier === "GREEN").length} />
        </div>

        <DueReminders limit={5} compact />

        <p className="pb-2 text-xs text-muted-foreground">
          {t(lang, "lastUpdated")} {formatDateTime(new Date().toISOString())}
        </p>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  tone?: "red";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        tone === "red" && value > 0
          ? "border-risk-red/30 bg-risk-red-soft text-risk-red"
          : "border-border bg-card"
      }`}
    >
      <Icon className="size-5 opacity-70" aria-hidden />
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function TierCount({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <RiskPill tier={label} withLabel />
      <span className="text-2xl font-semibold tabular-nums">{count}</span>
    </div>
  );
}
