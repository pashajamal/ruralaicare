export type Tier = "RED" | "YELLOW" | "GREEN";

export const TIER_LABEL: Record<Tier, string> = {
  RED: "RISK TIER: RED — Refer to hospital immediately",
  YELLOW: "RISK TIER: YELLOW — Remote Doctor Consult Recommended",
  GREEN: "RISK TIER: GREEN — Home care with first-aid protocol",
};

export const TIER_BLURB: Record<Tier, string> = {
  RED: "Deterministic safety rules flagged one or more emergency indicators. Do not delay transport.",
  YELLOW: "No emergency indicators, but findings fall outside the safe-at-home range. A doctor should review remotely.",
  GREEN: "Vitals and symptoms are within safe ranges. A fixed first-aid protocol is suggested for the doctor to approve.",
};

export function tierClasses(tier: Tier) {
  if (tier === "RED") return "bg-risk-red-soft text-risk-red border-risk-red/30";
  if (tier === "YELLOW") return "bg-risk-amber-soft text-risk-amber border-risk-amber/30";
  return "bg-risk-green-soft text-risk-green border-risk-green/30";
}

export function RiskPill({ tier }: { tier: Tier | string | null }) {
  if (!tier) {
    return (
      <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        Processing
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${tierClasses(tier as Tier)}`}
    >
      {tier}
    </span>
  );
}
