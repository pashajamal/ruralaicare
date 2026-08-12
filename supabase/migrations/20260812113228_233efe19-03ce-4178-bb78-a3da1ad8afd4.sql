-- 1. Mobile number on patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS mobile_number text;
UPDATE public.patients SET mobile_number = COALESCE(NULLIF(contact, ''), '+910000000000') WHERE mobile_number IS NULL;
ALTER TABLE public.patients ALTER COLUMN mobile_number SET NOT NULL;
CREATE INDEX IF NOT EXISTS patients_mobile_number_idx ON public.patients (mobile_number);

-- 2. Ayurvedic protocols
CREATE TABLE IF NOT EXISTS public.ayurvedic_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_name text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  remedy_text text NOT NULL,
  source_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ayurvedic_protocols TO authenticated;
GRANT ALL ON public.ayurvedic_protocols TO service_role;
ALTER TABLE public.ayurvedic_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY ayurvedic_select ON public.ayurvedic_protocols FOR SELECT TO authenticated USING (true);

INSERT INTO public.ayurvedic_protocols (condition_name, keywords, remedy_text, source_reference) VALUES
('Mild fever', ARRAY['fever','temperature','pyrexia','jwara'],
 E'1. Offer warm water frequently through the day to prevent dehydration.\n2. Tulsi (holy basil) and ginger decoction, half a cup twice daily after food.\n3. Light, easily digestible food such as rice gruel; avoid heavy or fried food.\n4. Complete rest until the temperature settles.\nStop and seek clinical care if the fever crosses 39°C or lasts beyond 3 days.',
 'Ministry of AYUSH, Ayurveda self-care advisory'),
('Common cold and cough', ARRAY['cold','cough','sore throat','runny nose','congestion','sneezing'],
 E'1. Steam inhalation with plain water twice a day.\n2. Warm turmeric milk (1/4 tsp turmeric) once at night.\n3. Salt-water gargle two to three times daily for throat discomfort.\n4. Honey with a pinch of black pepper (only for those above 1 year of age).\nStop and seek clinical care if breathlessness, chest pain or high fever appears.',
 'Ministry of AYUSH, Ayurveda self-care advisory'),
('Minor digestive upset', ARRAY['stomach','indigestion','gas','bloating','acidity','loose motion','nausea','diarrhoea','diarrhea'],
 E'1. Ajwain (carom seed) with a pinch of rock salt in warm water after meals.\n2. Buttermilk with roasted cumin powder once daily.\n3. Small, warm, freshly cooked meals; avoid cold, oily and stale food.\n4. Ginger and lemon in warm water before meals to support appetite.\nStop and seek clinical care for blood in stool, severe pain or persistent vomiting.',
 'Ministry of AYUSH, Ayurveda self-care advisory'),
('Minor skin irritation', ARRAY['rash','itching','skin','irritation','dry skin','allergy'],
 E'1. Wash the area with plain cool water and pat dry — do not scratch.\n2. Apply fresh aloe vera gel to the affected area twice daily.\n3. Coconut oil at night for dryness and mild scaling.\n4. Neem-leaf boiled water (cooled) as a wash for itching.\nStop and seek clinical care if there is spreading redness, pus or fever.',
 'Ministry of AYUSH, Ayurveda self-care advisory'),
('Mild dehydration and fatigue', ARRAY['dehydration','weakness','fatigue','tired','thirst'],
 E'1. Oral rehydration fluid or lemon-salt-sugar water in small frequent sips.\n2. Tender coconut water twice a day.\n3. Soaked raisins or dates in the morning for sustained energy.\n4. Rest in a cool, shaded place; avoid direct sun exposure.\nStop and seek clinical care if the patient is drowsy, unable to drink or passing very little urine.',
 'Ministry of AYUSH, Ayurveda self-care advisory');

-- 3. Medicine inventory
CREATE TABLE IF NOT EXISTS public.medicine_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  expiry_date date,
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medicine_inventory_name_idx ON public.medicine_inventory (lower(medicine_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicine_inventory TO authenticated;
GRANT ALL ON public.medicine_inventory TO service_role;
ALTER TABLE public.medicine_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY medicine_select ON public.medicine_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY medicine_insert ON public.medicine_inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY medicine_update ON public.medicine_inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER medicine_inventory_updated_at BEFORE UPDATE ON public.medicine_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.medicine_inventory (medicine_name, quantity, expiry_date) VALUES
('Paracetamol 500mg', 240, '2027-04-30'),
('ORS sachets', 150, '2027-09-30'),
('Ibuprofen 400mg', 0, '2026-12-31'),
('Amoxicillin 250mg', 60, '2026-11-30'),
('Cetirizine 10mg', 90, '2027-02-28'),
('Povidone-iodine solution', 12, '2027-06-30'),
('Silver sulfadiazine cream', 0, '2026-10-31'),
('Antiseptic gauze pads', 200, '2028-01-31'),
('Zinc sulphate tablets', 75, '2027-07-31'),
('Antacid suspension', 30, '2026-09-30'),
('Oral rehydration salts (bulk)', 5, '2026-08-31'),
('Aloe vera gel', 25, '2027-03-31'),
('Salbutamol inhaler', 0, '2027-01-31'),
('Multivitamin tablets', 180, '2027-12-31');

-- 4. Consultation session logging
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'chat';
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS initiated_by uuid REFERENCES auth.users(id);
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS urgent_flag boolean NOT NULL DEFAULT false;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- 5. Case chat messages
CREATE TABLE IF NOT EXISTS public.visit_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  consultation_id uuid REFERENCES public.consultations(id),
  health_centre text NOT NULL,
  sender_id uuid REFERENCES auth.users(id),
  sender_name text NOT NULL,
  sender_role text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visit_messages_visit_idx ON public.visit_messages (visit_id, created_at);
GRANT SELECT, INSERT ON public.visit_messages TO authenticated;
GRANT ALL ON public.visit_messages TO service_role;
ALTER TABLE public.visit_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_messages_select ON public.visit_messages FOR SELECT TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY visit_messages_insert ON public.visit_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND (public.is_doctor() OR health_centre = public.my_centre()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_messages;