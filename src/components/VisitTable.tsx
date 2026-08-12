import { Link } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const FILTERS = ["All", "RED", "YELLOW", "GREEN"] as const;

export function VisitTable({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["visits", pendingOnly],
    queryFn: async () => {
      let query = supabase
        .from("visits")
        .select("id, risk_tier, status, created_at, patients(name, age)")
        .order("created_at", { ascending: false });
      if (pendingOnly) query = query.eq("status", "pending_review");
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    return (data ?? []).filter((row) => {
      const name = (row.patients as { name?: string } | null)?.name ?? "";
      const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "All" || row.risk_tier === filter;
      return matchesSearch && matchesFilter;
    });
  }, [data, search, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-semibold">Patient</th>
              <th className="px-5 py-3 font-semibold">Age</th>
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold">Risk tier</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  No visits yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const patient = row.patients as { name?: string; age?: number } | null;
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{patient?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{patient?.age ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <RiskPill tier={row.risk_tier} />
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-medium ${
                          row.status === "finalized" ? "text-risk-green" : "text-muted-foreground"
                        }`}
                      >
                        {row.status === "finalized" ? "Finalized" : "Pending Review"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/review/$visitId" params={{ visitId: row.id }}>
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
  );
}
