export type VitalWarning = { field: string; message: string; level: "verify" | "emergency" };

export function validateVitals(v: {
  age?: number | null;
  temp?: number | null;
  bp?: string | null;
  pulse?: number | null;
  spo2?: number | null;
}): VitalWarning[] {
  const out: VitalWarning[] = [];

  if (typeof v.age === "number" && (v.age < 0 || v.age > 120))
    out.push({ field: "age", message: "Age looks unusual. Please verify.", level: "verify" });

  if (typeof v.temp === "number") {
    if (v.temp < 30 || v.temp > 43)
      out.push({ field: "temp", message: "Temperature value appears unusual. Please verify the reading.", level: "verify" });
    else if (v.temp >= 39.5)
      out.push({ field: "temp", message: "High fever — emergency threshold may apply.", level: "emergency" });
  }

  if (typeof v.spo2 === "number") {
    if (v.spo2 < 50 || v.spo2 > 100)
      out.push({ field: "spo2", message: "SpO2 value appears unusual. Please verify the reading.", level: "verify" });
    else if (v.spo2 < 92)
      out.push({ field: "spo2", message: "SpO2 below 92% — emergency threshold triggered.", level: "emergency" });
  }

  if (typeof v.pulse === "number") {
    if (v.pulse < 20 || v.pulse > 250)
      out.push({ field: "pulse", message: "Pulse value appears unusual. Please verify the reading.", level: "verify" });
    else if (v.pulse > 130 || v.pulse < 45)
      out.push({ field: "pulse", message: "Pulse outside the safe range (45–130) — emergency threshold triggered.", level: "emergency" });
  }

  if (v.bp) {
    const match = v.bp.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
    if (!match) {
      out.push({ field: "bp", message: "Blood pressure should look like 120/80. Please verify.", level: "verify" });
    } else {
      const sys = Number(match[1]);
      const dia = Number(match[2]);
      if (sys < 60 || sys > 260 || dia < 30 || dia > 160 || dia >= sys)
        out.push({ field: "bp", message: "Blood pressure reading appears unusual. Please verify.", level: "verify" });
      else if (sys >= 180 || dia >= 120 || sys < 90)
        out.push({ field: "bp", message: "Blood pressure outside safe range — verify and escalate.", level: "emergency" });
    }
  }

  return out;
}
