import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EMBED_MODEL = "google/gemini-embedding-001";
const SYMPTOM_SOURCES = ["symptom_disease_reference", "symptom_disease"];

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Symptom search is temporarily unavailable");
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

function diseaseFromContent(content: string): string | null {
  const m = content.match(/Disease:\s*([^.]+)\./i);
  return m?.[1]?.trim() ?? null;
}

function symptomsFromContent(content: string): string {
  const m = content.match(/Symptoms?:\s*([\s\S]+)$/i);
  return (m?.[1] ?? content).trim();
}

export type DiseaseMatch = {
  id: string;
  disease: string;
  similarity: number;
  source_type: string;
  matched_text: string;
  examples: string[];
};

export async function searchSymptomKnowledge(query: string, limit = 8): Promise<DiseaseMatch[]> {
  const vector = await embed(`Symptoms: ${query}`);
  const embeddingArg = JSON.stringify(vector) as never;

  const groups = await Promise.all(
    SYMPTOM_SOURCES.map(async (source) => {
      const { data, error } = await supabaseAdmin.rpc("match_knowledge_base", {
        query_embedding: embeddingArg,
        match_count: limit,
        filter_source_type: source,
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

  const rows = groups
    .flat()
    .map((r) => ({
      id: r.id as string,
      source_type: r.source_type as string,
      content: r.content as string,
      similarity: Number(r.similarity ?? 0),
      metadata: (r.metadata ?? {}) as { disease?: string },
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const seen = new Set<string>();
  const results: DiseaseMatch[] = [];
  for (const row of rows) {
    const disease = row.metadata?.disease ?? diseaseFromContent(row.content) ?? "Unlabelled entry";
    const key = disease.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      id: row.id,
      disease,
      similarity: row.similarity,
      source_type: row.source_type,
      matched_text: symptomsFromContent(row.content),
      examples: [],
    });
    if (results.length >= limit) break;
  }

  // Retrieved symptom examples straight from the staged reference dataset.
  await Promise.all(
    results.map(async (r) => {
      const { data } = await supabaseAdmin
        .from("staging_symptom_disease")
        .select("symptom_text")
        .ilike("disease_label", r.disease)
        .limit(3);
      r.examples = (data ?? []).map((d) => d.symptom_text).filter(Boolean);
    }),
  );

  return results;
}
