/**
 * Tests for client-side vital-range validation.
 * These warnings appear in real-time as the health worker types vitals,
 * flagging abnormal values before submission.
 */
import { describe, it, expect } from "vitest";
import { validateVitals, type VitalWarning } from "./vitals";

function findWarning(warnings: VitalWarning[], field: string): VitalWarning | undefined {
  return warnings.find((w) => w.field === field);
}

describe("validateVitals — temperature", () => {
  it("returns emergency for temp >= 39.5", () => {
    const result = validateVitals({ temp: 39.5 });
    const w = findWarning(result, "temp");
    expect(w).toBeDefined();
    expect(w!.level).toBe("emergency");
  });

  it("returns verify for impossibly low temp", () => {
    const result = validateVitals({ temp: 28 });
    const w = findWarning(result, "temp");
    expect(w).toBeDefined();
    expect(w!.level).toBe("verify");
  });

  it("returns verify for impossibly high temp", () => {
    const result = validateVitals({ temp: 44 });
    const w = findWarning(result, "temp");
    expect(w).toBeDefined();
    expect(w!.level).toBe("verify");
  });

  it("returns no warning for normal temp", () => {
    const result = validateVitals({ temp: 37.0 });
    expect(findWarning(result, "temp")).toBeUndefined();
  });

  it("returns no warning for null temp", () => {
    const result = validateVitals({ temp: null });
    expect(findWarning(result, "temp")).toBeUndefined();
  });
});

describe("validateVitals — SpO2", () => {
  it("returns emergency for SpO2 < 92", () => {
    const result = validateVitals({ spo2: 88 });
    const w = findWarning(result, "spo2");
    expect(w).toBeDefined();
    expect(w!.level).toBe("emergency");
  });

  it("returns verify for SpO2 > 100", () => {
    const result = validateVitals({ spo2: 105 });
    const w = findWarning(result, "spo2");
    expect(w).toBeDefined();
    expect(w!.level).toBe("verify");
  });

  it("returns verify for SpO2 < 50 (likely misread)", () => {
    const result = validateVitals({ spo2: 30 });
    const w = findWarning(result, "spo2");
    expect(w).toBeDefined();
    expect(w!.level).toBe("verify");
  });

  it("returns no warning for normal SpO2", () => {
    const result = validateVitals({ spo2: 98 });
    expect(findWarning(result, "spo2")).toBeUndefined();
  });
});

describe("validateVitals — pulse", () => {
  it("returns emergency for pulse > 130", () => {
    const result = validateVitals({ pulse: 145 });
    const w = findWarning(result, "pulse");
    expect(w).toBeDefined();
    expect(w!.level).toBe("emergency");
  });

  it("returns emergency for pulse < 45", () => {
    const result = validateVitals({ pulse: 40 });
    const w = findWarning(result, "pulse");
    expect(w).toBeDefined();
    expect(w!.level).toBe("emergency");
  });

  it("returns verify for pulse < 20 (likely misread)", () => {
    const result = validateVitals({ pulse: 10 });
    const w = findWarning(result, "pulse");
    expect(w).toBeDefined();
    expect(w!.level).toBe("verify");
  });

  it("returns no warning for normal pulse", () => {
    const result = validateVitals({ pulse: 72 });
    expect(findWarning(result, "pulse")).toBeUndefined();
  });
});

describe("validateVitals — blood pressure", () => {
  it("returns emergency for hypertensive crisis (sys >= 180)", () => {
    const result = validateVitals({ bp: "190/100" });
    const w = findWarning(result, "bp");
    expect(w).toBeDefined();
    expect(w!.level).toBe("emergency");
  });

  it("returns emergency for hypertensive crisis (dia >= 120)", () => {
    const result = validateVitals({ bp: "160/125" });
    const w = findWarning(result, "bp");
    expect(w).toBeDefined();
    expect(w!.level).toBe("emergency");
  });

  it("returns emergency for hypotension (sys < 90)", () => {
    const result = validateVitals({ bp: "85/60" });
    const w = findWarning(result, "bp");
    expect(w).toBeDefined();
    expect(w!.level).toBe("emergency");
  });

  it("returns verify for malformed BP", () => {
    const result = validateVitals({ bp: "120" });
    const w = findWarning(result, "bp");
    expect(w).toBeDefined();
    expect(w!.level).toBe("verify");
  });

  it("returns verify for impossible BP (dia > sys)", () => {
    const result = validateVitals({ bp: "80/120" });
    const w = findWarning(result, "bp");
    expect(w).toBeDefined();
    expect(w!.level).toBe("verify");
  });

  it("returns no warning for normal BP", () => {
    const result = validateVitals({ bp: "120/80" });
    expect(findWarning(result, "bp")).toBeUndefined();
  });

  it("returns no warning for null BP", () => {
    const result = validateVitals({ bp: null });
    expect(findWarning(result, "bp")).toBeUndefined();
  });
});

describe("validateVitals — age", () => {
  it("returns verify for negative age", () => {
    const result = validateVitals({ age: -1 });
    expect(findWarning(result, "age")).toBeDefined();
  });

  it("returns verify for age > 120", () => {
    const result = validateVitals({ age: 150 });
    expect(findWarning(result, "age")).toBeDefined();
  });

  it("returns no warning for reasonable age", () => {
    const result = validateVitals({ age: 35 });
    expect(findWarning(result, "age")).toBeUndefined();
  });
});
