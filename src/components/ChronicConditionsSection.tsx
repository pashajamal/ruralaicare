import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse, Info } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  CHRONIC_CONDITIONS,
  OTHER_CONDITION,
  PREGNANCY_STATES,
  PREGNANCY_SYMPTOMS,
  SEXES,
  TRIMESTERS,
  type ChronicCondition,
  type PregnancyStatus,
} from "@/lib/conditions";

type Entry = { checked: boolean; on_medication: boolean; medication_name: string };
const emptyEntry = (): Entry => ({ checked: false, on_medication: false, medication_name: "" });

export type ConditionsForm = ReturnType<typeof useConditionsForm>;

/** Chronic-condition + pregnancy state, pre-filled from the patient record found by mobile number. */
export function useConditionsForm(mobile: string) {
  const [sex, setSex] = useState<string>("");
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [otherName, setOtherName] = useState("");
  const [pregnancy, setPregnancy] = useState<PregnancyStatus>({ status: "Not Pregnant", trimester: null, symptoms: [], other: "" });
  const prefilledFor = useRef<string | null>(null);

  const digits = mobile.replace(/[^\d]/g, "");
  const { data: onFile } = useQuery({
    queryKey: ["conditions-prefill", digits],
    enabled: digits.length >= 8,
    queryFn: async () => {
      const { data: patient } = await supabase
        .from("patients")
        .select("id, sex")
        .eq("mobile_number", mobile.trim())
        .maybeSingle();
      if (!patient) return null;
      const { data } = await supabase
        .from("patient_conditions")
        .select("condition_name, on_medication, medication_name")
        .eq("patient_id", patient.id);
      return { sex: patient.sex as string | null, conditions: data ?? [] };
    },
  });

  useEffect(() => {
    if (!onFile || prefilledFor.current === digits) return;
    prefilledFor.current = digits;
    if (onFile.sex) setSex(onFile.sex);
    const next: Record<string, Entry> = {};
    let other = "";
    for (const row of onFile.conditions) {
      const known = CHRONIC_CONDITIONS.find((c) => c === row.condition_name);
      const key = known ?? OTHER_CONDITION;
      if (!known) other = row.condition_name;
      next[key] = {
        checked: true,
        on_medication: Boolean(row.on_medication),
        medication_name: row.medication_name ?? "",
      };
    }
    setEntries(next);
    setOtherName(other);
  }, [onFile, digits]);

  function update(key: string, patch: Partial<Entry>) {
    setEntries((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyEntry()), ...patch } }));
  }

  const chronic: ChronicCondition[] = Object.entries(entries)
    .filter(([, e]) => e.checked)
    .map(([key, e]) => ({
      condition_name: key === OTHER_CONDITION ? otherName.trim() || "Other condition" : key,
      on_medication: e.on_medication,
      medication_name: e.medication_name.trim(),
    }));

  const pregnancyValue: PregnancyStatus | null =
    sex === "Female" ? { ...pregnancy, other: (pregnancy.other ?? "").trim() } : null;

  return {
    sex,
    setSex,
    entries,
    update,
    otherName,
    setOtherName,
    pregnancy,
    setPregnancy,
    chronic,
    pregnancyValue,
    hasRecordOnFile: Boolean(onFile?.conditions?.length),
  };
}

export function ChronicConditionsSection({ form }: { form: ConditionsForm }) {
  const { sex, setSex, entries, update, otherName, setOtherName, pregnancy, setPregnancy, hasRecordOnFile } = form;

  function toggleSymptom(symptom: string, on: boolean) {
    setPregnancy((p) => ({
      ...p,
      symptoms: on ? [...p.symptoms, symptom] : p.symptoms.filter((s) => s !== symptom),
    }));
  }

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <HeartPulse className="size-4" aria-hidden /> Chronic &amp; long-term conditions
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Recorded once per patient and reused on every future visit. Update if anything has changed.
        </p>

        {hasRecordOnFile ? (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
            <Info className="mt-0.5 size-3.5 text-primary" aria-hidden />
            Conditions already on file for this mobile number have been pre-filled. Edit below to update the record.
          </p>
        ) : null}

        <div className="mb-5 max-w-xs space-y-2">
          <Label htmlFor="sex">Sex</Label>
          <select
            id="sex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Not recorded</option>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[...CHRONIC_CONDITIONS, OTHER_CONDITION].map((condition) => {
            const entry = entries[condition] ?? emptyEntry();
            return (
              <div key={condition} className="rounded-xl border border-border p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={entry.checked}
                    onCheckedChange={(v) => update(condition, { checked: v === true })}
                  />
                  {condition}
                </label>
                {entry.checked ? (
                  <div className="mt-3 space-y-2 pl-6">
                    {condition === OTHER_CONDITION ? (
                      <div className="space-y-1">
                        <Label htmlFor="other-condition-name" className="text-xs text-muted-foreground">
                          Disease / condition name
                        </Label>
                        <Input
                          id="other-condition-name"
                          value={otherName}
                          onChange={(e) => setOtherName(e.target.value)}
                          placeholder="e.g. Epilepsy, Tuberculosis, Anaemia"
                        />
                      </div>
                    ) : null}
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={entry.on_medication}
                        onCheckedChange={(v) => update(condition, { on_medication: v === true })}
                      />
                      Currently on medication for this?
                    </label>
                    {entry.on_medication ? (
                      <Input
                        value={entry.medication_name}
                        onChange={(e) => update(condition, { medication_name: e.target.value })}
                        placeholder="Medication name"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {sex === "Female" ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pregnancy status</h2>
          <div className="flex flex-wrap gap-4">
            {PREGNANCY_STATES.map((state) => (
              <label key={state} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pregnancy_state"
                  checked={pregnancy.status === state}
                  onChange={() => setPregnancy((p) => ({ ...p, status: state }))}
                />
                {state}
              </label>
            ))}
          </div>

          {pregnancy.status === "Pregnant" ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium">Trimester</span>
                {TRIMESTERS.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="trimester"
                      checked={pregnancy.trimester === t}
                      onChange={() => setPregnancy((p) => ({ ...p, trimester: t }))}
                    />
                    {t}
                  </label>
                ))}
              </div>
              <div>
                <p className="text-sm font-medium">Pregnancy-related symptoms present</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {PREGNANCY_SYMPTOMS.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={pregnancy.symptoms.includes(s)}
                        onCheckedChange={(v) => toggleSymptom(s, v === true)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
                <Input
                  className="mt-3"
                  value={pregnancy.other ?? ""}
                  onChange={(e) => setPregnancy((p) => ({ ...p, other: e.target.value }))}
                  placeholder="Other pregnancy-related symptom (optional)"
                />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
