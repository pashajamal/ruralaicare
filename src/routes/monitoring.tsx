import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, HeartPulse } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TabbedPage } from "@/components/TabbedPage";
import { FollowUpsPanel } from "@/components/pages/FollowUpsPanel";
import { TrackerPanel } from "@/components/pages/TrackerPanel";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";

const TABS = ["tracker", "followups"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/monitoring")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: TABS.includes(search["tab"] as Tab) ? (search["tab"] as Tab) : "tracker",
  }),
  head: () => ({
    meta: [
      { title: "Patient Monitoring | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Daily home-monitoring vitals logs with escalation checks, plus every scheduled patient follow-up in one place.",
      },
      { property: "og:title", content: "Patient Monitoring | AI Virtual Clinic" },
      { property: "og:description", content: "Daily tracker and follow-ups for patients under care plans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const { lang } = useLang();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <AppShell>
      <TabbedPage
        title={t(lang, "monitoring")}
        subtitle={t(lang, "monitoringSubtitle")}
        value={tab}
        onValueChange={(v) => void navigate({ to: "/monitoring", search: { tab: v as Tab } })}
        tabs={[
          {
            value: "tracker",
            label: t(lang, "tabTracker"),
            icon: <HeartPulse className="size-4" aria-hidden />,
            content: <TrackerPanel />,
          },
          {
            value: "followups",
            label: t(lang, "tabFollowups"),
            icon: <CalendarClock className="size-4" aria-hidden />,
            content: <FollowUpsPanel />,
          },
        ]}
      />
    </AppShell>
  );
}
