CREATE TABLE public.patient_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  health_centre text NOT NULL DEFAULT public.my_centre(),
  condition_name text NOT NULL,
  on_medication boolean NOT NULL DEFAULT false,
  medication_name text,
  diagnosed_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, condition_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_conditions TO authenticated;
GRANT ALL ON public.patient_conditions TO service_role;

ALTER TABLE public.patient_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Centre staff can view patient conditions"
  ON public.patient_conditions FOR SELECT TO authenticated
  USING (health_centre = public.my_centre());

CREATE POLICY "Centre staff can add patient conditions"
  ON public.patient_conditions FOR INSERT TO authenticated
  WITH CHECK (health_centre = public.my_centre());

CREATE POLICY "Centre staff can update patient conditions"
  ON public.patient_conditions FOR UPDATE TO authenticated
  USING (health_centre = public.my_centre())
  WITH CHECK (health_centre = public.my_centre());

CREATE TRIGGER patient_conditions_updated_at
  BEFORE UPDATE ON public.patient_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.visits
  ADD COLUMN pregnancy_status jsonb,
  ADD COLUMN chronic_conditions jsonb;

ALTER TABLE public.patients
  ADD COLUMN sex text;