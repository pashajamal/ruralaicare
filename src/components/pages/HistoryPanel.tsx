import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { ConditionBadges } from "@/components/ConditionBadges";
import { RiskPill } from "@/components/risk";
import { VisitPhotoIcon } from "@/components/VisitPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/clinic";
import { statusLabel, t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import type { PregnancyStatus } from "@/lib/conditions";

const TIERS = ["All", "RED", "YELLOW", "GREEN"] as const;
const STATUSES = ["All", "pending_review", "doctor_reviewing", "finalized"] as const;

export function HistoryPanel({ scope = "all" }: { scope?: "all" | "active" | "completed" }) {
  const { lang } = useLang();
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("All");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const [from, setFrom] = useState("");
  const [referralOnly, setReferralOnly] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, patients(id, name, age, mobile_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((v) => {
      const patient = v.patients as { id?: string; name?: string; mobile_number?: string | null } | null;
      const digits = term.replace(/\D/g, "");
      const phone = (patient?.mobile_number ?? "").replace(/\D/g, "");
      const matches =
        !term ||
        (patient?.name ?? "").toLowerCase().includes(term) ||
        (digits.length >= 3 && phone.includes(digits)) ||
        v.id.toLowerCase().startsWith(term) ||
        (patient?.id ?? "").toLowerCase().startsWith(term);
      if (!matches) return false;
      if (tier !== "All" && v.risk_tier !== tier) return false;
      if (scope === "active" && v.status === "finalized") return false;
      if (scope === "completed" && v.status !== "finalized") return false;
      if (scope === "all" && status !== "All" && v.status !== status) return false;
      if (referralOnly && !v.referral_required) return false;
      if (from && v.created_at < from) return false;
      return true;
    });
  }, [data, search, tier, status, from, referralOnly, scope]);

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5">

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, "searchHistory")}
              className="pl-9"
              aria-label={t(lang, "searchHistory")}
            />
          </div>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
            aria-label={t(lang, "fromDate")}
          />
          <div className="flex gap-2">
            {TIERS.map((option) => (
              <button
                key={option}
                onClick={() => setTier(option)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  tier === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                }`}
              >
                {option === "All" ? t(lang, "all") : option}
              </button>
            ))}
          </div>
          {scope === "all" ? (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? t(lang, "allStatuses") : statusLabel(lang, s)}
              </option>
            ))}
          </select>
          ) : null}
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" className="size-4" checked={referralOnly} onChange={(e) => setReferralOnly(e.target.checked)} />
            {t(lang, "referralRequired")}
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">{t(lang, "patient")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "age")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "date")}</th>
                <th className="px-4 py-3 font-semibold sr-only">Photo</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "riskTier")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "status")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "decision")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <Loader2 className="mx-auto size-4 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {t(lang, "historyLoadFail")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {t(lang, "noPreviousVisits")}
                  </td>
                </tr>
              ) : (
                rows.map((v) => {
                  const patient = v.patients as { id?: string; name?: string; age?: number } | null;
                  return (
                    <tr key={v.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        {patient?.id ? (
                          <Link to="/patients/$patientId" params={{ patientId: patient.id }} className="underline-offset-4 hover:underline">
                            {patient.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                        <ConditionBadges
                          patientId={patient?.id ?? null}
                          pregnancy={(v.pregnancy_status ?? null) as PregnancyStatus | null}
                          className="mt-1"
                        />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{patient?.age ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(v.created_at)}</td>
                      <td className="px-4 py-3">
                        <VisitPhotoIcon visitId={v.id} hasImage={Boolean(v.image_url)} />
                      </td>
                      <td className="px-4 py-3">
                        <RiskPill tier={v.risk_tier} />
                      </td>
                      <td className="px-4 py-3 text-xs">{statusLabel(lang, v.status)}</td>
                      <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{v.doctor_decision ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/review/$visitId" params={{ visitId: v.id }}>
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
      </div>
    </>
  );
}
