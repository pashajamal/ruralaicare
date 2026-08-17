import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, History, ListChecks } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TabbedPage } from "@/components/TabbedPage";
import { HistoryPanel } from "@/components/pages/HistoryPanel";
import { MyCasesPanel } from "@/components/pages/MyCasesPanel";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";

const TABS = ["submitted", "active", "completed"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/cases")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: TABS.includes(search["tab"] as Tab) ? (search["tab"] as Tab) : "submitted",
  }),
  head: () => ({
    meta: [
      { title: "Case History | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Submitted, active and completed patient cases in one filterable view with risk tier and doctor decision.",
      },
      { property: "og:title", content: "Case History | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "Track every case from AI suggestion through to the doctor's final decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const { lang } = useLang();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <AppShell>
      <TabbedPage
        title={t(lang, "caseHistory")}
        subtitle={t(lang, "caseHistorySubtitle")}
        value={tab}
        onValueChange={(v) => void navigate({ to: "/cases", search: { tab: v as Tab } })}
        tabs={[
          {
            value: "submitted",
            label: t(lang, "tabSubmitted"),
            icon: <FileText className="size-4" aria-hidden />,
            content: <MyCasesPanel />,
          },
          {
            value: "active",
            label: t(lang, "tabActive"),
            icon: <ListChecks className="size-4" aria-hidden />,
            content: <HistoryPanel scope="active" />,
          },
          {
            value: "completed",
            label: t(lang, "tabCompleted"),
            icon: <History className="size-4" aria-hidden />,
            content: <HistoryPanel scope="completed" />,
          },
        ]}
      />
    </AppShell>
  );
}
