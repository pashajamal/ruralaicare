import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardPlus, Loader2, Search } from "lucide-react";

import { RiskPill } from "@/components/risk";
import { CaseFilterChips, matchesPatient, type CaseFilter } from "@/components/CaseFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/clinic";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";

export function MyCasesPanel() {
  const { session } = useAuth();
  const { lang } = useLang();
  const userId = session?.user?.id;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CaseFilter>("All");

  const { data, isLoading } = useQuery({
    enabled: Boolean(userId),
    queryKey: ["my-cases", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("id, risk_tier, status, created_at, doctor_decision, doctor_notes, patients(id, name, age, mobile_number)")
        .eq("created_by", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((v) => {
      const p = v.patients as { name?: string; mobile_number?: string | null } | null;
      if (!matchesPatient(term, p?.name, p?.mobile_number)) return false;
      if (filter === "Pending") return v.status !== "finalized";
      if (filter === "Finalized") return v.status === "finalized";
      if (filter !== "All") return v.risk_tier === filter.toUpperCase();
      return true;
    });
  }, [data, search, filter]);

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6">

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, "searchNameMobile")}
              aria-label={t(lang, "searchNameMobile")}
              className="pl-9"
            />
          </div>
          <CaseFilterChips value={filter} onChange={setFilter} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">{t(lang, "patient")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "submitted")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "riskTier")}</th>
                <th className="px-4 py-3 font-semibold">{t(lang, "status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {t(lang, "noCasesYet")}
                  </td>
                </tr>
              ) : (
                rows.map((v) => {
                  const p = v.patients as { name?: string; age?: number } | null;
                  const finalized = v.status === "finalized";
                  return (
                    <tr key={v.id} className="border-t border-border align-middle">
                      <td className="px-4 py-3 font-medium">
                        {p?.name ?? "Unknown"}
                        <span className="ml-2 text-xs text-muted-foreground">{p?.age} {t(lang, "yrs")}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(v.created_at)}</td>
                      <td className="px-4 py-3">
                        <RiskPill tier={v.risk_tier} />
                      </td>
                      <td className="px-4 py-3">
                        {finalized ? (
                          <span className="rounded-full border border-risk-green/30 bg-risk-green-soft px-2.5 py-1 text-xs font-semibold text-risk-green">
                            {t(lang, "finalized")}
                            {v.doctor_decision ? ` · ${v.doctor_decision}` : ""}
                          </span>
                        ) : (
                          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            {t(lang, "pendingDoctorReview")}
                          </span>
                        )}
                      </td>
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