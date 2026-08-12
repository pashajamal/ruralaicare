import { geminiFetch } from "./gemini.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VISION_MODEL = "google/gemini-2.5-flash";
const EMBED_MODEL = "google/gemini-embedding-001";
const BUCKET = "prescription-images";

const OCR_PROMPT = `You are an expert medical transcriptionist. Analyze this prescription image or handwritten doctor's note.
1. Transcribe all visible text verbatim, paying special attention to cursive/handwritten medical shorthand, drug names, dosage (e.g., mg, ml), frequency (e.g., BID, TID, QD), and duration.
2. Format the response as structured JSON containing:
   - doctor_name: string or null
   - patient_name: string or null
   - medications: array of { drug_name, dosage, frequency, instructions }
   - raw_ocr_text: full verbatim text transcription
If handwriting is partially illegible, note '[illegible]' for uncertain words rather than guessing.
Respond with JSON only.`;

export type StructuredRx = {
  doctor_name: string | null;
  patient_name: string | null;
  medications: { drug_name?: string; dosage?: string; frequency?: string; instructions?: string }[];
  raw_ocr_text: string;
};

function mimeFor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function uploadPrescriptionImage(filename: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filename, bytes, { contentType: mimeFor(filename), upsert: true });
  if (error) throw new Error(error.message);

  const { data: existing } = await supabaseAdmin
    .from("staging_prescription_images")
    .select("id")
    .eq("image_filename", filename)
    .maybeSingle();
  if (!existing) {
    const { error: insErr } = await supabaseAdmin
      .from("staging_prescription_images")
      .insert({ image_filename: filename });
    if (insErr) throw new Error(insErr.message);
  }
  return { filename };
}

async function transcribe(filename: string): Promise<StructuredRx> {
  const { data: file, error } = await supabaseAdmin.storage.from(BUCKET).download(filename);
  if (error || !file) throw new Error(`Image not found in storage: ${filename}`);
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  const dataUrl = `data:${mimeFor(filename)};base64,${btoa(binary)}`;

  const res = await geminiFetch("/chat/completions", {
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });
  if (!res.ok) throw new Error(`Vision extraction failed (${res.status})`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "{}";
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<StructuredRx>;
  return {
    doctor_name: parsed.doctor_name ?? null,
    patient_name: parsed.patient_name ?? null,
    medications: Array.isArray(parsed.medications) ? parsed.medications : [],
    raw_ocr_text: parsed.raw_ocr_text ?? "",
  };
}

async function embed(content: string): Promise<number[]> {
  const res = await geminiFetch("/embeddings", { model: EMBED_MODEL, input: content, dimensions: 768, encoding_format: "float" });
  if (!res.ok) throw new Error(`Embedding failed (${res.status})`);
  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vec = json.data?.[0]?.embedding;
  if (!vec?.length) throw new Error("Embedding response was empty");
  return vec;
}

export async function processPrescriptionBatch(limit = 10) {
  const { data: rows, error } = await supabaseAdmin
    .from("staging_prescription_images")
    .select("id, image_filename, patient_name")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!rows?.length) return { processed: 0, failed: 0, remaining: 0, errors: [] as string[] };

  let processed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const structured = await transcribe(row.image_filename);
      const medsSummary =
        structured.medications
          .map((m) =>
            [m.drug_name, m.dosage, m.frequency, m.instructions].filter(Boolean).join(" "),
          )
          .filter(Boolean)
          .join("; ") || "none identified";
      const content = `Document Type: Medical Prescription. Doctor: ${structured.doctor_name ?? "unknown"}. Patient: ${
        structured.patient_name ?? row.patient_name ?? "unknown"
      }. Prescribed Medications: ${medsSummary}. Full Handwritten OCR: ${structured.raw_ocr_text}`;

      const embedding = await embed(content);

      const { error: kbErr } = await supabaseAdmin.from("knowledge_base").insert({
        source_type: "prescription_handwritten_ocr",
        content,
        metadata: { storage_path: row.image_filename, structured_data: structured } as never,
        embedding: JSON.stringify(embedding) as never,
      });
      if (kbErr) throw new Error(kbErr.message);

      const { error: upErr } = await supabaseAdmin
        .from("staging_prescription_images")
        .update({
          processed: true,
          extracted_ocr_text: structured.raw_ocr_text,
          structured_data: structured as never,
        })
        .eq("id", row.id);
      if (upErr) throw new Error(upErr.message);
      processed += 1;
    } catch (err) {
      errors.push(`${row.image_filename}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  const { count } = await supabaseAdmin
    .from("staging_prescription_images")
    .select("id", { count: "exact", head: true })
    .eq("processed", false);

  return { processed, failed: errors.length, remaining: count ?? 0, errors };
}