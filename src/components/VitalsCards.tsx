import { validateVitals } from "@/lib/vitals";

type Vitals = { temp?: number | null; bp?: string | null; pulse?: number | null; spo2?: number | null };

export function VitalsCards({ vitals, age }: { vitals: Vitals; age?: number | null }) {
  const warnings = validateVitals({ ...vitals, age: age ?? null });
  const flag = (field: string) => warnings.find((w) => w.field === field);

  const cards = [
    { field: "temp", label: "Temperature", value: vitals.temp != null ? `${vitals.temp} °C` : "—" },
    { field: "bp", label: "Blood pressure", value: vitals.bp || "—" },
    { field: "pulse", label: "Pulse", value: vitals.pulse != null ? `${vitals.pulse} bpm` : "—" },
    { field: "spo2", label: "SpO2", value: vitals.spo2 != null ? `${vitals.spo2} %` : "—" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const warn = flag(card.field);
        const emergency = warn?.level === "emergency";
        return (
          <div
            key={card.field}
            className={`rounded-xl border p-4 ${
              emergency
                ? "border-risk-red/40 bg-risk-red-soft"
                : warn
                  ? "border-risk-amber/40 bg-risk-amber-soft"
                  : "border-border bg-card"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className={`mt-1 text-lg font-semibold ${emergency ? "text-risk-red" : ""}`}>{card.value}</p>
            {warn ? (
              <p className={`mt-1 text-xs font-medium ${emergency ? "text-risk-red" : "text-risk-amber"}`}>
                {emergency ? "Emergency threshold triggered" : warn.message}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
