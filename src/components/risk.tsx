import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

export type Tier = "RED" | "YELLOW" | "GREEN";

export const TIER_LABEL: Record<Tier, string> = {
  RED: "RISK TIER: RED — Emergency · refer to hospital immediately",
  YELLOW: "RISK TIER: YELLOW — Doctor review · remote consult recommended",
  GREEN: "RISK TIER: GREEN — Basic support · first-aid protocol",
};

export const TIER_SHORT: Record<Tier, string> = {
  RED: "RED — Emergency",
  YELLOW: "YELLOW — Doctor Review",
  GREEN: "GREEN — Basic Support",
};

export const TIER_BLURB: Record<Tier, string> = {
  RED: "Deterministic safety rules flagged one or more emergency indicators. Do not delay transport.",
  YELLOW:
    "No emergency indicators, but findings fall outside the safe-at-home range. A doctor should review remotely.",
  GREEN: "Vitals and symptoms are within safe ranges. A fixed first-aid protocol is suggested for the doctor to approve.",
};

export const TIER_ICON: Record<Tier, typeof AlertTriangle> = {
  RED: ShieldAlert,
  YELLOW: AlertTriangle,
  GREEN: CheckCircle2,
};

export function tierClasses(tier: Tier) {
  if (tier === "RED") return "bg-risk-red-soft text-risk-red border-risk-red/30";
  if (tier === "YELLOW") return "bg-risk-amber-soft text-risk-amber border-risk-amber/30";
  return "bg-risk-green-soft text-risk-green border-risk-green/30";
}

export function RiskPill({ tier, withLabel = false }: { tier: Tier | string | null; withLabel?: boolean }) {
  if (!tier) {
    return (
      <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        Processing
      </span>
    );
  }
  const key = tier as Tier;
  const Icon = TIER_ICON[key] ?? AlertTriangle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${tierClasses(key)}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {withLabel ? TIER_SHORT[key] ?? tier : tier}
    </span>
  );
}
