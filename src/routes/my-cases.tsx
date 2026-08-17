import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route — merged into /cases. Kept so existing links keep working. */
export const Route = createFileRoute("/my-cases")({
  beforeLoad: () => {
    throw redirect({ to: "/cases", search: { tab: "submitted" } });
  },
});
