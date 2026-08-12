/**
 * Tests for the deterministic triage risk scoring engine.
 *
 * These functions make life-safety decisions: RED means "refer to hospital
 * immediately", GREEN means "first-aid protocol is safe". A bug here could
 * cause a critical patient to be triaged as GREEN or vice versa.
 *
 * Every hardcoded rule in scoreRisk and applyConditionModifiers must have
 * at least one explicit test case.
 */
import { describe, it, expect } from "vitest";
import {
  scoreRisk,
  applyConditionModifiers,
  suggestionGuardrail,
  sanitizeText,
  type StructuredSummary,
  type RiskResult,
} from "./triage.server";

describe("sanitizeText", () => {
  it("strips control characters and truncates text", () => {
    const raw = "  Hello\x00 World!\x07  ";
    expect(sanitizeText(raw, 10)).toBe("Hello Worl");
    expect(sanitizeText(raw, 5)).toBe("Hello");
  });

  it("handles null/undefined gracefully", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
  });
});

/* ---------- helpers ---------- */

function makeSummary(overrides: Partial<StructuredSummary> = {}): StructuredSummary {
  return {
    symptoms: [],
    duration: "",
    age: 30,
    vitals: { temp: null, bp: null, pulse: null, spo2: null },
    history: "",
    detected_language: "English",
    ...overrides,
  };
}

/* ============================================================
 * scoreRisk — RED tier rules
 * ============================================================ */

describe("scoreRisk — RED tier", () => {
  it("triggers RED when SpO2 < 92", () => {
    const result = scoreRisk(makeSummary({ vitals: { spo2: 88 } }), "cough");
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("SpO2 88%"))).toBe(true);
  });

  it("triggers RED when SpO2 is exactly 91 (boundary)", () => {
    const result = scoreRisk(makeSummary({ vitals: { spo2: 91 } }), "");
    expect(result.tier).toBe("RED");
  });

  it("does NOT trigger RED when SpO2 is exactly 92 (boundary safe side)", () => {
    const result = scoreRisk(makeSummary({ vitals: { spo2: 92 } }), "");
    // 92 is borderline YELLOW, not RED
    expect(result.tier).not.toBe("RED");
  });

  it("triggers RED for high fever (>39.5°C) in elderly (age >60)", () => {
    const result = scoreRisk(makeSummary({ age: 65, vitals: { temp: 40.1 } }), "fever");
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("elderly"))).toBe(true);
  });

  it("does NOT trigger RED for high fever in young patient", () => {
    const result = scoreRisk(makeSummary({ age: 25, vitals: { temp: 40.1 } }), "fever");
    // High temp alone in young patient is YELLOW (moderate fever), not RED
    expect(result.tier).not.toBe("RED");
  });

  it("triggers RED for 'chest pain' in symptoms text", () => {
    const result = scoreRisk(makeSummary(), "severe chest pain since morning");
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("chest pain"))).toBe(true);
  });

  it("triggers RED for 'difficulty breathing'", () => {
    const result = scoreRisk(makeSummary(), "patient has difficulty breathing");
    expect(result.tier).toBe("RED");
  });

  it("triggers RED for 'breathless'", () => {
    const result = scoreRisk(makeSummary(), "feeling breathless and dizzy");
    expect(result.tier).toBe("RED");
  });

  it("triggers RED for 'shortness of breath'", () => {
    const result = scoreRisk(makeSummary(), "shortness of breath while walking");
    expect(result.tier).toBe("RED");
  });

  it("triggers RED for 'unconscious'", () => {
    const result = scoreRisk(makeSummary(), "patient found unconscious");
    expect(result.tier).toBe("RED");
  });

  it("triggers RED for 'seizure'", () => {
    const result = scoreRisk(makeSummary(), "had a seizure at home");
    expect(result.tier).toBe("RED");
  });

  it("triggers RED for pulse > 130", () => {
    const result = scoreRisk(makeSummary({ vitals: { pulse: 145 } }), "");
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("Pulse 145"))).toBe(true);
  });

  it("triggers RED for pulse < 45", () => {
    const result = scoreRisk(makeSummary({ vitals: { pulse: 38 } }), "");
    expect(result.tier).toBe("RED");
  });

  it("does NOT trigger RED for pulse exactly 45 (boundary)", () => {
    const result = scoreRisk(makeSummary({ vitals: { pulse: 45 } }), "");
    expect(result.tier).not.toBe("RED");
  });

  it("does NOT trigger RED for pulse exactly 130 (boundary)", () => {
    const result = scoreRisk(makeSummary({ vitals: { pulse: 130 } }), "");
    expect(result.tier).not.toBe("RED");
  });

  it("triggers RED for multiple red flags simultaneously", () => {
    const result = scoreRisk(
      makeSummary({ vitals: { spo2: 85, pulse: 140 } }),
      "chest pain and difficulty breathing"
    );
    expect(result.tier).toBe("RED");
    expect(result.rules.length).toBeGreaterThanOrEqual(3);
  });

  it("detects red-flag keywords from the structured symptoms array too", () => {
    const result = scoreRisk(
      makeSummary({ symptoms: ["chest pain", "nausea"] }),
      ""
    );
    expect(result.tier).toBe("RED");
  });

  it("triggers RED for hypertensive crisis (sys >= 180)", () => {
    const result = scoreRisk(makeSummary({ vitals: { bp: "200/100" } }), "headache");
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("hypertensive crisis"))).toBe(true);
  });

  it("triggers RED for hypertensive crisis (dia >= 120)", () => {
    const result = scoreRisk(makeSummary({ vitals: { bp: "160/125" } }), "");
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("hypertensive crisis"))).toBe(true);
  });

  it("triggers RED for severe hypotension (sys < 90)", () => {
    const result = scoreRisk(makeSummary({ vitals: { bp: "80/50" } }), "");
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("hypotension"))).toBe(true);
  });

  it("does NOT trigger RED for moderately elevated BP", () => {
    const result = scoreRisk(makeSummary({ vitals: { bp: "150/95" } }), "");
    expect(result.tier).not.toBe("RED");
  });
});

/* ============================================================
 * scoreRisk — YELLOW tier rules
 * ============================================================ */

describe("scoreRisk — YELLOW tier", () => {
  it("triggers YELLOW for symptoms persisting > 3 days", () => {
    const result = scoreRisk(makeSummary({ duration: "5 days" }), "mild cough");
    expect(result.tier).toBe("YELLOW");
    expect(result.rules.some((r) => r.includes("5 days"))).toBe(true);
  });

  it("triggers YELLOW for 1 week duration (converted to 7 days)", () => {
    const result = scoreRisk(makeSummary({ duration: "1 week" }), "runny nose");
    expect(result.tier).toBe("YELLOW");
  });

  it("triggers YELLOW for moderate fever (>= 38.5°C)", () => {
    const result = scoreRisk(makeSummary({ vitals: { temp: 38.5 } }), "");
    expect(result.tier).toBe("YELLOW");
    expect(result.rules.some((r) => r.includes("moderate fever"))).toBe(true);
  });

  it("triggers YELLOW for borderline SpO2 (92–94)", () => {
    const result = scoreRisk(makeSummary({ vitals: { spo2: 93 } }), "");
    expect(result.tier).toBe("YELLOW");
    expect(result.rules.some((r) => r.includes("borderline"))).toBe(true);
  });

  it("triggers YELLOW for 'vomiting' keyword", () => {
    const result = scoreRisk(makeSummary(), "nausea and vomiting since morning");
    expect(result.tier).toBe("YELLOW");
  });

  it("triggers YELLOW for 'dehydration' keyword", () => {
    const result = scoreRisk(makeSummary(), "signs of dehydration");
    expect(result.tier).toBe("YELLOW");
  });

  it("triggers YELLOW for 'blood' keyword", () => {
    const result = scoreRisk(makeSummary(), "blood in stool");
    expect(result.tier).toBe("YELLOW");
  });

  it("triggers YELLOW for 'severe' keyword", () => {
    const result = scoreRisk(makeSummary(), "severe body ache");
    expect(result.tier).toBe("YELLOW");
  });

  it("triggers YELLOW for 'persistent' keyword", () => {
    const result = scoreRisk(makeSummary(), "persistent cough");
    expect(result.tier).toBe("YELLOW");
  });

  it("does NOT trigger YELLOW for exactly 3-day duration (boundary)", () => {
    const result = scoreRisk(makeSummary({ duration: "3 days" }), "mild cold");
    // 3 days is NOT > 3, so this should be GREEN (assuming no other triggers)
    expect(result.tier).toBe("GREEN");
  });

  it("handles duration in months (1 month = 30 days)", () => {
    const result = scoreRisk(makeSummary({ duration: "1 month" }), "back pain");
    expect(result.tier).toBe("YELLOW");
  });

  it("handles duration in hours (no YELLOW trigger for < 72 hours)", () => {
    const result = scoreRisk(makeSummary({ duration: "12 hours" }), "headache");
    expect(result.tier).toBe("GREEN");
  });

  it("triggers YELLOW for elevated BP (sys >= 140)", () => {
    const result = scoreRisk(makeSummary({ vitals: { bp: "145/85" } }), "headache");
    expect(result.tier).toBe("YELLOW");
    expect(result.rules.some((r) => r.includes("elevated"))).toBe(true);
  });

  it("triggers YELLOW for elevated BP (dia >= 90)", () => {
    const result = scoreRisk(makeSummary({ vitals: { bp: "130/95" } }), "");
    expect(result.tier).toBe("YELLOW");
    expect(result.rules.some((r) => r.includes("elevated"))).toBe(true);
  });
});

/* ============================================================
 * scoreRisk — GREEN tier
 * ============================================================ */

describe("scoreRisk — GREEN tier", () => {
  it("returns GREEN when all vitals normal and mild symptoms", () => {
    const result = scoreRisk(
      makeSummary({
        vitals: { temp: 37.0, pulse: 72, spo2: 98, bp: "120/80" },
        duration: "1 day",
      }),
      "mild headache"
    );
    expect(result.tier).toBe("GREEN");
    expect(result.rules.length).toBe(1);
    expect(result.rules[0]).toContain("No red-flag");
  });

  it("returns GREEN when all vitals are null (not measured)", () => {
    const result = scoreRisk(makeSummary(), "mild cold");
    expect(result.tier).toBe("GREEN");
  });

  it("returns GREEN when duration is empty", () => {
    const result = scoreRisk(makeSummary({ duration: "" }), "runny nose");
    expect(result.tier).toBe("GREEN");
  });
});

/* ============================================================
 * applyConditionModifiers — chronic condition escalation
 * ============================================================ */

describe("applyConditionModifiers — chronic conditions", () => {
  const baseGreen: RiskResult = { tier: "GREEN", rules: ["baseline"] };
  const baseYellow: RiskResult = { tier: "YELLOW", rules: ["baseline"] };
  const baseRed: RiskResult = { tier: "RED", rules: ["baseline"] };

  it("escalates GREEN → YELLOW for diabetic patient with wound", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [{ condition_name: "Diabetes (Sugar)", on_medication: true, medication_name: "Metformin" }],
        pregnancy: null,
      },
      "wound on left foot"
    );
    expect(result.tier).toBe("YELLOW");
    expect(result.rules.some((r) => r.includes("Diabetes"))).toBe(true);
  });

  it("escalates YELLOW → RED for diabetic patient with infection", () => {
    const result = applyConditionModifiers(
      { ...baseYellow },
      {
        chronic: [{ condition_name: "Diabetes (Sugar)", on_medication: false, medication_name: "" }],
        pregnancy: null,
      },
      "wound with possible infection"
    );
    expect(result.tier).toBe("RED");
  });

  it("does NOT lower tier for diabetic without wound keywords", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [{ condition_name: "Diabetes (Sugar)", on_medication: true, medication_name: "" }],
        pregnancy: null,
      },
      "mild headache"
    );
    expect(result.tier).toBe("GREEN");
  });

  it("escalates for thyroid + palpitation", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [{ condition_name: "Thyroid Disorder", on_medication: true, medication_name: "" }],
        pregnancy: null,
      },
      "palpitation and sweating"
    );
    expect(result.tier).toBe("YELLOW");
    expect(result.rules.some((r) => r.includes("Thyroid"))).toBe(true);
  });

  it("escalates for thyroid + fatigue", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [{ condition_name: "Thyroid Disorder", on_medication: false, medication_name: "" }],
        pregnancy: null,
      },
      "extreme fatigue for 2 days"
    );
    expect(result.tier).toBe("YELLOW");
  });

  it("never lowers an existing RED tier", () => {
    const result = applyConditionModifiers(
      { ...baseRed },
      { chronic: [], pregnancy: null },
      "mild headache"
    );
    expect(result.tier).toBe("RED");
  });
});

describe("applyConditionModifiers — pregnancy", () => {
  const baseGreen: RiskResult = { tier: "GREEN", rules: ["baseline"] };

  it("escalates to RED for pregnant (2nd trimester) + severe headache", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [],
        pregnancy: { status: "Pregnant", trimester: "2nd", symptoms: ["Severe headache"] },
      },
      "headache and blurred vision"
    );
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("Pregnancy") && r.includes("trimester"))).toBe(true);
  });

  it("escalates to RED for pregnant (3rd trimester) + bleeding", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [],
        pregnancy: { status: "Pregnant", trimester: "3rd", symptoms: ["Bleeding"] },
      },
      "light bleeding"
    );
    expect(result.tier).toBe("RED");
  });

  it("does NOT escalate for pregnant 1st trimester", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [],
        pregnancy: { status: "Pregnant", trimester: "1st", symptoms: ["Severe headache"] },
      },
      "mild nausea"
    );
    // 1st trimester is not checked by the modifier
    expect(result.tier).toBe("GREEN");
  });

  it("does NOT escalate for Not Pregnant status", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [],
        pregnancy: { status: "Not Pregnant", trimester: null, symptoms: [] },
      },
      "severe headache"
    );
    expect(result.tier).toBe("GREEN");
  });
});

describe("applyConditionModifiers — congenital conditions", () => {
  const baseGreen: RiskResult = { tier: "GREEN", rules: ["baseline"] };

  it("escalates to RED for congenital cardiac condition + chest symptom", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [
          {
            condition_name: "Congenital/Birth Condition",
            on_medication: true,
            medication_name: "",
            diagnosed_note: "cardiac defect since birth",
          },
        ],
        pregnancy: null,
      },
      "chest tightness"
    );
    expect(result.tier).toBe("RED");
    expect(result.rules.some((r) => r.includes("Congenital"))).toBe(true);
  });

  it("escalates to RED for congenital neurological condition + seizure", () => {
    const result = applyConditionModifiers(
      { ...baseGreen },
      {
        chronic: [
          {
            condition_name: "Congenital/Birth Condition",
            on_medication: false,
            medication_name: "",
            diagnosed_note: "neurological condition",
          },
        ],
        pregnancy: null,
      },
      "had a seizure"
    );
    expect(result.tier).toBe("RED");
  });
});

/* ============================================================
 * suggestionGuardrail — condition-aware medicine safety
 * ============================================================ */

describe("suggestionGuardrail", () => {
  it("withholds when pregnant and suggestion mentions pregnancy concerns", () => {
    const result = suggestionGuardrail("Contains warnings about pregnant or nursing mother use", {
      chronic: [],
      pregnancy: { status: "Pregnant", trimester: "2nd", symptoms: [] },
    });
    expect(result).not.toBeNull();
    expect(result).toContain("pregnancy");
  });

  it("withholds sugar-containing remedies for diabetic patients", () => {
    const result = suggestionGuardrail("Take honey mixed with warm water", {
      chronic: [{ condition_name: "Diabetes (Sugar)", on_medication: true, medication_name: "" }],
      pregnancy: null,
    });
    expect(result).not.toBeNull();
    expect(result).toContain("diabetes");
  });

  it("withholds NSAIDs for kidney disease patients", () => {
    const result = suggestionGuardrail("Ibuprofen 400mg twice daily", {
      chronic: [{ condition_name: "Kidney Disease", on_medication: true, medication_name: "" }],
      pregnancy: null,
    });
    expect(result).not.toBeNull();
  });

  it("withholds aspirin for asthma patients", () => {
    const result = suggestionGuardrail("Aspirin 325mg for pain relief", {
      chronic: [{ condition_name: "Asthma", on_medication: true, medication_name: "" }],
      pregnancy: null,
    });
    expect(result).not.toBeNull();
  });

  it("withholds salt/sodium advice for hypertensive patients", () => {
    const result = suggestionGuardrail("Add a pinch of salt to the solution", {
      chronic: [{ condition_name: "Hypertension", on_medication: true, medication_name: "" }],
      pregnancy: null,
    });
    expect(result).not.toBeNull();
  });

  it("returns null when no conditions conflict", () => {
    const result = suggestionGuardrail("Paracetamol 500mg for fever", {
      chronic: [],
      pregnancy: null,
    });
    expect(result).toBeNull();
  });
});
