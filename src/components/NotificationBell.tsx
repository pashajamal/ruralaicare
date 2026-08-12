import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/clinic";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, kind, visit_id, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  async function markAllRead() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-risk-red px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-border bg-card p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</p>
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              items.map((n) => {
                const body = (
                  <div
                    className={`rounded-xl px-3 py-2 ${n.read_at ? "" : "bg-secondary"} ${
                      n.kind === "emergency" ? "border-l-4 border-risk-red" : ""
                    }`}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</p>
                  </div>
                );
                return n.visit_id ? (
                  <Link key={n.id} to="/review/$visitId" params={{ visitId: n.visit_id }} onClick={() => setOpen(false)}>
                    {body}
                  </Link>
                ) : (
                  <div key={n.id}>{body}</div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
