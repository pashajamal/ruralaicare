import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Activity, FlaskConical, Loader2, Pill, Sparkles, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RiskPill, type Tier } from "@/components/risk";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  loadEvalDatasetsFn,
  runClinicalEvalFn,
  searchSymptomsFn,
} from "@/lib/clinical-eval.functions";

export const Route = createFileRoute("/clinical-eval")({
  head: () => ({
    meta: [
      { title: "Clinical Evaluation Engine | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Fuse vitals triage, symptom-disease datasets, prescription OCR and vector search into a grounded clinical decision support report.",
      },
      { property: "og:title", content: "Clinical Evaluation Engine | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "Deterministic vitals triage plus dataset-grounded differential diagnosis for rural clinics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicalEvalPage,
});

type VitalsForm = {
  temperature_c: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  spo2: string;
  respiratory_rate: string;
};

const EMPTY: VitalsForm = {
  temperature_c: "",
  systolic: "",
  diastolic: "",
  pulse: "",
  spo2: "",
  respiratory_rate: "",
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  );
}

function ClinicalEvalPage() {
  const loadDatasets = useServerFn(loadEvalDatasetsFn);
  const searchSymptoms = useServerFn(searchSymptomsFn);
  const runEval = useServerFn(runClinicalEvalFn);

  const [vitals, setVitals] = useState<VitalsForm>(EMPTY);
  const [symptoms, setSymptoms] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [rxId, setRxId] = useState<string>("");

  const datasets = useQuery({ queryKey: ["eval-datasets"], queryFn: () => loadDatasets() });

  const suggestions = useQuery({
    queryKey: ["symptom-search", search],
    queryFn: () => searchSymptoms({ data: { query: search } }),
    enabled: search.trim().length >= 2,
  });

  const rx = useMemo(
    () => (datasets.data?.prescriptions ?? []).find((p) => p.id === rxId) ?? null,
    [datasets.data, rxId],
  );

  const analysis = useMutation({
    mutationFn: () =>
      runEval({
        data: {
          vitals: {
            temperature_c: num(vitals.temperature_c),
            systolic: num(vitals.systolic),
            diastolic: num(vitals.diastolic),
            pulse: num(vitals.pulse),
            spo2: num(vitals.spo2),
            respiratory_rate: num(vitals.respiratory_rate),
          },
          symptoms: [symptoms, ...selected].filter(Boolean).join(". "),
          prescription_id: rxId || null,
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const result = analysis.data;
  const tier = (result?.triage.tier ?? null) as Tier | null;

  const fields: { key: keyof VitalsForm; label: string; step?: string }[] = [
    { key: "temperature_c", label: "Temperature (°C)", step: "0.1" },
    { key: "systolic", label: "Systolic BP" },
    { key: "diastolic", label: "Diastolic BP" },
    { key: "pulse", label: "Pulse (bpm)" },
    { key: "spo2", label: "SpO2 (%)" },
    { key: "respiratory_rate", label: "Resp. rate (/min)" },
  ];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Clinical Evaluation Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deterministic vitals triage, dataset vector search and grounded AI analysis — decision support only, never a
            final diagnosis.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Vitals" icon={Activity}>
            <div className="mb-4">
              <Label className="text-xs">Load from staging vitals</Label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const row = (datasets.data?.vitals ?? []).find((v) => v.id === e.target.value);
                  if (!row) return;
                  setVitals({
                    temperature_c: row.temperature_c?.toString() ?? "",
                    systolic: row.systolic?.toString() ?? "",
                    diastolic: row.diastolic?.toString() ?? "",
                    pulse: row.pulse?.toString() ?? "",
                    spo2: row.spo2?.toString() ?? "",
                    respiratory_rate: row.respiratory_rate?.toString() ?? "",
                  });
                }}
              >
                <option value="">Manual entry</option>
                {(datasets.data?.vitals ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patient_ref}
                    {v.note ? ` — ${v.note}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs" htmlFor={f.key}>
                    {f.label}
                  </Label>
                  <Input
                    id={f.key}
                    inputMode="decimal"
                    step={f.step}
                    type="number"
                    value={vitals[f.key]}
                    onChange={(e) => setVitals((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Symptoms" icon={Stethoscope}>
            <Label className="text-xs" htmlFor="symptoms">
              Describe the presentation
            </Label>
            <Textarea
              id="symptoms"
              className="mt-1 min-h-28"
              placeholder="e.g. Breathless since two days, dry cough, chest tightness at night"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />
            <Label className="mt-4 block text-xs" htmlFor="symptom-search">
              Search the symptom–disease dataset
            </Label>
            <Input
              id="symptom-search"
              className="mt-1"
              placeholder="Search symptoms or conditions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {suggestions.data?.length ? (
              <ul className="mt-2 max-h-44 space-y-1 overflow-auto rounded-lg border border-border p-2">
                {suggestions.data.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                      onClick={() =>
                        setSelected((p) => (p.includes(s.symptom_text) ? p : [...p, s.symptom_text]))
                      }
                    >
                      <span className="font-medium">{s.disease_label}</span> — {s.symptom_text.slice(0, 120)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                    onClick={() => setSelected((p) => p.filter((x) => x !== s))}
                  >
                    {s.slice(0, 60)} ×
                  </button>
                ))}
              </div>
            ) : null}
          </Section>
        </div>

        <Section title="Prescription record" icon={Pill}>
          <select
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={rxId}
            onChange={(e) => setRxId(e.target.value)}
          >
            <option value="">No prescription selected</option>
            {(datasets.data?.prescriptions ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.image_filename}
                {p.patient_name ? ` — ${p.patient_name}` : ""}
                {p.processed ? "" : " (not yet transcribed)"}
              </option>
            ))}
          </select>
          {rx ? (
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {rx.extracted_ocr_text || rx.medication_details || "No OCR text extracted for this record yet."}
            </p>
          ) : null}
          {!datasets.isLoading && (datasets.data?.prescriptions ?? []).length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No prescription images staged yet — upload and transcribe them on the Prescription OCR page.
            </p>
          ) : null}
        </Section>

        <Button
          size="lg"
          className="w-full"
          disabled={analysis.isPending || (symptoms.trim().length < 3 && selected.length === 0)}
          onClick={() => analysis.mutate()}
        >
          {analysis.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
          Run clinical fusion analysis
        </Button>

        {result ? (
          <div className="space-y-5">
            <div
              className={`rounded-2xl border p-5 ${
                tier === "RED"
                  ? "border-risk-red/40 bg-risk-red-soft"
                  : tier === "YELLOW"
                    ? "border-risk-amber/40 bg-risk-amber-soft"
                    : "border-risk-green/40 bg-risk-green-soft"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <RiskPill tier={tier} withLabel />
                <span className="text-sm font-medium">Deterministic vitals triage</span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.triage.flags.length === 0 ? (
                  <li className="rounded-full border border-border bg-card px-2.5 py-1 text-xs">
                    No vital sign thresholds crossed
                  </li>
                ) : (
                  result.triage.flags.map((f) => (
                    <li
                      key={f.label}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        f.level === "RED"
                          ? "border-risk-red/40 bg-card text-risk-red"
                          : "border-risk-amber/40 bg-card text-risk-amber"
                      }`}
                    >
                      {f.label}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {result.analysis.primary.length ? (
              <Section title="Primary suspected conditions" icon={Sparkles}>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.analysis.primary.map((p) => (
                    <div key={p.condition} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold">{p.condition}</h3>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                          {Math.round(p.confidence)}%
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{p.rationale}</p>
                      {p.source_ids?.length ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">Sources: {p.source_ids.join(", ")}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {result.analysis.differentials.length ? (
              <Section title="Differential diagnoses" icon={Stethoscope}>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.analysis.differentials.map((d) => (
                    <div key={d.condition} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold">{d.condition}</h3>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {Math.round(d.likelihood)}% likelihood
                        </span>
                      </div>
                      {d.matching_symptoms?.length ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Matching: {d.matching_symptoms.join(", ")}
                        </p>
                      ) : null}
                      {d.precautions?.length ? (
                        <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                          {d.precautions.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      ) : null}
                      {d.source_ids?.length ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">Sources: {d.source_ids.join(", ")}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section title="Prescription & OCR insights" icon={Pill}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  {result.prescription?.image_url ? (
                    <img
                      src={result.prescription.image_url}
                      alt={`Prescription ${result.prescription.image_filename}`}
                      className="w-full rounded-lg object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No prescription image selected.</p>
                  )}
                  {result.prescription?.extracted_ocr_text ? (
                    <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      {result.prescription.extracted_ocr_text}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm">{result.analysis.medication_insights.summary || "No medication context."}</p>
                  {result.analysis.medication_insights.alignment ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {result.analysis.medication_insights.alignment}
                    </p>
                  ) : null}
                  {result.analysis.medication_insights.side_effect_alerts?.length ? (
                    <ul className="mt-3 space-y-1">
                      {result.analysis.medication_insights.side_effect_alerts.map((a) => (
                        <li
                          key={a}
                          className="rounded-lg border border-risk-amber/40 bg-risk-amber-soft px-3 py-2 text-xs text-risk-amber"
                        >
                          {a}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </Section>

            <Section title="Next steps & diagnostic tests" icon={FlaskConical}>
              <div className="grid gap-4 md:grid-cols-2">
                <ul className="list-decimal space-y-1 pl-5 text-sm">
                  {result.analysis.next_steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {result.analysis.diagnostic_tests.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              {result.analysis.limitations ? (
                <p className="mt-4 text-xs text-muted-foreground">{result.analysis.limitations}</p>
              ) : null}
            </Section>

            <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-5">
              <AccordionItem value="grounding" className="border-0">
                <AccordionTrigger className="text-sm font-semibold">
                  Grounding &amp; evidence — knowledge_base source rows
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2 text-xs text-muted-foreground">Query: {result.query_text}</p>
                  <ul className="space-y-2">
                    {[...result.matches.symptoms, ...result.matches.prescriptions].map((m) => (
                      <li key={m.id} className="rounded-lg border border-border p-3 text-xs">
                        <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                          <span>{m.id}</span>
                          <span>
                            {m.source_type} · similarity {(m.similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{m.content.slice(0, 400)}…</p>
                      </li>
                    ))}
                  </ul>
                  {result.dataset_rows.length ? (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold">staging_symptom_disease rows used</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {result.dataset_rows.map((r, i) => (
                          <li key={`${r.disease_label}-${i}`}>
                            <span className="font-medium text-foreground">{r.disease_label}</span> — {r.symptom_text.slice(0, 160)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
