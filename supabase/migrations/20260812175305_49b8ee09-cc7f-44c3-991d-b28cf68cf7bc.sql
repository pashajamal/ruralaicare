-- Storage: prescription images readable only by doctors/admins
DROP POLICY IF EXISTS "Authenticated users can read prescription images" ON storage.objects;
CREATE POLICY "Doctors and admins can read prescription images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'prescription-images' AND public.is_doctor());

-- staging_prescription_images (patient PII from OCR)
DROP POLICY IF EXISTS "Authenticated staff can read staging prescriptions" ON public.staging_prescription_images;
DROP POLICY IF EXISTS "Authenticated staff can insert staging prescriptions" ON public.staging_prescription_images;
CREATE POLICY "Doctors and admins can read staging prescriptions"
ON public.staging_prescription_images FOR SELECT TO authenticated
USING (public.is_doctor());
CREATE POLICY "Doctors and admins can insert staging prescriptions"
ON public.staging_prescription_images FOR INSERT TO authenticated
WITH CHECK (public.is_doctor());

-- staging_symptom_disease (dataset ingestion)
DROP POLICY IF EXISTS "Authenticated staff can read staging rows" ON public.staging_symptom_disease;
DROP POLICY IF EXISTS "Authenticated staff can insert staging rows" ON public.staging_symptom_disease;
CREATE POLICY "Doctors and admins can read staging symptom rows"
ON public.staging_symptom_disease FOR SELECT TO authenticated
USING (public.is_doctor());
CREATE POLICY "Doctors and admins can insert staging symptom rows"
ON public.staging_symptom_disease FOR INSERT TO authenticated
WITH CHECK (public.is_doctor());

-- staging_vitals
DROP POLICY IF EXISTS "Authenticated staff can read staging vitals" ON public.staging_vitals;
DROP POLICY IF EXISTS "Authenticated staff can add staging vitals" ON public.staging_vitals;
DROP POLICY IF EXISTS "Authenticated staff can update staging vitals" ON public.staging_vitals;
CREATE POLICY "Doctors and admins can read staging vitals"
ON public.staging_vitals FOR SELECT TO authenticated
USING (public.is_doctor());
CREATE POLICY "Doctors and admins can insert staging vitals"
ON public.staging_vitals FOR INSERT TO authenticated
WITH CHECK (public.is_doctor());
CREATE POLICY "Doctors and admins can update staging vitals"
ON public.staging_vitals FOR UPDATE TO authenticated
USING (public.is_doctor()) WITH CHECK (public.is_doctor());