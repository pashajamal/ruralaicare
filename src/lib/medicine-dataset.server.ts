import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
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

export async function embedMedicineDatasetBatch(limit = 50) {
  const { data: rows, error } = await supabaseAdmin
    .from("staging_medicines")
    .select("id, medicine_name, composition, uses, side_effects")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!rows?.length) return { processed: 0, failed: 0, remaining: 0, errors: [] as string[] };

  const errors: string[] = [];
  const done: string[] = [];
  const inserts: { source_type: string; content: string; metadata: unknown; embedding: unknown }[] = [];

  for (const row of rows) {
    const content = [
      `Medicine: ${row.medicine_name}.`,
      row.composition ? `Composition: ${row.composition}.` : "",
      row.uses ? `Uses: ${row.uses}.` : "",
      row.side_effects ? `Side effects: ${row.side_effects}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    try {
      const embedding = await embed(content);
      inserts.push({
        source_type: "drug_safety",
        content,
        metadata: {
          medicine: row.medicine_name,
          composition: row.composition,
          uses: row.uses,
          side_effects: row.side_effects,
        },
        embedding: JSON.stringify(embedding),
      });
      done.push(row.id);
    } catch (err) {
      errors.push(`${row.medicine_name}: ${err instanceof Error ? err.message : "embedding failed"}`);
    }
  }

  if (inserts.length) {
    const { error: kbErr } = await supabaseAdmin.from("knowledge_base").insert(inserts as never);
    if (kbErr) throw new Error(kbErr.message);
    const { error: upErr } = await supabaseAdmin.from("staging_medicines").update({ processed: true }).in("id", done);
    if (upErr) throw new Error(upErr.message);
  }

  const { count } = await supabaseAdmin
    .from("staging_medicines")
    .select("id", { count: "exact", head: true })
    .eq("processed", false);

  return { processed: inserts.length, failed: errors.length, remaining: count ?? 0, errors };
}
