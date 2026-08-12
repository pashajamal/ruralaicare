import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchDrugSafety, suggestionGuardrail, type StructuredSummary } from "./triage.server";
import type { ChronicCondition, PregnancyStatus } from "./conditions";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBED_MODEL = "google/gemini-embedding-001";
const DRUG_SOURCE = "drug_safety";
/** Below this cosine similarity we refuse to suggest anything rather than guess. */
const MIN_SIMILARITY = 0.75;

/** Conditions that always require a clinician, no matter what tier the deterministic score gave. */
const ESCALATION_CONDITIONS = [
  "dengue",
  "malaria",
  "pneumonia",
  "typhoid",
  "jaundice",
  "hepatitis",
  "diabet",
  "tuberculosis",
  " tb ",
  "meningitis",
  "sepsis",
  "stroke",
  "cancer",
  "heart attack",
  "myocardial",
];

const PRESCRIPTION_ONLY_HINTS = [
  "prescription only",
  "prescription-only",
  "rx only",
  "refer to doctor",
  "consult a doctor",
  "doctor supervision",
  "schedule h",
];

export type SuggestedMedicine = {
  name: string;
  detail?: string | undefined;
  informational: boolean;
  reason?: string | undefined;
};

export type MedicineSuggestion = {
  status: "suggested" | "no_match" | "escalate" | "withheld" | "unavailable";
  message: string;
  condition?: string | undefined;
  medicines: SuggestedMedicine[];
  reference?: { id: string; content: string; similarity: number } | undefined;
  /** Human-readable note for the explainability panel. */
  override_reason?: string | undefined;
};

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Medicine retrieval is temporarily unavailable");
  return key;
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

function medicinesFromRow(content: string, metadata: Record<string, unknown>): SuggestedMedicine[] {
  const raw = metadata["medicines"] ?? metadata["medicine"] ?? metadata["medicine_name"];
  let names: string[] = [];
  if (Array.isArray(raw)) names = raw.map((m) => String(m));
  else if (typeof raw === "string") names = raw.split(/[,;/|]/);
  if (names.length === 0) {
    const m = content.match(/Medicines?:\s*([^.]+)\./i);
    if (m?.[1]) names = m[1].split(/[,;/|]/);
  }
  const detail = [metadata["composition"], metadata["uses"]].filter(Boolean).map(String).join(" · ") || undefined;
  return names
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((name) => ({ name, detail, informational: false }));
}

function conditionFrom(content: string, metadata: Record<string, unknown>): string | undefined {
  const meta = metadata["disease"] ?? metadata["condition"] ?? metadata["condition_name"];
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  const m = content.match(/(?:Disease|Condition):\s*([^.]+)\./i);
  return m?.[1]?.trim();
}

/**
 * Retrieval-only medicine suggestion. Never generative: everything shown comes
 * straight from the knowledge_base row that matched. Callers must only invoke
 * this for GREEN-tier visits — RED/YELLOW are gated before we get here.
 */
export async function suggestMedicines(args: {
  structured: StructuredSummary;
  symptomsText: string;
  assessment: string | null;
  conditions: { chronic: ChronicCondition[]; pregnancy: PregnancyStatus | null };
}): Promise<MedicineSuggestion> {
  const query = [
    args.structured.symptoms?.join(", ") || args.symptomsText,
    args.assessment ?? "",
  ]
    .filter(Boolean)
    .join(". ")
    .slice(0, 2000);

  let rows: Array<{ id: string; content: string; similarity: number; metadata: Record<string, unknown> }> = [];
  try {
    const vector = await embed(`Condition and symptoms: ${query}`);
    const { data, error } = await supabaseAdmin.rpc("match_knowledge_base", {
      query_embedding: JSON.stringify(vector) as never,
      match_count: 1,
      filter_source_type: DRUG_SOURCE,
    });
    if (error) throw new Error(error.message);
    rows = (data ?? []).map((r) => ({
      id: r.id as string,
      content: r.content as string,
      similarity: Number(r.similarity ?? 0),
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
    }));
  } catch (error) {
    console.error("medicine retrieval failed", error);
    return {
      status: "unavailable",
      message: "Medicine reference lookup is unavailable — refer to doctor for medicine guidance.",
      medicines: [],
    };
  }

  const top = rows[0];
  if (!top || top.similarity < MIN_SIMILARITY) {
    return {
      status: "no_match",
      message: "No confident match found — refer to doctor for medicine guidance.",
      medicines: [],
      override_reason: top
        ? `Best reference-database match scored ${(top.similarity * 100).toFixed(0)}% (below the ${(MIN_SIMILARITY * 100).toFixed(0)}% confidence threshold).`
        : "No entry in the reference medicine database matched this presentation.",
    };
  }

  const reference = { id: top.id, content: top.content.slice(0, 600), similarity: top.similarity };
  const condition = conditionFrom(top.content, top.metadata);
  const haystack = `${condition ?? ""} ${top.content} ${JSON.stringify(top.metadata)}`.toLowerCase();

  const escalation = ESCALATION_CONDITIONS.find((c) => haystack.includes(c));
  const flaggedRefer =
    top.metadata["refer_to_doctor"] === true || /refer to doctor|requires? (?:professional|medical) evaluation/.test(haystack);
  if (escalation || flaggedRefer) {
    const label = condition ?? escalation ?? "this condition";
    return {
      status: "escalate",
      message: "This condition requires professional evaluation — please consult a doctor",
      condition,
      medicines: [],
      reference,
      override_reason: `Medicine suggestion withheld — reference data flags ${label} as requiring professional evaluation.`,
    };
  }

  const items = medicinesFromRow(top.content, top.metadata);
  if (items.length === 0) {
    return {
      status: "no_match",
      message: "No confident match found — refer to doctor for medicine guidance.",
      medicines: [],
      reference,
      override_reason: "The matched reference entry did not list any medicine that can be acted on.",
    };
  }

  // Prescription-only / refer-to-doctor items are informational, never actionable.
  const prescriptionOnly = PRESCRIPTION_ONLY_HINTS.some((h) => haystack.includes(h));
  for (const item of items) {
    const itemText = `${item.name} ${item.detail ?? ""}`.toLowerCase();
    if (prescriptionOnly || PRESCRIPTION_ONLY_HINTS.some((h) => itemText.includes(h))) {
      item.informational = true;
      item.reason = "Flagged in the reference data as prescription-only / doctor-directed.";
    }
    // Condition guardrails (chronic illness, pregnancy) can only downgrade to informational.
    const caution = suggestionGuardrail(`${item.name} ${item.detail ?? ""}`, args.conditions);
    if (caution) {
      item.informational = true;
      item.reason = caution;
    }
  }

  // OpenFDA drug-safety check still runs on the first actionable medicine before it is shown.
  const actionable = items.find((i) => !i.informational);
  if (actionable) {
    const safety = await fetchDrugSafety(actionable.name);
    const label = [safety?.contraindications, safety?.warnings].filter(Boolean).join(" ");
    if (label) {
      const caution = suggestionGuardrail(label, args.conditions);
      if (caution) {
        actionable.informational = true;
        actionable.reason = caution;
      }
    }
  }

  if (items.every((i) => i.informational)) {
    return {
      status: "withheld",
      message: "Suggestions withheld — these medicines need a doctor's direction for this patient.",
      condition,
      medicines: items,
      reference,
      override_reason: items[0]?.reason ?? "All retrieved medicines are informational only.",
    };
  }

  return {
    status: "suggested",
    message: "Suggested (from reference database) — Pending Doctor Approval",
    condition,
    medicines: items,
    reference,
  };
}
