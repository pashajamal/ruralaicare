import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | AI Virtual Clinic" },
      { name: "description", content: "Clinic safety rules, protocol library and triage pipeline configuration." },
      { property: "og:title", content: "Settings | AI Virtual Clinic" },
      { property: "og:description", content: "Clinic safety rules, protocol library and triage pipeline configuration." },
    ],
  }),
  component: SettingsPage,
});

const RULES = [
  "SpO2 below 92% → RED",
  "Temperature above 39.5°C with age over 60 → RED",
  "Chest pain or difficulty breathing reported → RED",
  "Pulse above 130 or below 45 bpm → RED",
  "Symptoms persisting more than 3 days, or moderate-severity indicators → YELLOW",
  "Otherwise → GREEN",
];

function SettingsPage() {
  const { data } = useQuery({
    queryKey: ["protocols"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("first_aid_protocols")
        .select("id, condition_name, otc_medicine, protocol_text")
        .order("condition_name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Safety configuration for the triage pipeline. Rules are deterministic and run in code.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Risk-scoring rules</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {RULES.map((rule) => (
              <li key={rule} className="rounded-lg bg-secondary px-3 py-2">
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            First-aid protocol library
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Protocols are returned verbatim from this library. The AI never writes first-aid steps.
          </p>
          <div className="mt-4 space-y-3">
            {(data ?? []).map((protocol) => (
              <details key={protocol.id} className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {protocol.condition_name}
                  {protocol.otc_medicine ? (
                    <span className="ml-2 text-xs text-muted-foreground">OTC: {protocol.otc_medicine}</span>
                  ) : null}
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{protocol.protocol_text}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Structuring — extracts structured JSON and a same-language confirmation</li>
            <li>Reasoning — cautious preliminary assessment, no tiering</li>
            <li>Risk scoring — deterministic code rules only</li>
            <li>Protocol lookup — GREEN only, verbatim from the library</li>
            <li>Drug safety — GREEN only, live OpenFDA label lookup</li>
            <li>Hard stop — RED skips protocol and drug steps entirely</li>
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
