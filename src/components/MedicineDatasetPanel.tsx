import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Loader2, Pill } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { embedMedicineDatasetFn } from "@/lib/medicine-dataset.functions";

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

/** Parses the medicine catalogue CSV (name, composition, uses, side_effects, image_url). */
export function parseMedicineCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const at = (cols: string[], names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0 && cols[idx]) return cols[idx];
    }
    return null;
  };
  return lines
    .slice(1)
    .map(splitLine)
    .map((cols) => ({
      medicine_name: at(cols, ["name", "medicine_name", "medicine", "drug"]) ?? "",
      composition: at(cols, ["composition", "drug content", "salt"]),
      uses: at(cols, ["uses", "use", "indication", "disease"]),
      side_effects: at(cols, ["side_effects", "side effects"]),
      image_url: at(cols, ["image_url", "image"]),
    }))
    .filter((r) => r.medicine_name);
}

export function MedicineDatasetPanel() {
  const queryClient = useQueryClient();
  const embedBatch = useServerFn(embedMedicineDatasetFn);
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [embedding, setEmbedding] = useState(false);

  const { data: counts } = useQuery({
    queryKey: ["staging-medicine-counts"],
    queryFn: async () => {
      const pending = await supabase
        .from("staging_medicines")
        .select("id", { count: "exact", head: true })
        .eq("processed", false);
      const total = await supabase.from("staging_medicines").select("id", { count: "exact", head: true });
      return { pending: pending.count ?? 0, total: total.count ?? 0 };
    },
  });

  async function handleCsv(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const rows = parseMedicineCsv(await file.text());
      if (!rows.length) throw new Error("No usable rows found in the CSV");
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("staging_medicines").insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      toast.success(`Imported ${rows.length} medicine rows`);
      void queryClient.invalidateQueries({ queryKey: ["staging-medicine-counts"] });
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
      void queryClient.invalidateQueries({ queryKey: ["staging-medicine-counts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Embedding batch failed");
    } finally {
      setEmbedding(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">Medicine &amp; drug-safety reference dataset</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a medicine catalogue CSV (name, composition, uses, side_effects). Rows are grounded into the knowledge
          base as <code>drug_safety</code> reference data — never a medical decision.
        </p>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {counts ? `${counts.pending} pending · ${counts.total} staged medicines` : "Loading counts…"}
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
          Upload medicine dataset CSV
        </Button>
        <Button type="button" onClick={runEmbeddings} disabled={embedding || counts?.pending === 0}>
          {embedding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Pill className="size-4" aria-hidden />}
          Generate drug-safety embeddings (next 50)
        </Button>
      </div>
    </section>
  );
}
