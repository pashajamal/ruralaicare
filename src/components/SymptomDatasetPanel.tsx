import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, FileSpreadsheet, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { embedSymptomDatasetFn } from "@/lib/symptom-dataset.functions";

type Row = { disease_label: string; symptom_text: string };

function splitLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/** Accepts either "disease,symptoms" rows or a wide 0/1 symptom matrix, and returns unique pairs. */
export function parseSymptomCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const diseaseIdx = header.findIndex((h) => h === "disease" || h === "diseases" || h === "disease_label");
  const symptomIdx = header.findIndex((h) => h === "symptoms" || h === "symptom" || h === "symptom_text");
  const map = new Map<string, Set<string>>();

  for (const line of lines.slice(1)) {
    const cols = splitLine(line);
    const disease = cols[diseaseIdx >= 0 ? diseaseIdx : 0];
    if (!disease) continue;
    const set = map.get(disease) ?? new Set<string>();
    if (symptomIdx >= 0) {
      (cols[symptomIdx] ?? "")
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => set.add(s));
    } else {
      for (let i = 0; i < header.length; i += 1) {
        if (i === (diseaseIdx >= 0 ? diseaseIdx : 0)) continue;
        if (cols[i] === "1" || cols[i]?.toLowerCase() === "true") set.add(header[i] ?? "");
      }
    }
    map.set(disease, set);
  }

  return [...map.entries()]
    .map(([disease_label, symptoms]) => ({
      disease_label,
      symptom_text: [...symptoms].filter(Boolean).sort().join(", "),
    }))
    .filter((r) => r.symptom_text);
}

export function SymptomDatasetPanel() {
  const queryClient = useQueryClient();
  const embedBatch = useServerFn(embedSymptomDatasetFn);
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [embedding, setEmbedding] = useState(false);

  const { data: counts } = useQuery({
    queryKey: ["staging-symptom-counts"],
    queryFn: async () => {
      const pending = await supabase
        .from("staging_symptom_disease")
        .select("id", { count: "exact", head: true })
        .eq("processed", false);
      const total = await supabase.from("staging_symptom_disease").select("id", { count: "exact", head: true });
      return { pending: pending.count ?? 0, total: total.count ?? 0 };
    },
  });

  async function handleCsv(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const rows = parseSymptomCsv(await file.text());
      if (!rows.length) throw new Error("No usable rows found in the CSV");
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("staging_symptom_disease").insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      toast.success(`Imported ${rows.length} disease reference rows`);
      void queryClient.invalidateQueries({ queryKey: ["staging-symptom-counts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setImporting(false);
    }
  }

  async function runEmbeddings() {
    setEmbedding(true);
    try {
      const res = await embedBatch({ data: { limit: 50 } });
      if (res.processed === 0 && res.failed === 0) toast.info("Nothing left to embed");
      else toast.success(`Embedded ${res.processed}, failed ${res.failed}, ${res.remaining} remaining`);
      res.errors.slice(0, 3).forEach((e) => toast.error(e));
      void queryClient.invalidateQueries({ queryKey: ["staging-symptom-counts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Embedding batch failed");
    } finally {
      setEmbedding(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">Symptom &amp; disease reference dataset</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload <code>Cleaned_Symptom_Disease_Reference.csv</code> (disease, symptoms) or a wide 0/1 symptom matrix.
          Rows are grounded into the knowledge base as reference data — never a medical decision.
        </p>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {counts ? `${counts.pending} pending · ${counts.total} staged rows` : "Loading counts…"}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            void handleCsv(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" disabled={importing} onClick={() => inputRef.current?.click()}>
          {importing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FileSpreadsheet className="size-4" aria-hidden />
          )}
          Upload symptom dataset CSV
        </Button>
        <Button type="button" onClick={runEmbeddings} disabled={embedding || counts?.pending === 0}>
          {embedding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Brain className="size-4" aria-hidden />}
          Generate embeddings (next 50)
        </Button>
      </div>
    </section>
  );
}
