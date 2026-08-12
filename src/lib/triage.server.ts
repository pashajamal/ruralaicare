import { geminiFetch } from "./gemini.server";
import { claudeChat, CLAUDE_MODEL } from "./claude.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasCondition, type ChronicCondition, type PregnancyStatus } from "./conditions";

const MODEL = "google/gemini-2.5-flash";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function callGemini(
  content: string | ContentBlock[],
  system: string,
  jsonMode = false,
): Promise<string> {
  const res = await geminiFetch("/chat/completions", ({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  }));

  if (res.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(raw: string, fallback: T): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export type Vitals = {
  temp?: number | null | undefined;
  bp?: string | null | undefined;
  pulse?: number | null | undefined;
  spo2?: number | null | undefined;
};

export type StructuredSummary = {
  symptoms: string[];
  duration: string;
  age: number | null;
  vitals: Vitals;
  history: string;
  detected_language: string;
  confirmation_message?: string;
};

/* ---------------- Step 0: image understanding (multimodal) ---------------- */

export async function analyzeImage(imagePath: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from("clinic-uploads")
    .download(imagePath);
  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  const mime = data.type || "image/jpeg";
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

  return callGemini(
    [
      {
        type: "text",
        text: "If this is a wound or skin photo, describe only observable facts: body location, size estimate, colour, discharge, swelling, surrounding skin. Do NOT diagnose. If this is a prescription or medical document, transcribe the readable text verbatim. Answer in under 120 words.",
      },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
    "You are a careful clinical documentation assistant for a rural health worker. You describe or transcribe. You never diagnose.",
  );
}

export function sanitizeText(str: string | undefined | null, maxLength = 2000): string {
  if (!str) return "";
  // Strip control characters except standard newlines and tabs
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.trim().slice(0, maxLength);
}

/* ---------------- Step 1: structuring ---------------- */

export async function structureIntake(input: {
  name: string;
  age: number;
  language: string;
  symptoms: string;
  duration: string;
  history: string;
  vitals: Vitals;
  imageAnalysis?: string | null;
}): Promise<StructuredSummary> {
  const sanitizedInput = {
    name: sanitizeText(input.name, 150),
    age: Math.min(Math.max(Number(input.age) || 0, 0), 120),
    language: sanitizeText(input.language, 50),
    symptoms: sanitizeText(input.symptoms, 2500),
    duration: sanitizeText(input.duration, 150),
    history: sanitizeText(input.history, 2500),
    vitals: input.vitals,
    imageAnalysis: input.imageAnalysis ? sanitizeText(input.imageAnalysis, 1500) : null,
  };

  const raw = await callGemini(
    JSON.stringify(sanitizedInput),
    `Extract structured clinical intake data from the health worker's raw text. It may be in English, Hindi (Devanagari), Hinglish (Hindi in Roman script), Bangla, Tamil, Telugu, Marathi, and languages may be mixed within one note.
Return ONLY JSON with this exact shape:
{"symptoms":[string],"duration":string,"age":number,"vitals":{"temp":number|null,"bp":string|null,"pulse":number|null,"spo2":number|null},"history":string,"detected_language":string,"confirmation_message":string}
The input includes a "language" hint chosen by the health worker; when it is "Auto-detect", detect the language yourself instead. "confirmation_message" must be a short (max 30 words) confirmation that the intake was received, written in the hinted language, or — when the hint is "Auto-detect" — in the SAME language and script the health worker used (reply in Roman-script Hinglish if they wrote Hinglish). "detected_language" is the language name actually detected in the note, e.g. "English", "Hindi", "Hinglish", "Bangla", "Tamil", "Telugu", "Marathi". Do not diagnose.`,
    true,
  );

  const parsed = parseJson<Partial<StructuredSummary>>(raw, {});
  return {
    symptoms: parsed.symptoms ?? [input.symptoms],
    duration: parsed.duration ?? input.duration,
    age: parsed.age ?? input.age,
    vitals: { ...input.vitals, ...(parsed.vitals ?? {}) },
    history: parsed.history ?? input.history,
    detected_language: parsed.detected_language ?? input.language,
    confirmation_message: parsed.confirmation_message ?? "Intake recorded.",
  };
}

/* ---------------- Step 2: reasoning (no tiering) ---------------- */

const FEW_SHOTS = `Examples of symptom pattern -> likely condition CATEGORY (never a diagnosis):
- fever + cough + body ache, 2 days -> category: common viral respiratory illness
- watery stools + vomiting + thirst -> category: acute gastroenteritis with dehydration risk
- burning urination + lower abdominal discomfort -> category: possible urinary tract irritation
- itchy rash after new soap -> category: contact skin irritation
- shallow cut with mild bleeding -> category: minor soft-tissue injury`;

const REASONING_SYSTEM = `You are supporting a rural health worker. Write a SHORT preliminary assessment (max 120 words) for a doctor to review.
${FEW_SHOTS}
Rules: never state a definitive diagnosis. Use hedged wording only: "consistent with", "may indicate", "warrants review for". Do NOT assign any risk level, tier, urgency rating or triage colour. Do NOT recommend medicines. Plain prose, no markdown headings.`;

export type ReasoningResult = { text: string; provider: string; fallback: boolean };

/**
 * Symptom-reasoning node — routed through Claude. If Claude fails we fall back to
 * Gemini, but the fallback is logged AND surfaced in the provider tag so it is
 * never silent.
 */
export async function reasonAssessment(
  structured: StructuredSummary,
  imageAnalysis?: string | null,
): Promise<ReasoningResult> {
  const payload = JSON.stringify({ structured, image_observation: imageAnalysis ?? null });
  try {
    const text = await claudeChat({ system: REASONING_SYSTEM, content: payload });
    if (!text) throw new Error("Claude returned an empty assessment");
    return { text, provider: `Claude (${CLAUDE_MODEL})`, fallback: false };
  } catch (error) {
    console.error(
      `[provider-fallback] Symptom reasoning did NOT use Claude — falling back to Gemini. Reason: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    const text = await callGemini(payload, REASONING_SYSTEM);
    return { text, provider: `Gemini (${MODEL}) — Claude fallback`, fallback: true };
  }
}

/* ---------------- Critical-condition escalation check (Claude) ---------------- */

export type CriticalCheck = {
  critical: boolean;
  reason: string | null;
  provider: string;
  fallback: boolean;
};

const CRITICAL_SYSTEM = `You are a conservative clinical safety checker for a rural triage system.
Decide ONLY whether the described presentation shows signs of a potentially life-threatening or rapidly deteriorating condition that must be seen urgently.
Return ONLY JSON: {"critical":boolean,"reason":string}
"reason" is max 20 words, plain language, citing the specific finding. If nothing critical is present, set critical=false and reason="".
Never diagnose, never name a triage colour, never recommend medicines.`;

/**
 * Advisory only: this can raise the deterministic tier, never lower it.
 */
export async function criticalConditionCheck(
  structured: StructuredSummary,
  symptomsText: string,
  imageAnalysis?: string | null,
): Promise<CriticalCheck> {
  const payload = JSON.stringify({
    structured,
    raw_symptoms: symptomsText,
    image_observation: imageAnalysis ?? null,
  });
  try {
    const raw = await claudeChat({ system: CRITICAL_SYSTEM, content: payload, maxTokens: 300 });
    const parsed = parseJson<{ critical?: boolean; reason?: string }>(raw, {});
    return {
      critical: parsed.critical === true,
      reason: parsed.reason?.trim() || null,
      provider: `Claude (${CLAUDE_MODEL})`,
      fallback: false,
    };
  } catch (error) {
    console.error(
      `[provider-fallback] Critical-condition check did NOT use Claude — falling back to Gemini. Reason: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    const raw = await callGemini(payload, CRITICAL_SYSTEM, true);
    const parsed = parseJson<{ critical?: boolean; reason?: string }>(raw, {});
    return {
      critical: parsed.critical === true,
      reason: parsed.reason?.trim() || null,
      provider: `Gemini (${MODEL}) — Claude fallback`,
      fallback: true,
    };
  }
}

/* ---------------- Step 3: deterministic risk scoring ---------------- */

export type RiskResult = { tier: "RED" | "YELLOW" | "GREEN"; rules: string[] };

export type ConditionContext = {
  chronic: ChronicCondition[];
  pregnancy: PregnancyStatus | null;
};

const TIERS = ["GREEN", "YELLOW", "RED"] as const;

function escalate(tier: RiskResult["tier"]): RiskResult["tier"] {
  const i = TIERS.indexOf(tier);
  return TIERS[Math.min(i + 1, TIERS.length - 1)]!;
}

const PREGNANCY_RED_FLAGS = ["severe headache", "swelling", "high blood pressure", "reduced fetal movement", "bleeding"];

/**
 * Deterministic condition-aware modifiers layered on top of the vitals/symptom rules.
 * Never LLM-driven: chronic conditions can only raise the tier, never lower it.
 */
export function applyConditionModifiers(
  base: RiskResult,
  ctx: ConditionContext,
  symptomsText: string,
): RiskResult {
  let tier = base.tier;
  const rules = [...base.rules];
  const text = symptomsText.toLowerCase();

  const preg = ctx.pregnancy;
  if (preg?.status === "Pregnant" && (preg.trimester === "2nd" || preg.trimester === "3rd")) {
    const reported = (preg.symptoms ?? []).map((s) => s.toLowerCase());
    const flagged = PREGNANCY_RED_FLAGS.filter(
      (flag) => reported.some((s) => s.includes(flag)) || text.includes(flag),
    );
    if (flagged.length > 0) {
      tier = "RED";
      rules.push(`Pregnancy (${preg.trimester} trimester) + ${flagged.join(", ")} — escalated to RED`);
    }
  }

  if (hasCondition(ctx.chronic, "diabet")) {
    const wound = ["wound", "injury", "cut", "burn", "ulcer", "sore", "skin", "rash", "blister", "infection"].filter((w) =>
      text.includes(w),
    );
    if (wound.length > 0) {
      const next = escalate(tier);
      if (next !== tier) rules.push(`Diabetes on file + ${wound[0]} reported — escalated to ${next} (slower healing, higher infection risk)`);
      else rules.push(`Diabetes on file + ${wound[0]} reported — already at highest tier`);
      tier = next;
    }
  }

  if (hasCondition(ctx.chronic, "thyroid")) {
    const thyroid = ["palpitation", "heart rate", "rapid heartbeat", "weight loss", "weight gain", "fatigue", "tired"].filter(
      (w) => text.includes(w),
    );
    if (thyroid.length > 0) {
      const next = escalate(tier);
      if (next !== tier) rules.push(`Thyroid disorder on file + ${thyroid[0]} — escalated to ${next} (may mask or mimic other conditions)`);
      else rules.push(`Thyroid disorder on file + ${thyroid[0]} — already at highest tier`);
      tier = next;
    }
  }

  const congenital = ctx.chronic.find((c) => /congenital|birth condition/i.test(c.condition_name));
  if (congenital) {
    const note = `${congenital.condition_name} ${congenital.diagnosed_note ?? ""} ${congenital.medication_name ?? ""}`.toLowerCase();
    const systems: Array<[string, string[]]> = [
      ["cardiac", ["chest", "palpitation", "heart", "cyanosis", "breathless", "fainting"]],
      ["respiratory", ["breath", "cough", "wheeze", "chest"]],
      ["neurological", ["seizure", "headache", "fits", "unconscious", "weakness"]],
      ["renal", ["urine", "urination", "swelling", "kidney"]],
    ];
    for (const [system, words] of systems) {
      const known = note.includes(system) || words.some((w) => note.includes(w));
      const match = words.find((w) => text.includes(w));
      if (known && match) {
        tier = "RED";
        rules.push(`Congenital condition on file (${congenital.condition_name}) + ${system} symptom "${match}" — escalated to RED`);
        break;
      }
    }
  }

  return { tier, rules };
}

/* ---------------- Condition-aware suggestion guardrails ---------------- */

/** Returns a caution note when a medicine/remedy may be unsafe for a flagged condition. */
export function suggestionGuardrail(
  suggestion: string,
  ctx: ConditionContext,
): string | null {
  const s = suggestion.toLowerCase();
  if (ctx.pregnancy?.status === "Pregnant" || ctx.pregnancy?.status === "Not Sure") {
    if (/pregnan|nursing mother|teratogen|fetal|first trimester/.test(s)) {
      return "Suggestion withheld — patient's pregnancy status may require doctor-specific guidance for this medicine/remedy.";
    }
  }
  if (hasCondition(ctx.chronic, "diabet") && /sugar|honey|jaggery|syrup|molasses|sweet/.test(s)) {
    return "Suggestion withheld — patient's diabetes may require doctor-specific guidance for this medicine/remedy.";
  }
  if (hasCondition(ctx.chronic, "hypertension") && /salt|sodium|liquorice|licorice|pseudoephedrine/.test(s)) {
    return "Suggestion withheld — patient's hypertension may require doctor-specific guidance for this medicine/remedy.";
  }
  if (hasCondition(ctx.chronic, "kidney") && /nsaid|ibuprofen|renal|kidney/.test(s)) {
    return "Suggestion withheld — patient's kidney disease may require doctor-specific guidance for this medicine/remedy.";
  }
  if (hasCondition(ctx.chronic, "asthma") && /aspirin|nsaid|bronchospasm/.test(s)) {
    return "Suggestion withheld — patient's asthma may require doctor-specific guidance for this medicine/remedy.";
  }
  return null;
}

/* ---------------- Relevant medical history alerts (cautious, non-directive) ---------------- */

export type HistoryAlert = { condition: string; note: string };

export async function historyAlerts(
  ctx: ConditionContext,
  symptomsText: string,
  contributingRules: string[],
): Promise<HistoryAlert[]> {
  const items = [
    ...ctx.chronic.map((c) => c.condition_name),
    ...(ctx.pregnancy && ctx.pregnancy.status !== "Not Pregnant"
      ? [`Pregnancy — ${ctx.pregnancy.status}${ctx.pregnancy.trimester ? ` (${ctx.pregnancy.trimester} trimester)` : ""}`]
      : []),
  ];
  if (items.length === 0) return [];

  const fallback = items.map((condition) => ({
    condition,
    note: `${condition} is on file for this patient — please consider how it may interact with the current presentation.`,
  }));

  try {
    const raw = await callGemini(
      JSON.stringify({ conditions: items, symptoms: symptomsText, triggered_rules: contributingRules }),
      `For each listed chronic condition or pregnancy status, write ONE short sentence (max 25 words) of cautious clinical CONTEXT for a doctor explaining why it may be relevant to the reported symptoms.
Return ONLY JSON: {"alerts":[{"condition":string,"note":string}]}
Rules: never diagnose, never give a directive or treatment instruction, never assign a risk tier. Phrase as context that defers to the doctor's judgment.`,
      true,
    );
    const parsed = parseJson<{ alerts?: HistoryAlert[] }>(raw, {});
    const alerts = (parsed.alerts ?? []).filter((a) => a?.condition && a?.note);
    return alerts.length > 0 ? alerts : fallback;
  } catch {
    return fallback;
  }
}

export function scoreRisk(structured: StructuredSummary, symptomsText: string): RiskResult {
  const rules: string[] = [];
  const text = `${symptomsText} ${structured.symptoms.join(" ")}`.toLowerCase();
  const v = structured.vitals;
  const age = structured.age ?? 0;

  if (typeof v.spo2 === "number" && v.spo2 < 92) {
    rules.push(`SpO2 ${v.spo2}% — below safe threshold (92%)`);
  }
  if (typeof v.temp === "number" && v.temp > 39.5 && age > 60) {
    rules.push(`Temperature ${v.temp}°C with age ${age} — high fever in elderly patient`);
  }
  for (const flag of ["chest pain", "difficulty breathing", "breathless", "shortness of breath", "unconscious", "seizure"]) {
    if (text.includes(flag)) rules.push(`Red-flag symptom reported: "${flag}"`);
  }
  if (typeof v.pulse === "number" && (v.pulse > 130 || v.pulse < 45)) {
    rules.push(`Pulse ${v.pulse} bpm — outside safe range (45–130)`);
  }
  // Blood pressure: parse "sys/dia" and flag crisis-level readings
  const bpMatch = typeof v.bp === "string" ? v.bp.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/) : null;
  if (bpMatch) {
    const sys = Number(bpMatch[1]);
    const dia = Number(bpMatch[2]);
    if (sys >= 180 || dia >= 120) {
      rules.push(`Blood pressure ${v.bp} — hypertensive crisis (sys ≥ 180 or dia ≥ 120)`);
    } else if (sys < 90) {
      rules.push(`Blood pressure ${v.bp} — severe hypotension (sys < 90)`);
    }
  }
  if (rules.length > 0) return { tier: "RED", rules };

  const durationDays = extractDays(structured.duration);
  const prolonged = durationDays !== null && durationDays > 3;

  // Concern signals that can pair with a prolonged duration.
  const feverSignal =
    (typeof v.temp === "number" && v.temp >= 38) || /\bfever\b|\bpyrexia\b|high temperature/.test(text);
  const worsening = /worsen|getting worse|deteriorat|not improving|no improvement|increasing|aggravat/.test(text);
  const abnormalVitals =
    (typeof v.spo2 === "number" && v.spo2 < 95) ||
    (typeof v.temp === "number" && v.temp >= 38) ||
    (typeof v.pulse === "number" && (v.pulse > 110 || v.pulse < 50));

  // Duration alone is NOT a YELLOW trigger: it must be paired with a genuine concern signal.
  if (prolonged) {
    if (feverSignal) {
      rules.push(`Fever persisting ${durationDays} days — fever beyond the 3-day threshold`);
    } else if (worsening) {
      rules.push(`Symptoms persisting ${durationDays} days and reported as worsening`);
    } else if (abnormalVitals) {
      rules.push(`Symptoms persisting ${durationDays} days with vitals trending abnormal`);
    }
  }
  if (typeof v.temp === "number" && v.temp >= 38.5) {
    rules.push(`Temperature ${v.temp}°C — moderate fever`);
  }
  if (typeof v.spo2 === "number" && v.spo2 >= 92 && v.spo2 < 95) {
    rules.push(`SpO2 ${v.spo2}% — borderline oxygen saturation`);
  }
  // Blood pressure: elevated (not crisis) triggers YELLOW
  if (bpMatch) {
    const sys = Number(bpMatch[1]);
    const dia = Number(bpMatch[2]);
    if (sys >= 140 || dia >= 90) {
      rules.push(`Blood pressure ${v.bp} — elevated (sys ≥ 140 or dia ≥ 90)`);
    }
  }
  for (const flag of ["vomiting", "dehydration", "blood", "severe"]) {
    if (text.includes(flag)) rules.push(`Moderate-severity indicator: "${flag}"`);
  }
  if (rules.length > 0) return { tier: "YELLOW", rules };

  const greenRules = ["No red-flag vitals or symptoms detected; vitals within safe ranges"];
  if (prolonged) {
    greenRules.push(
      `Symptoms present ${durationDays} days, but no fever, no reported worsening and vitals normal — duration alone does not raise the tier`,
    );
  }
  return { tier: "GREEN", rules: greenRules };
}

function extractDays(duration: string): number | null {
  if (!duration) return null;
  const d = duration.toLowerCase();
  const num = Number(d.match(/(\d+(?:\.\d+)?)/)?.[1]);
  if (!Number.isFinite(num)) return null;
  if (d.includes("week")) return num * 7;
  if (d.includes("month")) return num * 30;
  if (d.includes("hour")) return num / 24;
  return num;
}

/* ---------------- Step 4: protocol lookup (GREEN only) ---------------- */

export async function lookupProtocol(structured: StructuredSummary, symptomsText: string) {
  const { data } = await supabaseAdmin
    .from("first_aid_protocols")
    .select("condition_name, keywords, otc_medicine, protocol_text");
  if (!data) return null;

  const text = `${symptomsText} ${structured.symptoms.join(" ")}`.toLowerCase();
  let best: (typeof data)[number] | null = null;
  let bestScore = 0;
  for (const row of data) {
    const score = (row.keywords ?? []).filter((k) => text.includes(k.toLowerCase())).length;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

/* ---------------- Step 4b: Ayurvedic / home remedy lookup (GREEN only) ---------------- */

export async function lookupAyurvedic(structured: StructuredSummary, symptomsText: string) {
  const { data } = await supabaseAdmin
    .from("ayurvedic_protocols")
    .select("condition_name, keywords, remedy_text, source_reference");
  if (!data) return null;

  const text = `${symptomsText} ${structured.symptoms.join(" ")}`.toLowerCase();
  let best: (typeof data)[number] | null = null;
  let bestScore = 0;
  for (const row of data) {
    const score = (row.keywords ?? []).filter((k) => text.includes(k.toLowerCase())).length;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

/* ---------------- Step 5: OpenFDA drug safety (GREEN only) ---------------- */

export type DrugSafety = {
  medicine: string;
  contraindications?: string | undefined;
  pediatric_use?: string | undefined;
  geriatric_use?: string | undefined;
  warnings?: string | undefined;
  source: string;
  note?: string | undefined;
};

export async function fetchDrugSafety(medicine: string): Promise<DrugSafety | null> {
  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(
      medicine,
    )}"&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      return { medicine, source: "openFDA", note: "No OpenFDA label record found for this medicine." };
    }
    const json = (await res.json()) as { results?: Array<Record<string, string[]>> };
    const r = json.results?.[0];
    if (!r) {
      return { medicine, source: "openFDA", note: "No OpenFDA label record found for this medicine." };
    }
    const pick = (k: string) => (r[k]?.[0] ? r[k][0].slice(0, 600) : undefined);
    return {
      medicine,
      contraindications: pick("contraindications"),
      pediatric_use: pick("pediatric_use"),
      geriatric_use: pick("geriatric_use"),
      warnings: pick("warnings") ?? pick("warnings_and_cautions"),
      source: "openFDA drug label API",
    };
  } catch {
    return { medicine, source: "openFDA", note: "Drug safety lookup unavailable." };
  }
}