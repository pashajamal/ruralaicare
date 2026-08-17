import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route — merged into /resources. Kept so existing links keep working. */
export const Route = createFileRoute("/hospitals")({
  beforeLoad: () => {
    throw redirect({ to: "/resources", search: { tab: "hospitals" } });
  },
});
