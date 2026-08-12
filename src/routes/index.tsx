import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { ImageUp, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { submitIntake } from "@/lib/triage.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "New Patient Intake | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Record patient symptoms and vitals, run an AI-assisted risk triage, and route the case to a doctor for review.",
      },
      { property: "og:title", content: "New Patient Intake | AI Virtual Clinic" },
      {
        property: "og:description",
        content:
          "Record patient symptoms and vitals, run an AI-assisted risk triage, and route the case to a doctor for review.",
      },
    ],
  }),
  component: IntakePage,
});

const LANGUAGES = ["English", "Hindi", "Bangla", "Arabic"];

function IntakePage() {
  const navigate = useNavigate();
  const run = useServerFn(submitIntake);
  const [language, setLanguage] = useState("English");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const num = (key: string) => {
      const raw = String(form.get(key) ?? "").trim();
      const value = Number(raw);
      return raw && Number.isFinite(value) ? value : null;
    };

    setBusy(true);
    try {
      let imagePath: string | null = null;
      if (file) {
        const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("clinic-uploads").upload(path, file);
        if (error) throw new Error("Image upload failed");
        imagePath = path;
      }

      const result = await run({
        data: {
          name: String(form.get("name") ?? ""),
          age: Number(form.get("age") ?? 0),
          preferred_language: language,
          symptoms: String(form.get("symptoms") ?? ""),
          duration: String(form.get("duration") ?? ""),
          history: String(form.get("history") ?? ""),
          vitals: {
            temp: num("temp"),
            bp: String(form.get("bp") ?? "").trim() || null,
            pulse: num("pulse"),
            spo2: num("spo2"),
          },
          image_path: imagePath,
        },
      });

      toast.success("Assessment ready for doctor review");
      navigate({ to: "/review/$visitId", params: { visitId: result.visitId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit intake");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">New Patient Intake</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record what the patient reports. The AI drafts an assessment; a doctor decides.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Patient details
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="name">Patient name</Label>
                <Input id="name" name="name" required placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input id="age" name="age" type="number" min={0} max={120} required placeholder="Years" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Preferred language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Presentation
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="symptoms">Symptoms description</Label>
                <Textarea
                  id="symptoms"
                  name="symptoms"
                  required
                  rows={5}
                  placeholder="Describe what the patient reports, in any language."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration of symptoms</Label>
                <Input id="duration" name="duration" placeholder="e.g. 4 days" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="history">Basic medical history</Label>
                <Textarea id="history" name="history" rows={3} placeholder="Chronic conditions, medicines, allergies" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Vitals
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="temp">Temperature (°C)</Label>
                <Input id="temp" name="temp" type="number" step="0.1" placeholder="37.0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp">Blood pressure</Label>
                <Input id="bp" name="bp" placeholder="120/80" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pulse">Pulse (bpm)</Label>
                <Input id="pulse" name="pulse" type="number" placeholder="78" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spo2">SpO2 (%)</Label>
                <Input id="spo2" name="spo2" type="number" placeholder="98" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Attachment (optional)
            </h2>
            {file ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3 text-sm">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} aria-label="Remove file">
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-6 py-10 text-center transition-colors hover:border-primary/50">
                <ImageUp className="size-6 text-primary" />
                <span className="text-sm font-medium">Upload wound photo or prescription</span>
                <span className="text-xs text-muted-foreground">PNG or JPG, drop or click to browse</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </section>

          <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? "Running assessment…" : "Submit for AI Assessment"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
