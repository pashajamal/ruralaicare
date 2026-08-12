import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, ImagePlus, Loader2, ScanText } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { processPrescriptionsFn, uploadPrescriptionImageFn } from "@/lib/prescriptions.functions";

export const Route = createFileRoute("/prescriptions")({
  head: () => ({
    meta: [
      { title: "Prescription Dataset OCR | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Upload prescription images and metadata, extract handwritten text with AI, and ground the clinic knowledge base in verified prescriptions.",
      },
      { property: "og:title", content: "Prescription Dataset OCR | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "Batch upload, transcribe and index handwritten prescriptions for the clinic knowledge base.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrescriptionsPage,
});

type StagingRow = {
  id: string;
  image_filename: string;
  patient_name: string | null;
  medication_details: string | null;
  extracted_ocr_text: string | null;
  structured_data: unknown;
  processed: boolean;
  created_at: string;
};

type Med = { drug_name?: string; dosage?: string; frequency?: string; instructions?: string };

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const split = (line: string) => {
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
  };
  const header = split(lines[0] ?? "").map((h) => h.toLowerCase());
  const pick = (cols: string[], names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0 && cols[idx]) return cols[idx];
    }
    return null;
  };
  return lines
    .slice(1)
    .map(split)
    .map((cols) => ({
      image_filename: pick(cols, ["image_filename", "filename", "image", "file"]) ?? "",
      patient_name: pick(cols, ["patient_name", "patient"]),
      medication_details:
        pick(cols, ["medication_details", "medicine_name", "label", "medication", "drug"]) ??
        pick(cols, ["generic_name"]),
    }))
    .filter((r) => r.image_filename);
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function DropZone({
  label,
  hint,
  accept,
  icon,
  busy,
  onFiles,
}: {
  label: string;
  hint: string;
  accept: string;
  icon: React.ReactNode;
  busy: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        over ? "border-primary bg-accent" : "border-border bg-card"
      }`}
    >
      <div className="text-primary">{icon}</div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Choose files
      </Button>
    </div>
  );
}

function PrescriptionImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.storage
      .from("prescription-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-secondary">
      {url ? (
        <img src={url} alt={`Prescription image ${path}`} className="max-h-72 w-full object-contain" />
      ) : (
        <p className="p-6 text-xs text-muted-foreground">Loading image…</p>
      )}
    </div>
  );
}

function PrescriptionsPage() {
  const queryClient = useQueryClient();
  const uploadImage = useServerFn(uploadPrescriptionImageFn);
  const processBatch = useServerFn(processPrescriptionsFn);
  const [csvBusy, setCsvBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["staging-prescriptions"],
    queryFn: async (): Promise<StagingRow[]> => {
      const { data, error } = await supabase
        .from("staging_prescription_images")
        .select("id, image_filename, patient_name, medication_details, extracted_ocr_text, structured_data, processed, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as StagingRow[];
    },
  });

  const pending = rows.filter((r) => !r.processed);
  const processed = rows.filter((r) => r.processed);

  async function handleCsv(files: File[]) {
    const file = files[0];
    if (!file) return;
    setCsvBusy(true);
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.length) throw new Error("No usable rows found in the CSV");
      for (let i = 0; i < parsed.length; i += 500) {
        const { error } = await supabase.from("staging_prescription_images").insert(parsed.slice(i, i + 500));
        if (error) throw error;
      }
      toast.success(`Imported ${parsed.length} metadata rows`);
      void queryClient.invalidateQueries({ queryKey: ["staging-prescriptions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setCsvBusy(false);
    }
  }

  async function handleImages(files: File[]) {
    const images = files.filter((f) => /image\/(jpeg|png|webp)/.test(f.type));
    if (!images.length) return;
    setImgBusy(true);
    let ok = 0;
    try {
      for (const file of images) {
        try {
          await uploadImage({ data: { filename: file.name, base64: await toBase64(file) } });
          ok += 1;
        } catch (err) {
          toast.error(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        }
      }
      if (ok) toast.success(`Uploaded ${ok} image${ok > 1 ? "s" : ""}`);
      void queryClient.invalidateQueries({ queryKey: ["staging-prescriptions"] });
    } finally {
      setImgBusy(false);
    }
  }

  async function runBatch() {
    setProcessing(true);
    try {
      const res = await processBatch({ data: { limit: 10 } });
      if (res.processed === 0 && res.failed === 0) toast.info("Nothing left to process");
      else toast.success(`Processed ${res.processed}, failed ${res.failed}, ${res.remaining} remaining`);
      res.errors.slice(0, 3).forEach((e) => toast.error(e));
      void queryClient.invalidateQueries({ queryKey: ["staging-prescriptions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch processing failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold">Prescription Dataset Upload</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload prescription metadata and images, then extract handwritten text with AI. Extracted records are indexed
            into the clinic knowledge base — they are reference data, never a medical decision.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <DropZone
            label="CSV metadata"
            hint="Columns: image_filename / filename, patient_name, medication_details or medicine_name."
            accept=".csv,text/csv"
            icon={<FileSpreadsheet className="size-7" aria-hidden />}
            busy={csvBusy}
            onFiles={handleCsv}
          />
          <DropZone
            label="Prescription images"
            hint="JPG, PNG or WebP prescription photos and handwritten notes. Uploaded to secure clinic storage."
            accept="image/jpeg,image/png,image/webp"
            icon={<ImagePlus className="size-7" aria-hidden />}
            busy={imgBusy}
            onFiles={handleImages}
          />
        </div>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold">Process handwritten prescriptions</p>
            <p className="text-xs text-muted-foreground">
              {pending.length} pending · {processed.length} processed (batches of 10)
            </p>
          </div>
          <Button onClick={runBatch} disabled={processing || pending.length === 0}>
            {processing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ScanText className="size-4" aria-hidden />}
            Process next 10
          </Button>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Processed prescriptions</h2>
          {processed.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No prescriptions have been transcribed yet.
            </p>
          ) : (
            processed.map((row) => {
              const structured = (row.structured_data ?? {}) as { doctor_name?: string | null; medications?: Med[] };
              const meds = structured.medications ?? [];
              return (
                <article key={row.id} className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:grid-cols-2">
                  <div>
                    <p className="mb-2 truncate text-xs font-medium text-muted-foreground">{row.image_filename}</p>
                    <PrescriptionImage path={row.image_filename} />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doctor / patient</p>
                      <p className="text-sm">
                        {structured.doctor_name || "Unknown doctor"} · {row.patient_name || "Unknown patient"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medications</p>
                      {meds.length ? (
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {meds.map((m, i) => (
                            <li key={i} className="rounded-lg bg-secondary px-3 py-1.5">
                              <span className="font-medium">{m.drug_name || "[illegible]"}</span>{" "}
                              <span className="text-muted-foreground">
                                {[m.dosage, m.frequency, m.instructions].filter(Boolean).join(" · ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No medications identified.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verbatim OCR</p>
                      <p className="mt-1 max-h-40 overflow-auto whitespace-pre-line rounded-lg border border-border p-3 text-sm text-muted-foreground">
                        {row.extracted_ocr_text || "—"}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </AppShell>
  );
}