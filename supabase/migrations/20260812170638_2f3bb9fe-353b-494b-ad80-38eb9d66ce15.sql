CREATE TABLE public.staging_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_ref text NOT NULL,
  temperature_c numeric,
  systolic integer,
  diastolic integer,
  pulse integer,
  spo2 integer,
  respiratory_rate integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.staging_vitals TO authenticated;
GRANT ALL ON public.staging_vitals TO service_role;

ALTER TABLE public.staging_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can read staging vitals"
  ON public.staging_vitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can add staging vitals"
  ON public.staging_vitals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated staff can update staging vitals"
  ON public.staging_vitals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.staging_vitals (patient_ref, temperature_c, systolic, diastolic, pulse, spo2, respiratory_rate, note) VALUES
  ('VIT-001 · Adult male, 58y', 37.1, 128, 82, 88, 97, 16, 'Routine screening, stable'),
  ('VIT-002 · Adult female, 34y', 39.6, 118, 76, 112, 96, 20, 'High fever, three days'),
  ('VIT-003 · Adult male, 67y', 36.8, 192, 124, 96, 95, 18, 'Severe headache, hypertensive range'),
  ('VIT-004 · Adult female, 71y', 37.4, 132, 84, 104, 89, 26, 'Breathlessness, low oxygen saturation'),
  ('VIT-005 · Adult male, 45y', 36.5, 108, 70, 46, 98, 14, 'Dizziness on standing, slow pulse'),
  ('VIT-006 · Adult female, 29y', 37.0, 116, 74, 78, 99, 15, 'Postpartum check, unremarkable');