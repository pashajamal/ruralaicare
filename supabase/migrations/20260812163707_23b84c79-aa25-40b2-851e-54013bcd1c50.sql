CREATE TABLE public.staging_prescription_images (
  id uuid primary key default gen_random_uuid(),
  image_filename text not null,
  patient_name text,
  medication_details text,
  dosage text,
  raw_ocr_text text,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.staging_prescription_images TO authenticated;
GRANT ALL ON public.staging_prescription_images TO service_role;

ALTER TABLE public.staging_prescription_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can read staging prescriptions"
  ON public.staging_prescription_images
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated staff can insert staging prescriptions"
  ON public.staging_prescription_images
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can manage staging prescriptions"
  ON public.staging_prescription_images
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Storage policies for the prescription-images bucket
CREATE POLICY "Authenticated users can read prescription images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'prescription-images');

CREATE POLICY "Admins can upload prescription images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'prescription-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update prescription images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'prescription-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'prescription-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete prescription images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'prescription-images' AND public.has_role(auth.uid(), 'admin'));