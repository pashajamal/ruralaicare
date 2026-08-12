CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'English',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.patients TO anon, authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_read" ON public.patients FOR SELECT USING (true);
CREATE POLICY "patients_insert" ON public.patients FOR INSERT WITH CHECK (true);
CREATE POLICY "patients_update" ON public.patients FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  symptoms_text TEXT NOT NULL,
  duration TEXT,
  history_text TEXT,
  vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_url TEXT,
  image_analysis TEXT,
  structured_summary JSONB,
  preliminary_assessment TEXT,
  confirmation_message TEXT,
  risk_tier TEXT,
  triggering_rules JSONB,
  protocol_text TEXT,
  drug_safety_info JSONB,
  status TEXT NOT NULL DEFAULT 'pending_review',
  doctor_decision TEXT,
  doctor_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.visits TO anon, authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visits_read" ON public.visits FOR SELECT USING (true);
CREATE POLICY "visits_insert" ON public.visits FOR INSERT WITH CHECK (true);
CREATE POLICY "visits_update" ON public.visits FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.first_aid_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  otc_medicine TEXT,
  protocol_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.first_aid_protocols TO anon, authenticated;
GRANT ALL ON public.first_aid_protocols TO service_role;
ALTER TABLE public.first_aid_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "protocols_read" ON public.first_aid_protocols FOR SELECT USING (true);

INSERT INTO public.first_aid_protocols (condition_name, keywords, otc_medicine, protocol_text) VALUES
('Minor wound cleaning', ARRAY['wound','cut','graze','abrasion','scrape'], NULL, E'1. Wash hands thoroughly with soap and clean water.\n2. Rinse the wound under clean running water for 1-2 minutes.\n3. Gently clean around the wound with mild soap; do not scrub inside it.\n4. Pat dry with a clean cloth and apply a sterile dressing.\n5. Change the dressing daily and watch for redness, swelling, pus or fever.'),
('Mild fever management', ARRAY['fever','temperature','chills','hot'], 'Paracetamol', E'1. Encourage rest and 2-3 litres of fluids per day.\n2. Keep the patient in a cool, ventilated room; use light clothing.\n3. Apply a tepid (not cold) sponge to forehead, neck and armpits.\n4. Record temperature every 4 hours.\n5. Escalate if temperature exceeds 39.5 C, lasts beyond 3 days, or breathing becomes difficult.'),
('Minor burns', ARRAY['burn','scald','blister'], NULL, E'1. Cool the burn under clean running water for 20 minutes. Do not use ice.\n2. Remove rings or tight items near the area before swelling begins.\n3. Do not apply oil, toothpaste, or ash.\n4. Cover loosely with a clean non-stick dressing or cling film.\n5. Refer any burn larger than the patient palm, or on face, hands or genitals.'),
('Dehydration', ARRAY['dehydration','diarrhea','diarrhoea','vomiting','loose motion','thirst'], 'Oral Rehydration Salts', E'1. Give oral rehydration solution (ORS) in small frequent sips.\n2. Adults: 200-400 ml after each loose stool. Children: 50-100 ml.\n3. Continue normal feeding; avoid sugary soft drinks.\n4. Monitor urine output and alertness.\n5. Refer if there is no urine for 8 hours, sunken eyes, or confusion.'),
('Minor cuts and bandaging', ARRAY['bleeding','laceration','bandage'], NULL, E'1. Apply firm direct pressure with a clean cloth for 10 minutes.\n2. Elevate the limb above heart level if possible.\n3. Once bleeding stops, clean with running water and dry the area.\n4. Apply a sterile adhesive dressing or bandage, snug but not tight.\n5. Refer if bleeding continues past 15 minutes or the wound gapes open.'),
('Mild body ache and headache', ARRAY['headache','body ache','pain','ache','sore'], 'Ibuprofen', E'1. Ensure rest in a quiet, dimly lit space.\n2. Encourage hydration and a light meal.\n3. Apply a cool compress to the forehead or the sore area.\n4. Review posture, screen time and sleep pattern.\n5. Refer if pain is sudden and severe, or accompanied by fever with neck stiffness.');

CREATE POLICY "clinic_uploads_read" ON storage.objects FOR SELECT USING (bucket_id = 'clinic-uploads');
CREATE POLICY "clinic_uploads_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clinic-uploads');