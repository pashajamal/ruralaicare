import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { VisitTable } from "@/components/VisitTable";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Patient History | AI Virtual Clinic" },
      { name: "description", content: "Searchable record of every past visit, risk tier and review status." },
      { property: "og:title", content: "Patient History | AI Virtual Clinic" },
      { property: "og:description", content: "Searchable record of every past visit, risk tier and review status." },
    ],
  }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Patient History</h1>
          <p className="mt-1 text-sm text-muted-foreground">All recorded visits, pending and finalized.</p>
        </header>
        <VisitTable />
      </div>
    </AppShell>
  ),
});
