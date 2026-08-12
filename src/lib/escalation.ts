/**
 * Deterministic home-monitoring escalation engine.
 * Pure code — never an LLM call. Mirrors the intake risk rules.
 */
export type TrackerRow = {
  entry_date: string;
  temperature: number | null;
  pulse: number | null;
  spo2: number | null;
  severity_score: number;
};

export type EscalationResult = { tier: "RED" | "YELLOW"; reasons: string[] } | null;

/**
 * @param history previous entries, newest first (excluding `current`)
 */
export function checkEscalation(current: TrackerRow, history: TrackerRow[]): EscalationResult {
  const red: string[] = [];
  const yellow: string[] = [];
  const prev = history[0];

  if (typeof current.spo2 === "number") {
    if (current.spo2 < 92) red.push(`SpO2 ${current.spo2}% — below safe threshold (92%)`);
    if (prev && typeof prev.spo2 === "number" && prev.spo2 - current.spo2 > 4) {
      red.push(`SpO2 dropped ${prev.spo2 - current.spo2} points since the previous log (${prev.spo2}% → ${current.spo2}%)`);
    }
  }
  if (typeof current.pulse === "number" && (current.pulse > 130 || current.pulse < 45)) {
    red.push(`Pulse ${current.pulse} bpm — outside safe range (45–130)`);
  }
  if (red.length > 0) return { tier: "RED", reasons: red };

  // Fever not improving across 3+ logged days (current + 2 previous)
  const feverWindow = [current, ...history.slice(0, 2)];
  if (
    feverWindow.length === 3 &&
    feverWindow.every((e) => typeof e.temperature === "number" && (e.temperature as number) >= 38)
  ) {
    yellow.push(`Fever ≥ 38 °C on 3 consecutive logged days (latest ${current.temperature} °C) — not improving`);
  }

  // Symptom severity trending upward across 3 consecutive entries
  const sev = [current, ...history.slice(0, 2)].map((e) => e.severity_score);
  if (sev.length === 3 && sev[0]! > sev[1]! && sev[1]! > sev[2]!) {
    yellow.push(`Symptom severity rising for 3 consecutive logs (${sev[2]} → ${sev[1]} → ${sev[0]})`);
  }

  if (typeof current.spo2 === "number" && current.spo2 >= 92 && current.spo2 < 95) {
    yellow.push(`SpO2 ${current.spo2}% — borderline oxygen saturation`);
  }

  return yellow.length > 0 ? { tier: "YELLOW", reasons: yellow } : null;
}

export const ESCALATION_RULES = [
  "SpO2 below 92%, or a drop of more than 4 points since the last log → RED",
  "Pulse above 130 bpm or below 45 bpm → RED",
  "Fever ≥ 38 °C on 3 consecutive logged days → YELLOW",
  "Symptom severity rising for 3 consecutive logs → YELLOW",
  "SpO2 between 92–94% → YELLOW",
];
