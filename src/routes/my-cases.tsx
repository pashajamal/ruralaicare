import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardPlus, Loader2, Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/clinic";

export const Route = createFileRoute("/my-cases")({
  head: () => ({
    meta: [
      { title: "My Submitted Cases | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Cases you submitted, their AI risk tier and whether a doctor has finalized a decision yet.",
      },
      { property: "og:title", content: "My Submitted Cases | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "Track your intakes from AI suggestion through to the doctor's final decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyCasesPage,
});

function MyCasesPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [search, setSearch] = useState("");

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
    const digits = term.replace(/\D/g, "");
    return (data ?? []).filter((v) => {
      const p = v.patients as { name?: string; mobile_number?: string | null } | null;
      const phone = (p?.mobile_number ?? "").replace(/\D/g, "");
      const matches =
        !term ||
        (p?.name ?? "").toLowerCase().includes(term) ||
        (digits.length >= 3 && phone.includes(digits));
      if (!matches) return false;
      if (filter === "Pending") return v.status !== "finalized";
      if (filter === "Finalized") return v.status === "finalized";
      if (filter !== "All") return v.risk_tier === filter.toUpperCase();
      return true;
    });
  }, [data, search, filter]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My submitted cases</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              AI suggestions are advisory only — a doctor's decision is what you act on.
            </p>
          </div>
          <Button asChild>
            <Link to="/intake">
              <ClipboardPlus className="size-4" aria-hidden /> New intake
            </Link>
          </Button>
        </header>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient name"
            aria-label="Search patient name"
            className="pl-9"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Patient</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Risk tier</th>
                <th className="px-4 py-3 font-semibold">Status</th>
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
                    No cases submitted yet.
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
                        <span className="ml-2 text-xs text-muted-foreground">{p?.age} yrs</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(v.created_at)}</td>
                      <td className="px-4 py-3">
                        <RiskPill tier={v.risk_tier} />
                      </td>
                      <td className="px-4 py-3">
                        {finalized ? (
                          <span className="rounded-full border border-risk-green/30 bg-risk-green-soft px-2.5 py-1 text-xs font-semibold text-risk-green">
                            Finalized{v.doctor_decision ? ` · ${v.doctor_decision}` : ""}
                          </span>
                        ) : (
                          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            Pending Doctor Review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/review/$visitId" params={{ visitId: v.id }}>
                            View
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
    </AppShell>
  );
}