CREATE TABLE public.staging_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_name text NOT NULL,
  composition text,
  uses text,
  side_effects text,
  image_url text,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.staging_medicines TO authenticated;
GRANT ALL ON public.staging_medicines TO service_role;
ALTER TABLE public.staging_medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors and admins can read medicine dataset" ON public.staging_medicines FOR SELECT TO authenticated USING (public.is_doctor());
CREATE POLICY "Doctors and admins can add medicine dataset rows" ON public.staging_medicines FOR INSERT TO authenticated WITH CHECK (public.is_doctor());
CREATE POLICY "Doctors and admins can update medicine dataset rows" ON public.staging_medicines FOR UPDATE TO authenticated USING (public.is_doctor()) WITH CHECK (public.is_doctor());
CREATE INDEX staging_medicines_processed_idx ON public.staging_medicines (processed, created_at);