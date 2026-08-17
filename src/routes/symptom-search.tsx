import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route — merged into /diagnostics. Kept so existing links keep working. */
export const Route = createFileRoute("/symptom-search")({
  beforeLoad: () => {
    throw redirect({ to: "/diagnostics", search: { tab: "symptoms" } });
  },
});
