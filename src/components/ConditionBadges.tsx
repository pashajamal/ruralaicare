import { useQuery } from "@tanstack/react-query";
import { HeartPulse } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { conditionBadges, type ChronicCondition, type PregnancyStatus } from "@/lib/conditions";

export function usePatientConditions(patientId: string | null | undefined) {
  return useQuery({
    queryKey: ["patient-conditions", patientId],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_conditions")
        .select("condition_name, on_medication, medication_name, diagnosed_note")
        .eq("patient_id", patientId!)
        .order("condition_name");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        condition_name: r.condition_name,
        on_medication: Boolean(r.on_medication),
        medication_name: r.medication_name ?? "",
        diagnosed_note: r.diagnosed_note ?? "",
      })) as ChronicCondition[];
    },
    staleTime: 60_000,
  });
}

/** Persistent at-a-glance chronic-condition / pregnancy tags shown next to a patient's name. */
export function ConditionBadges({
  patientId,
  pregnancy,
  className = "",
}: {
  patientId: string | null | undefined;
  pregnancy?: PregnancyStatus | null;
  className?: string;
}) {
  const { data } = usePatientConditions(patientId);
  const badges = conditionBadges(data ?? [], pregnancy ?? null);
  if (badges.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <HeartPulse className="size-3.5 text-muted-foreground" aria-hidden />
      {badges.map((b) => (
        <span
          key={b}
          className="rounded-full border border-risk-amber/30 bg-risk-amber-soft px-2 py-0.5 text-[11px] font-semibold text-risk-amber"
        >
          {b}
        </span>
      ))}
    </div>
  );
}
