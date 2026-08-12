const KEY = "clinic.pendingIntakes";

export type PendingIntake = {
  localId: string;
  savedAt: string;
  name: string;
  age: number;
  preferred_language: string;
  symptoms: string;
  duration: string;
  history: string;
  vitals: { temp: number | null; bp: string | null; pulse: number | null; spo2: number | null };
};

export function readPending(): PendingIntake[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingIntake[]) : [];
  } catch {
    return [];
  }
}

export function writePending(items: PendingIntake[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("clinic:pending-changed"));
}

export function addPending(item: Omit<PendingIntake, "localId" | "savedAt">) {
  const next = [
    ...readPending(),
    { ...item, localId: crypto.randomUUID(), savedAt: new Date().toISOString() },
  ];
  writePending(next);
  return next.length;
}

export function removePending(localId: string) {
  writePending(readPending().filter((p) => p.localId !== localId));
}

/** Deterministic offline emergency check — no AI, mirrors the RED rules in the risk engine. */
export function offlineEmergencyCheck(input: {
  symptoms: string;
  vitals: { temp: number | null; pulse: number | null; spo2: number | null };
  age: number;
}): string[] {
  const flags: string[] = [];
  const text = input.symptoms.toLowerCase();
  if (typeof input.vitals.spo2 === "number" && input.vitals.spo2 < 92)
    flags.push(`SpO2 ${input.vitals.spo2}% — below the 92% emergency threshold`);
  if (typeof input.vitals.pulse === "number" && (input.vitals.pulse > 130 || input.vitals.pulse < 45))
    flags.push(`Pulse ${input.vitals.pulse} bpm — outside the safe range (45–130)`);
  if (typeof input.vitals.temp === "number" && input.vitals.temp > 39.5 && input.age > 60)
    flags.push(`Temperature ${input.vitals.temp}°C with age ${input.age}`);
  for (const flag of ["chest pain", "difficulty breathing", "breathless", "unconscious", "seizure"])
    if (text.includes(flag)) flags.push(`Red-flag symptom reported: "${flag}"`);
  return flags;
}
