/**
 * Tests for the home-monitoring escalation engine.
 * This runs when a patient logs daily vitals/symptoms and detects worsening
 * trends that require immediate attention.
 */
import { describe, it, expect } from "vitest";
import { checkEscalation, type TrackerRow } from "./escalation";

function makeRow(overrides: Partial<TrackerRow> = {}): TrackerRow {
  return {
    entry_date: new Date().toISOString(),
    temperature: null,
    pulse: null,
    spo2: null,
    severity_score: 3,
    ...overrides,
  };
}

describe("checkEscalation — RED rules", () => {
  it("returns RED for SpO2 < 92", () => {
    const result = checkEscalation(makeRow({ spo2: 88 }), []);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("RED");
    expect(result!.reasons.some((r) => r.includes("SpO2 88%"))).toBe(true);
  });

  it("returns RED for SpO2 drop > 4 points", () => {
    const prev = makeRow({ spo2: 97 });
    const current = makeRow({ spo2: 92 }); // drop of 5
    const result = checkEscalation(current, [prev]);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("RED");
    expect(result!.reasons.some((r) => r.includes("dropped"))).toBe(true);
  });

  it("returns RED for pulse > 130", () => {
    const result = checkEscalation(makeRow({ pulse: 140 }), []);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("RED");
  });

  it("returns RED for pulse < 45", () => {
    const result = checkEscalation(makeRow({ pulse: 38 }), []);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("RED");
  });
});

describe("checkEscalation — YELLOW rules", () => {
  it("returns YELLOW for fever >= 38°C on 3 consecutive days", () => {
    const day1 = makeRow({ temperature: 38.2 });
    const day2 = makeRow({ temperature: 38.5 });
    const current = makeRow({ temperature: 38.1 });
    const result = checkEscalation(current, [day2, day1]);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("YELLOW");
    expect(result!.reasons.some((r) => r.includes("Fever"))).toBe(true);
  });

  it("does NOT trigger YELLOW fever with only 2 days of data", () => {
    const day1 = makeRow({ temperature: 38.5 });
    const current = makeRow({ temperature: 38.2 });
    const result = checkEscalation(current, [day1]);
    // Only 2 entries, needs 3
    if (result) {
      expect(result.reasons.every((r) => !r.includes("Fever"))).toBe(true);
    }
  });

  it("returns YELLOW for severity rising over 3 consecutive logs", () => {
    const day1 = makeRow({ severity_score: 3 });
    const day2 = makeRow({ severity_score: 5 });
    const current = makeRow({ severity_score: 7 });
    const result = checkEscalation(current, [day2, day1]);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("YELLOW");
    expect(result!.reasons.some((r) => r.includes("severity"))).toBe(true);
  });

  it("does NOT trigger severity rising if trend is flat", () => {
    const day1 = makeRow({ severity_score: 5 });
    const day2 = makeRow({ severity_score: 5 });
    const current = makeRow({ severity_score: 5 });
    const result = checkEscalation(current, [day2, day1]);
    if (result) {
      expect(result.reasons.every((r) => !r.includes("severity"))).toBe(true);
    }
  });

  it("returns YELLOW for borderline SpO2 (92–94)", () => {
    const result = checkEscalation(makeRow({ spo2: 93 }), []);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("YELLOW");
    expect(result!.reasons.some((r) => r.includes("borderline"))).toBe(true);
  });
});

describe("checkEscalation — null (no escalation)", () => {
  it("returns null when everything is normal", () => {
    const current = makeRow({ temperature: 37.0, pulse: 72, spo2: 98, severity_score: 2 });
    const prev = makeRow({ temperature: 37.1, pulse: 70, spo2: 98, severity_score: 2 });
    const result = checkEscalation(current, [prev]);
    expect(result).toBeNull();
  });

  it("returns null with no history", () => {
    const result = checkEscalation(makeRow({ spo2: 98, pulse: 72 }), []);
    expect(result).toBeNull();
  });
});
