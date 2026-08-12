import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { VisitTable } from "@/components/VisitTable";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Patient Queue | AI Virtual Clinic" },
      { name: "description", content: "Cases awaiting doctor review, ordered by most recent intake." },
      { property: "og:title", content: "Patient Queue | AI Virtual Clinic" },
      { property: "og:description", content: "Cases awaiting doctor review, ordered by most recent intake." },
    ],
  }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Patient Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cases still waiting on a doctor decision.</p>
        </header>
        <VisitTable pendingOnly />
      </div>
    </AppShell>
  ),
});
