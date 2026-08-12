CREATE TABLE public.staging_symptom_disease (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_text text NOT NULL,
  disease_label text NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.staging_symptom_disease TO authenticated;
GRANT ALL ON public.staging_symptom_disease TO service_role;

ALTER TABLE public.staging_symptom_disease ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can read staging rows"
  ON public.staging_symptom_disease
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated staff can insert staging rows"
  ON public.staging_symptom_disease
  FOR INSERT
  TO authenticated
  WITH CHECK (true);