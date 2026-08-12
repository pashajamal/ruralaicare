ALTER TABLE public.staging_prescription_images
  ADD COLUMN IF NOT EXISTS extracted_ocr_text text,
  ADD COLUMN IF NOT EXISTS structured_data jsonb;