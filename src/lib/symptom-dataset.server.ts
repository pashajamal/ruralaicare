import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Lovable AI Gateway equivalent of text-embedding-004, at the 768 dims our vector column uses.
const EMBED_MODEL = "google/gemini-embedding-001";

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI embedding is temporarily unavailable");
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

export async function embedSymptomDatasetBatch(limit = 50) {
  const { data: rows, error } = await supabaseAdmin
    .from("staging_symptom_disease")
    .select("id, disease_label, symptom_text")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!rows?.length) return { processed: 0, failed: 0, remaining: 0, errors: [] as string[] };

  const errors: string[] = [];
  const done: string[] = [];
  const inserts: { source_type: string; content: string; metadata: unknown; embedding: unknown }[] = [];

  for (const row of rows) {
    const content = `Disease: ${row.disease_label}. Symptoms: ${row.symptom_text}.`;
    try {
      const embedding = await embed(content);
      inserts.push({
        source_type: "symptom_disease_reference",
        content,
        metadata: { disease: row.disease_label },
        embedding: JSON.stringify(embedding),
      });
      done.push(row.id);
    } catch (err) {
      errors.push(`${row.disease_label}: ${err instanceof Error ? err.message : "embedding failed"}`);
    }
  }

  if (inserts.length) {
    const { error: kbErr } = await supabaseAdmin.from("knowledge_base").insert(inserts as never);
    if (kbErr) throw new Error(kbErr.message);
    const { error: upErr } = await supabaseAdmin
      .from("staging_symptom_disease")
      .update({ processed: true })
      .in("id", done);
    if (upErr) throw new Error(upErr.message);
  }

  const { count } = await supabaseAdmin
    .from("staging_symptom_disease")
    .select("id", { count: "exact", head: true })
    .eq("processed", false);

  return { processed: inserts.length, failed: errors.length, remaining: count ?? 0, errors };
}
