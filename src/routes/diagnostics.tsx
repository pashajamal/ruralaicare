import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FlaskConical, SearchCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TabbedPage } from "@/components/TabbedPage";
import { ClinicalEvalPanel } from "@/components/pages/ClinicalEvalPanel";
import { SymptomSearchPanel } from "@/components/pages/SymptomSearchPanel";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";

const TABS = ["evaluation", "symptoms"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/diagnostics")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: TABS.includes(search["tab"] as Tab) ? (search["tab"] as Tab) : "evaluation",
  }),
  head: () => ({
    meta: [
      { title: "Diagnostics | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Run the grounded clinical evaluation engine and search the symptom-disease dataset from a single diagnostics workspace.",
      },
      { property: "og:title", content: "Diagnostics | AI Virtual Clinic" },
      { property: "og:description", content: "Clinical evaluation and symptom dataset search in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  const { lang } = useLang();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <AppShell>
      <TabbedPage
        title={t(lang, "diagnostics")}
        subtitle={t(lang, "diagnosticsSubtitle")}
        value={tab}
        onValueChange={(v) => void navigate({ to: "/diagnostics", search: { tab: v as Tab } })}
        tabs={[
          {
            value: "evaluation",
            label: t(lang, "tabClinicalEval"),
            icon: <FlaskConical className="size-4" aria-hidden />,
            content: <ClinicalEvalPanel />,
          },
          {
            value: "symptoms",
            label: t(lang, "tabSymptomSearch"),
            icon: <SearchCheck className="size-4" aria-hidden />,
            content: <SymptomSearchPanel />,
          },
        ]}
      />
    </AppShell>
  );
}
