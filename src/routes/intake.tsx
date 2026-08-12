import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CloudOff, ImageUp, Loader2, RefreshCw, Sparkles, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useOnline } from "@/components/AppShell";
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
import { useAuth } from "@/lib/auth";
import { submitIntake } from "@/lib/triage.functions";
import { addPending, offlineEmergencyCheck, readPending, removePending, type PendingIntake } from "@/lib/offline";
import { validateVitals, type VitalWarning } from "@/lib/vitals";

export const Route = createFileRoute("/intake")({
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
        content: "Structured intake with vital-range safety checks and offline capture for low-connectivity clinics.",
      },
    ],
  }),
  component: IntakePage,
});

const LANGUAGES = ["English", "Hindi", "Bangla", "Arabic"];

export function IntakePage() {
  const navigate = useNavigate();
  const run = useServerFn(submitIntake);
  const { profile, isDoctor, loading } = useAuth();
  const { online } = useOnline();
  const [language, setLanguage] = useState("English");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<VitalWarning[]>([]);
  const [pending, setPending] = useState<PendingIntake[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (profile?.preferred_patient_language) setLanguage(profile.preferred_patient_language);
  }, [profile?.preferred_patient_language]);

  useEffect(() => {
    const refresh = () => setPending(readPending());
    refresh();
    window.addEventListener("clinic:pending-changed", refresh);
    return () => window.removeEventListener("clinic:pending-changed", refresh);
  }, []);

  function readForm(form: FormData) {
    const num = (key: string) => {
      const raw = String(form.get(key) ?? "").trim();
      const value = Number(raw);
      return raw && Number.isFinite(value) ? value : null;
    };
    return {
      name: String(form.get("name") ?? "").trim(),
      age: Number(form.get("age") ?? 0),
      symptoms: String(form.get("symptoms") ?? "").trim(),
      duration: String(form.get("duration") ?? "").trim(),
      history: String(form.get("history") ?? "").trim(),
      vitals: {
        temp: num("temp"),
        bp: String(form.get("bp") ?? "").trim() || null,
        pulse: num("pulse"),
        spo2: num("spo2"),
      },
    };
  }

  function onValidate(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const values = readForm(form);
    setWarnings(validateVitals({ ...values.vitals, age: values.age }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = readForm(form);
    const found = validateVitals({ ...values.vitals, age: values.age });
    setWarnings(found);

    if (!navigator.onLine) {
      const emergency = offlineEmergencyCheck({
        symptoms: values.symptoms,
        vitals: { temp: values.vitals.temp, pulse: values.vitals.pulse, spo2: values.vitals.spo2 },
        age: values.age,
      });
      addPending({ ...values, preferred_language: language });
      toast.warning("Saved offline. AI assessment pending — internet connection required.");
      if (emergency.length > 0) {
        toast.error(`Offline emergency check: ${emergency[0]}. Arrange referral now.`, { duration: 12000 });
      }
      (event.target as HTMLFormElement).reset();
      return;
    }

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
        data: { ...values, preferred_language: language, image_path: imagePath },
      });

      toast.success("Intake saved — routed to doctor review");
      void navigate({ to: "/review/$visitId", params: { visitId: result.visitId } });
    } catch (error) {
      addPending({ ...values, preferred_language: language });
      toast.error("Unable to connect. Your unsynced intake has been saved locally.");
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function syncPending() {
    setSyncing(true);
    let ok = 0;
    for (const item of readPending()) {
      try {
        await run({
          data: {
            name: item.name,
            age: item.age,
            preferred_language: item.preferred_language,
            symptoms: item.symptoms,
            duration: item.duration,
            history: item.history,
            vitals: item.vitals,
            image_path: null,
          },
        });
        removePending(item.localId);
        ok += 1;
      } catch (error) {
        console.error(error);
      }
    }
    setSyncing(false);
    if (ok > 0) toast.success(`${ok} record${ok > 1 ? "s" : ""} synced and assessed`);
    else toast.error("Sync failed — records are still saved locally");
  }

  const emergencyWarnings = warnings.filter((w) => w.level === "emergency");
  const verifyWarnings = warnings.filter((w) => w.level === "verify");

  if (!loading && isDoctor) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Stethoscope className="mx-auto size-8 text-primary" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold">Intake is for health workers</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Doctors review and finalize submitted cases rather than recording new intakes.
          </p>
          <Button asChild className="mt-4 w-full">
            <Link to="/doctor">Go to review queue</Link>
          </Button>
        </div>
      </AppShell>
    );
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

        {!online ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-risk-amber/30 bg-risk-amber-soft p-4 text-sm text-risk-amber">
            <CloudOff className="mt-0.5 size-4" aria-hidden />
            <p>
              <b>Limited connectivity — working offline.</b> Intakes are stored on this device and marked “AI assessment
              pending — internet connection required.” A deterministic emergency check still runs locally.
            </p>
          </div>
        ) : null}

        {pending.length > 0 ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm">
              <b>{pending.length} record{pending.length > 1 ? "s" : ""} waiting to sync.</b>{" "}
              <span className="text-muted-foreground">AI assessment pending — internet connection required.</span>
            </p>
            <Button onClick={syncPending} disabled={!online || syncing} size="sm">
              {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              Sync Records
            </Button>
          </div>
        ) : null}

        <form onSubmit={onSubmit} onBlur={onValidate} className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Patient details
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
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
              Presenting complaint
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="symptoms">Symptoms description</Label>
                <Textarea
                  id="symptoms"
                  name="symptoms"
                  required
                  rows={5}
                  placeholder="Write in any language the health worker is comfortable with."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration of symptoms</Label>
                <Input id="duration" name="duration" placeholder="e.g. 3 days" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="history">Basic medical history</Label>
                <Textarea id="history" name="history" rows={3} placeholder="Chronic conditions, medicines, allergies" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h2>
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
                <Input id="pulse" name="pulse" type="number" placeholder="80" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spo2">SpO2 (%)</Label>
                <Input id="spo2" name="spo2" type="number" placeholder="98" />
              </div>
            </div>

            {emergencyWarnings.length > 0 ? (
              <div role="alert" className="mt-4 rounded-xl border border-risk-red/30 bg-risk-red-soft p-4 text-sm text-risk-red">
                <p className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="size-4" aria-hidden /> Emergency threshold triggered
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {emergencyWarnings.map((w) => (
                    <li key={w.field}>{w.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {verifyWarnings.length > 0 ? (
              <div role="alert" className="mt-4 rounded-xl border border-risk-amber/30 bg-risk-amber-soft p-4 text-sm text-risk-amber">
                <p className="font-semibold">Please verify these measurements</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {verifyWarnings.map((w) => (
                    <li key={w.field}>{w.message}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">Values are never corrected automatically — re-check and re-enter.</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Optional upload
            </h2>
            <label
              htmlFor="file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary"
            >
              <ImageUp className="size-6 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium">Upload wound photo or prescription</span>
              <span className="text-xs text-muted-foreground">
                Stored privately. Reviewed for observation or text extraction only — never a diagnosis.
              </span>
              <input
                id="file"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <p className="mt-3 flex items-center gap-2 text-sm">
                {file.name}
                <button type="button" onClick={() => setFile(null)} aria-label="Remove file">
                  <X className="size-4 text-muted-foreground" aria-hidden />
                </button>
              </p>
            ) : null}
          </section>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {online ? "Submit for AI Assessment" : "Save offline"}
          </Button>
          <p className="pb-4 text-center text-xs text-muted-foreground">
            AI-generated information is advisory only. It does not replace a qualified medical professional.
          </p>
        </form>
      </div>
    </AppShell>
  );
}
