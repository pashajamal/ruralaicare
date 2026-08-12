import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UI_LANGUAGES } from "@/lib/i18n";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | AI Virtual Clinic" },
      {
        name: "description",
        content: "Profile, interface language, notification preferences and the read-only deterministic clinical rules.",
      },
      { property: "og:title", content: "Settings | AI Virtual Clinic" },
      { property: "og:description", content: "Configure your clinic profile and review the active safety rules." },
    ],
  }),
  component: SettingsPage,
});

const RULES = [
  "SpO2 < 92% → RED (emergency threshold)",
  "Symptoms mention chest pain or difficulty breathing → RED",
  "Temperature > 39.5 °C AND age > 60 → RED",
  "Pulse > 130 bpm or < 45 bpm → RED",
  "Symptoms persisting more than 3 days → YELLOW",
  "Temperature ≥ 38.5 °C or SpO2 92–94% → YELLOW",
  "Age > 65 or age < 2 with fever → YELLOW",
  "No rule triggered → GREEN (basic support with fixed protocol)",
];

/** Older profiles may hold a language we no longer support — fall back to English. */
function normalizeLang(value: string | null | undefined) {
  return (UI_LANGUAGES as readonly string[]).includes(value ?? "") ? (value as string) : "English";
}

function SettingsPage() {
  const { profile, role, refresh } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    health_centre: "",
    ui_language: "English",
    preferred_patient_language: "English",
    notify_red: true,
    notify_consultation: true,
    notify_followup: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      health_centre: profile.health_centre ?? "",
      ui_language: normalizeLang(profile.ui_language),
      preferred_patient_language: normalizeLang(profile.preferred_patient_language),
      notify_red: profile.notify_red,
      notify_consultation: profile.notify_consultation,
      notify_followup: profile.notify_followup,
    });
  }, [profile]);

  const { data: protocols, isLoading } = useQuery({
    queryKey: ["protocols"],
    queryFn: async () => {
      const { data, error } = await supabase.from("first_aid_protocols").select("*").order("condition_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function save() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save settings");
      return;
    }
    await refresh();
    toast.success("Settings saved");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-5 pb-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Profile, language, notifications and active safety rules.</p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="centre">Health centre</Label>
              <Input id="centre" value={form.health_centre} onChange={(e) => setForm({ ...form, health_centre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <p className="flex h-9 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-sm capitalize">
                <Lock className="size-3.5 text-muted-foreground" aria-hidden /> {(role ?? "staff").replace("_", " ")}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Language</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ui">Interface language</Label>
              <select
                id="ui"
                value={form.ui_language}
                onChange={(e) => setForm({ ...form, ui_language: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {UI_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient">Default patient language</Label>
              <select
                id="patient"
                value={form.preferred_patient_language}
                onChange={(e) => setForm({ ...form, preferred_patient_language: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {UI_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Clinical terms stay in English to avoid ambiguity; supporting text follows your chosen language.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notifications</h2>
          <div className="space-y-3 text-sm">
            {([
              ["notify_red", "New RED case requiring immediate attention"],
              ["notify_consultation", "New doctor consultation request"],
              ["notify_followup", "Follow-up reminders"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <Button onClick={save} disabled={saving || !profile}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save settings
        </Button>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Lock className="size-4" aria-hidden /> Deterministic clinical rules (read-only)
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            These rules run in code, always, and cannot be changed by the AI or by clinic staff.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {RULES.map((r) => (
              <li key={r} className="rounded-xl border border-border bg-secondary px-3 py-2">
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            First-aid protocol library (read-only)
          </h2>
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ul className="space-y-3 text-sm">
              {(protocols ?? []).map((p) => (
                <li key={p.id} className="rounded-xl border border-border p-4">
                  <p className="font-semibold">{p.condition_name}</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{p.protocol_text}</p>
                  {p.otc_medicine ? (
                    <p className="mt-1 text-xs text-muted-foreground">OTC reference: {p.otc_medicine}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-secondary p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">System information</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">AI model</dt>
              <dd>Gemini 2.5 Flash (server-side only)</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last rule update</dt>
              <dd>Deterministic rule set v1.1</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Application version</dt>
              <dd>1.1.0</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-dashed border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Coming soon</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Planned for future releases — not available in this version.
          </p>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {[
              "Voice input and spoken replies, with full multilingual speech round-trip",
              "Real offline-first sync queue beyond the current local-storage capture",
              "SMS and push delivery for follow-up reminders",
              "Real-time doctor video and audio consultation",
              "Integration with live hospital availability and bed-status data",
              "Multi-clinic and multi-region administrator view",
            ].map((item) => (
              <li key={item} className="rounded-xl border border-border bg-secondary px-3 py-2 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
