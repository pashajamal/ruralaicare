/** Shared, browser-safe vocabulary for chronic conditions and pregnancy status. */

export const CHRONIC_CONDITIONS = [
  "Diabetes (Sugar)",
  "Thyroid Disorder",
  "Congenital/Birth Condition",
  "Heart Disease",
  "Hypertension",
  "Asthma",
  "Kidney Disease",
  "Epilepsy",
] as const;

export const OTHER_CONDITION = "Other";

export type ChronicCondition = {
  condition_name: string;
  on_medication: boolean;
  medication_name: string;
  diagnosed_note?: string | undefined;
};

export const PREGNANCY_STATES = ["Not Pregnant", "Pregnant", "Not Sure"] as const;
export const TRIMESTERS = ["1st", "2nd", "3rd"] as const;
export const PREGNANCY_SYMPTOMS = [
  "Swelling",
  "High blood pressure signs",
  "Severe headache",
  "Reduced fetal movement",
  "Bleeding",
  "Severe nausea/vomiting",
] as const;

export type PregnancyStatus = {
  status: (typeof PREGNANCY_STATES)[number];
  trimester?: string | null | undefined;
  symptoms: string[];
  other?: string | null | undefined;
};

export const SEXES = ["Male", "Female", "Other"] as const;

/** Case-insensitive membership test used by the risk modifiers. */
export function hasCondition(conditions: ChronicCondition[], needle: string): ChronicCondition | null {
  const n = needle.toLowerCase();
  return conditions.find((c) => c.condition_name.toLowerCase().includes(n)) ?? null;
}

/** Short badge labels shown next to a patient's name for the doctor. */
export function conditionBadges(
  conditions: ChronicCondition[],
  pregnancy: PregnancyStatus | null,
): string[] {
  const badges: string[] = [];
  if (pregnancy?.status === "Pregnant") {
    badges.push(pregnancy.trimester ? `Pregnant — ${pregnancy.trimester} trimester` : "Pregnant");
  } else if (pregnancy?.status === "Not Sure") {
    badges.push("Pregnancy — not sure");
  }
  for (const c of conditions) {
    const name = c.condition_name;
    if (/diabet/i.test(name)) badges.push("Diabetic");
    else if (/thyroid/i.test(name)) badges.push("Thyroid");
    else if (/congenital|birth/i.test(name)) badges.push("Congenital condition");
    else badges.push(name);
  }
  return badges;
}
