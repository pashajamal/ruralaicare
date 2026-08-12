/**
 * Tests for the offline emergency detector.
 * This runs entirely in the browser when there is no internet, using
 * deterministic rules that mirror the server-side RED rules.
 */
import { describe, it, expect } from "vitest";
import { offlineEmergencyCheck } from "./offline";

describe("offlineEmergencyCheck", () => {
  it("flags SpO2 below 92%", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "",
      vitals: { temp: null, pulse: null, spo2: 88 },
      age: 30,
    });
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0]).toContain("SpO2");
  });

  it("flags pulse > 130", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "",
      vitals: { temp: null, pulse: 145, spo2: null },
      age: 30,
    });
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0]).toContain("Pulse");
  });

  it("flags pulse < 45", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "",
      vitals: { temp: null, pulse: 38, spo2: null },
      age: 30,
    });
    expect(flags.length).toBeGreaterThan(0);
  });

  it("flags high temp + elderly", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "",
      vitals: { temp: 40.0, pulse: null, spo2: null },
      age: 65,
    });
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0]).toContain("Temperature");
  });

  it("does NOT flag high temp for young patient", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "",
      vitals: { temp: 40.0, pulse: null, spo2: null },
      age: 25,
    });
    expect(flags.length).toBe(0);
  });

  it("flags chest pain keyword", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "severe chest pain since morning",
      vitals: { temp: null, pulse: null, spo2: null },
      age: 30,
    });
    expect(flags.some((f) => f.includes("chest pain"))).toBe(true);
  });

  it("flags difficulty breathing keyword", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "difficulty breathing at night",
      vitals: { temp: null, pulse: null, spo2: null },
      age: 30,
    });
    expect(flags.some((f) => f.includes("difficulty breathing"))).toBe(true);
  });

  it("flags seizure keyword", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "had a seizure",
      vitals: { temp: null, pulse: null, spo2: null },
      age: 30,
    });
    expect(flags.some((f) => f.includes("seizure"))).toBe(true);
  });

  it("flags unconscious keyword", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "found unconscious",
      vitals: { temp: null, pulse: null, spo2: null },
      age: 30,
    });
    expect(flags.some((f) => f.includes("unconscious"))).toBe(true);
  });

  it("returns empty array for normal vitals and mild symptoms", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "mild headache",
      vitals: { temp: 37.0, pulse: 72, spo2: 98 },
      age: 30,
    });
    expect(flags).toHaveLength(0);
  });

  it("detects multiple flags simultaneously", () => {
    const flags = offlineEmergencyCheck({
      symptoms: "chest pain and difficulty breathing",
      vitals: { temp: null, pulse: null, spo2: 85 },
      age: 30,
    });
    expect(flags.length).toBeGreaterThanOrEqual(3);
  });
});
