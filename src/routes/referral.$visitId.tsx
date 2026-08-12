import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/clinic";

export const Route = createFileRoute("/referral/$visitId")({
  head: () => ({
    meta: [
      { title: "Clinical Referral Summary | AI Virtual Clinic" },
      {
        name: "description",
        content: "Printable clinical referral summary with vitals, deterministic risk rules and the doctor's decision.",
      },
      { property: "og:title", content: "Clinical Referral Summary | AI Virtual Clinic" },
      { property: "og:description", content: "Hand this summary to the receiving facility." },
    ],
  }),
  component: ReferralPrintPage,
});

function ReferralPrintPage() {
  const { visitId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["referral-print", visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, patients(name, age, preferred_language, health_centre)")
        .eq("id", visitId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Loader2 className="m-8 size-5 animate-spin" aria-hidden />;
  if (!data) return <p className="p-8 text-sm">Referral not found.</p>;

  const patient = data.patients as { name?: string; age?: number; preferred_language?: string; health_centre?: string } | null;
  const vitals = (data.vitals ?? {}) as Record<string, unknown>;
  const rules = Array.isArray(data.triggering_rules) ? (data.triggering_rules as string[]) : [];

  return (
    <div className="mx-auto max-w-3xl bg-background p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print / Save PDF
        </Button>
      </div>

      <article className="rounded-2xl border border-border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-border pb-4">
          <h1 className="text-xl font-bold uppercase tracking-wide">Clinical Referral Summary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patient?.health_centre ?? "Rural Health Centre"} · Generated {formatDateTime(new Date().toISOString())}
          </p>
        </header>

        <Section title="Patient">
          <p>
            <b>{patient?.name}</b> · {patient?.age} yrs · Preferred language: {patient?.preferred_language}
          </p>
          <p className="text-sm text-muted-foreground">Visit recorded {formatDateTime(data.created_at)}</p>
        </Section>

        <Section title="Presenting complaint">
          <p className="whitespace-pre-wrap text-sm">{data.symptoms_text}</p>
          {data.duration ? <p className="mt-1 text-sm">Duration: {data.duration}</p> : null}
          {data.history_text ? <p className="mt-1 text-sm">History: {data.history_text}</p> : null}
        </Section>

        <Section title="Vitals">
          <p className="text-sm">
            Temp {String(vitals['temp'] ?? "—")} °C · BP {String(vitals['bp'] ?? "—")} · Pulse{" "}
            {String(vitals['pulse'] ?? "—")} bpm · SpO2 {String(vitals['spo2'] ?? "—")} %
          </p>
        </Section>

        <Section title={`Risk tier: ${data.risk_tier ?? "—"}`}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Calculated by deterministic clinical rules — not by AI
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Section>

        <Section title="AI preliminary note (advisory only)">
          <p className="whitespace-pre-wrap text-sm">{data.preliminary_assessment ?? "—"}</p>
        </Section>

        <Section title="Doctor decision">
          <p className="text-sm">
            <b className="capitalize">{data.doctor_decision ?? "Pending"}</b>
            {data.finalized_at ? ` · finalized ${formatDateTime(data.finalized_at)}` : ""}
          </p>
          {data.doctor_notes ? <p className="mt-1 whitespace-pre-wrap text-sm">{data.doctor_notes}</p> : null}
        </Section>

        <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
          This summary records an AI-assisted triage reviewed and signed off by a qualified doctor. AI output is
          advisory and is not a medical diagnosis.
          <div className="mt-10 flex justify-between">
            <span>Referring staff signature: ______________________</span>
            <span>Date: ____________</span>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-4 last:border-0">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
