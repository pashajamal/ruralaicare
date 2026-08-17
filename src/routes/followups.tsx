import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route — merged into /monitoring. Kept so existing links keep working. */
export const Route = createFileRoute("/followups")({
  beforeLoad: () => {
    throw redirect({ to: "/monitoring", search: { tab: "followups" } });
  },
});
