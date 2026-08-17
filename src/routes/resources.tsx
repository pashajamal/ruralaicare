import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPin, Pill } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TabbedPage } from "@/components/TabbedPage";
import { HospitalsPanel } from "@/components/pages/HospitalsPanel";
import { MedicinesPanel } from "@/components/pages/MedicinesPanel";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";

const TABS = ["hospitals", "medicines"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/resources")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: TABS.includes(search["tab"] as Tab) ? (search["tab"] as Tab) : "hospitals",
  }),
  head: () => ({
    meta: [
      { title: "Resources | AI Virtual Clinic" },
      {
        name: "description",
        content: "Reference lookups for clinical staff: nearby referral hospitals and local medicine stock levels.",
      },
      { property: "og:title", content: "Resources | AI Virtual Clinic" },
      { property: "og:description", content: "Nearby hospitals and medicine inventory lookup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const { lang } = useLang();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <AppShell>
      <TabbedPage
        title={t(lang, "resources")}
        subtitle={t(lang, "resourcesSubtitle")}
        value={tab}
        onValueChange={(v) => void navigate({ to: "/resources", search: { tab: v as Tab } })}
        tabs={[
          {
            value: "hospitals",
            label: t(lang, "tabHospitals"),
            icon: <MapPin className="size-4" aria-hidden />,
            content: <HospitalsPanel />,
          },
          {
            value: "medicines",
            label: t(lang, "tabMedicines"),
            icon: <Pill className="size-4" aria-hidden />,
            content: <MedicinesPanel />,
          },
        ]}
      />
    </AppShell>
  );
}
