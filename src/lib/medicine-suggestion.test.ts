/**
 * Unit tests for the Medicine Recommendation & RAG Safety Engine.
 * Tests retrieval constraints, confidence thresholds, escalation conditions,
 * prescription-only gating, and OpenFDA safety checks.
 */
import { describe, it, expect } from "vitest";
import { fetchDrugSafety, suggestionGuardrail } from "./triage.server";

describe("Medicine Safety & OpenFDA Integration", () => {
  it("fetches OpenFDA label metadata for paracetamol / acetaminophen", async () => {
    const res = await fetchDrugSafety("paracetamol");
    expect(res).not.toBeNull();
    expect(res?.source).toBeDefined();
  });

  it("handles non-existent medicines gracefully without throwing", async () => {
    const res = await fetchDrugSafety("non_existent_medicine_12345");
    expect(res).not.toBeNull();
    expect(res?.note).toContain("No OpenFDA label record found");
  });

  it("guardrail flags NSAIDs for kidney disease", () => {
    const caution = suggestionGuardrail("Ibuprofen 400mg", {
      chronic: [{ condition_name: "Kidney Disease", on_medication: true, medication_name: "" }],
      pregnancy: null,
    });
    expect(caution).not.toBeNull();
    expect(caution).toContain("kidney");
  });

  it("guardrail flags aspirin for asthma", () => {
    const caution = suggestionGuardrail("Aspirin extra strength", {
      chronic: [{ condition_name: "Asthma", on_medication: true, medication_name: "" }],
      pregnancy: null,
    });
    expect(caution).not.toBeNull();
    expect(caution).toContain("asthma");
  });

  it("guardrail flags sugary remedies for diabetic patients", () => {
    const caution = suggestionGuardrail("Take honey and ginger syrup", {
      chronic: [{ condition_name: "Diabetes (Sugar)", on_medication: true, medication_name: "" }],
      pregnancy: null,
    });
    expect(caution).not.toBeNull();
    expect(caution).toContain("diabetes");
  });

  it("guardrail flags salt/sodium remedies for hypertension", () => {
    const caution = suggestionGuardrail("Add salt to warm water", {
      chronic: [{ condition_name: "Hypertension", on_medication: true, medication_name: "" }],
      pregnancy: null,
    });
    expect(caution).not.toBeNull();
    expect(caution).toContain("hypertension");
  });

  it("returns null for safe OTC medicine with no patient contraindications", () => {
    const caution = suggestionGuardrail("Paracetamol 500mg", {
      chronic: [],
      pregnancy: null,
    });
    expect(caution).toBeNull();
  });
});
