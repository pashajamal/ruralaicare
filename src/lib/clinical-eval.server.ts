import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const CHAT_MODEL = "google/gemini-2.5-flash";
const EMBED_MODEL = "google/gemini-embedding-001";
const RX_BUCKET = "prescription-images";

const SYMPTOM_SOURCES = ["symptom_disease_reference", "symptom_disease"];
const RX_SOURCE = "prescription_handwritten_ocr";

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Clinical AI is temporarily unavailable");
  return key;
}

export type EvalVitals = {
  temperature_c: number | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
};

export type TriageFlag = { level: "RED" | "YELLOW"; label: string };

/** Step A — deterministic vitals triage. Pure code, never an LLM call. */
export function triageVitals(v: EvalVitals): { tier: "RED" | "YELLOW" | "GREEN"; flags: TriageFlag[] } {
  const flags: TriageFlag[] = [];
  if (typeof v.spo2 === "number" && v.spo2 < 92)
    flags.push({ level: "RED", label: `SpO2 ${v.spo2}% — hypoxia (below 92%)` });
  if ((typeof v.systolic === "number" && v.systolic > 180) || (typeof v.diastolic === "number" && v.diastolic > 120))
    flags.push({ level: "RED", label: `BP ${v.systolic ?? "?"}/${v.diastolic ?? "?"} mmHg — hypertensive crisis` });
  if (typeof v.pulse === "number" && (v.pulse > 120 || v.pulse < 50))
    flags.push({ level: "YELLOW", label: `Pulse ${v.pulse} bpm — outside 50–120 bpm` });
  if (typeof v.temperature_c === "number" && v.temperature_c > 39.4)
    flags.push({ level: "YELLOW", label: `Temperature ${v.temperature_c} °C — high fever (above 39.4 °C / 103 °F)` });
  if (typeof v.respiratory_rate === "number" && (v.respiratory_rate > 24 || v.respiratory_rate < 10))
    flags.push({ level: "YELLOW", label: `Respiratory rate ${v.respiratory_rate}/min — outside 10–24/min` });

  const tier = flags.some((f) => f.level === "RED") ? "RED" : flags.length > 0 ? "YELLOW" : "GREEN";
  return { tier, flags };
}

async function embed(content: string): Promise<number[]> {
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: content, dimensions: 768, encoding_format: "float" }),
  });
  if (!res.ok) throw new Error(`Embedding failed (${res.status})`);
  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vec = json.data?.[0]?.embedding;
  if (!vec?.length) throw new Error("Embedding response was empty");
  return vec;
}

export type Match = {
  id: string;
  source_type: string;
  content: string;
  similarity: number;
};

async function matchKnowledge(vector: number[], sourceType: string, count: number): Promise<Match[]> {
  const { data, error } = await supabaseAdmin.rpc("match_knowledge_base", {
    query_embedding: JSON.stringify(vector) as never,
    match_count: count,
    filter_source_type: sourceType,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    source_type: r.source_type,
    content: r.content,
    similarity: Number(r.similarity ?? 0),
  }));
}

function diseaseFromContent(content: string): string | null {
  const m = content.match(/Disease:\s*([^.]+)\./i);
  return m?.[1]?.trim() ?? null;
}

export type EvalResult = Awaited<ReturnType<typeof runClinicalEvaluation>>;

export async function runClinicalEvaluation(args: {
  vitals: EvalVitals;
  symptoms: string;
  prescriptionId: string | null;
}) {
  // Step A — deterministic triage
  const triage = triageVitals(args.vitals);

  // Step B — vector search over knowledge_base
  const vitalsLine = [
    args.vitals.temperature_c != null ? `temperature ${args.vitals.temperature_c} C` : null,
    args.vitals.systolic != null ? `blood pressure ${args.vitals.systolic}/${args.vitals.diastolic ?? "?"} mmHg` : null,
    args.vitals.pulse != null ? `heart rate ${args.vitals.pulse} bpm` : null,
    args.vitals.spo2 != null ? `SpO2 ${args.vitals.spo2}%` : null,
    args.vitals.respiratory_rate != null ? `respiratory rate ${args.vitals.respiratory_rate}/min` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const queryText = `Patient symptoms: ${args.symptoms}. Vitals: ${vitalsLine || "not recorded"}.`;
  const vector = await embed(queryText);

  const symptomMatchGroups = await Promise.all(SYMPTOM_SOURCES.map((s) => matchKnowledge(vector, s, 5)));
  const symptomMatches = symptomMatchGroups
    .flat()
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
  const rxMatches = await matchKnowledge(vector, RX_SOURCE, 5);

  // Step C — cross-dataset symptom + drug validation
  const candidates = [...new Set(symptomMatches.map((m) => diseaseFromContent(m.content)).filter(Boolean))] as string[];
  const datasetRows: { disease_label: string; symptom_text: string }[] = [];
  for (const label of candidates.slice(0, 5)) {
    const { data } = await supabaseAdmin
      .from("staging_symptom_disease")
      .select("disease_label, symptom_text")
      .ilike("disease_label", label)
      .limit(3);
    datasetRows.push(...(data ?? []));
  }

  let prescription: {
    id: string;
    image_filename: string;
    patient_name: string | null;
    extracted_ocr_text: string | null;
    medication_details: string | null;
    image_url: string | null;
  } | null = null;

  if (args.prescriptionId) {
    const { data } = await supabaseAdmin
      .from("staging_prescription_images")
      .select("id, image_filename, patient_name, extracted_ocr_text, medication_details")
      .eq("id", args.prescriptionId)
      .maybeSingle();
    if (data) {
      const { data: signed } = await supabaseAdmin.storage
        .from(RX_BUCKET)
        .createSignedUrl(data.image_filename, 60 * 30);
      prescription = { ...data, image_url: signed?.signedUrl ?? null };
    }
  }

  // Step D — Gemini clinical analysis with grounded context
  const context = {
    triage,
    patient_symptoms: args.symptoms,
    vitals: args.vitals,
    knowledge_base_symptom_matches: symptomMatches.map((m) => ({
      id: m.id,
      source_type: m.source_type,
      similarity: Number(m.similarity.toFixed(4)),
      content: m.content.slice(0, 1600),
    })),
    knowledge_base_prescription_matches: rxMatches.map((m) => ({
      id: m.id,
      source_type: m.source_type,
      similarity: Number(m.similarity.toFixed(4)),
      content: m.content.slice(0, 1200),
    })),
    staging_symptom_disease_rows: datasetRows.slice(0, 15),
    selected_prescription: prescription
      ? {
          image_filename: prescription.image_filename,
          ocr_text: prescription.extracted_ocr_text,
          medication_details: prescription.medication_details,
        }
      : null,
  };

  const system = `You are an expert clinical decision support assistant. Using ONLY the provided context from knowledge_base and staging_symptom_disease, generate:
1. Primary Suspected Condition(s) with an accuracy confidence score (0-100%).
2. Differential Diagnoses ranked by likelihood with evidence from the dataset.
3. Medication & OCR Insights: Verify if current prescriptions align with suspected conditions or if symptoms match drug side-effects.
4. Recommended Clinical Next Steps & Diagnostic Tests.
Do not invent ungrounded medical facts. Explicitly cite source rows from knowledge_base by their id. If the context does not support a claim, say so.
Respond with JSON only using this shape:
{"primary":[{"condition":string,"confidence":number,"rationale":string,"source_ids":string[]}],
 "differentials":[{"condition":string,"likelihood":number,"matching_symptoms":string[],"precautions":string[],"source_ids":string[]}],
 "medication_insights":{"summary":string,"alignment":string,"side_effect_alerts":string[],"source_ids":string[]},
 "next_steps":string[],"diagnostic_tests":string[],"limitations":string}`;

  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `CONTEXT:\n${JSON.stringify(context)}` },
      ],
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`Clinical analysis failed (${res.status})`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (json.choices?.[0]?.message?.content ?? "{}")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  type Analysis = {
    primary: { condition: string; confidence: number; rationale: string; source_ids: string[] }[];
    differentials: {
      condition: string;
      likelihood: number;
      matching_symptoms: string[];
      precautions: string[];
      source_ids: string[];
    }[];
    medication_insights: {
      summary: string;
      alignment: string;
      side_effect_alerts: string[];
      source_ids: string[];
    };
    next_steps: string[];
    diagnostic_tests: string[];
    limitations: string;
  };

  let analysis: Analysis;
  try {
    const parsed = JSON.parse(raw) as Partial<Analysis>;
    analysis = {
      primary: parsed.primary ?? [],
      differentials: parsed.differentials ?? [],
      medication_insights:
        parsed.medication_insights ?? { summary: "", alignment: "", side_effect_alerts: [], source_ids: [] },
      next_steps: parsed.next_steps ?? [],
      diagnostic_tests: parsed.diagnostic_tests ?? [],
      limitations: parsed.limitations ?? "",
    };
  } catch {
    throw new Error("The clinical analysis response could not be read. Please retry.");
  }

  return {
    triage,
    query_text: queryText,
    matches: { symptoms: symptomMatches, prescriptions: rxMatches },
    dataset_rows: datasetRows.slice(0, 15),
    prescription,
    analysis,
  };
}

export async function loadEvalDatasets() {
  const [vitals, rx, labels] = await Promise.all([
    supabaseAdmin
      .from("staging_vitals")
      .select("id, patient_ref, temperature_c, systolic, diastolic, pulse, spo2, respiratory_rate, note")
      .order("created_at", { ascending: true })
      .limit(50),
    supabaseAdmin
      .from("staging_prescription_images")
      .select("id, image_filename, patient_name, extracted_ocr_text, medication_details, processed")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin.from("staging_symptom_disease").select("disease_label").limit(2000),
  ]);

  const diseases = [...new Set((labels.data ?? []).map((r) => r.disease_label))].sort().slice(0, 300);
  return {
    vitals: vitals.data ?? [],
    prescriptions: rx.data ?? [],
    diseases,
  };
}

export async function searchSymptomDataset(query: string) {
  const { data } = await supabaseAdmin
    .from("staging_symptom_disease")
    .select("id, symptom_text, disease_label")
    .or(`symptom_text.ilike.%${query.replace(/[%,]/g, " ")}%,disease_label.ilike.%${query.replace(/[%,]/g, " ")}%`)
    .limit(12);
  return data ?? [];
}

export async function signPrescription(filename: string) {
  const { data } = await supabaseAdmin.storage.from(RX_BUCKET).createSignedUrl(filename, 60 * 30);
  return data?.signedUrl ?? null;
}
