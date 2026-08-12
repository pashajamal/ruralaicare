import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/clinic";

export function AuditTimeline({ visitId }: { visitId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, detail, actor_name, actor_role, created_at")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity timeline</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading activity…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-risk-red">Unable to load the activity log.</p>
      ) : (data ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No recorded activity for this visit yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {(data ?? []).map((row) => (
            <li key={row.id} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">{row.action}</p>
                {row.detail ? <p className="text-xs text-muted-foreground">{row.detail}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {row.actor_name} · {String(row.actor_role).replace("_", " ")} · {formatDateTime(row.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
