import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

export type PickerPatient = { id: string; name: string; age: number };

export function usePatients() {
  return useQuery({
    queryKey: ["picker-patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, age")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PickerPatient[];
    },
  });
}

export function PatientPicker({
  value,
  onChange,
  label = "Patient",
  patients,
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  patients: PickerPatient[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="patient-picker">{label}</Label>
      <select
        id="patient-picker"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select a patient…</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.age} yrs
          </option>
        ))}
      </select>
    </div>
  );
}
