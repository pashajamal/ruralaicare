-- ============ roles & profiles ============
CREATE TYPE public.app_role AS ENUM ('health_worker', 'doctor', 'admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  ui_language text NOT NULL DEFAULT 'English',
  preferred_patient_language text NOT NULL DEFAULT 'English',
  notify_red boolean NOT NULL DEFAULT true,
  notify_consultation boolean NOT NULL DEFAULT true,
  notify_followup boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.my_centre()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT health_centre FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_doctor());
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated USING (true);

-- ============ existing tables: staff-only access ============
ALTER TABLE public.patients
  ADD COLUMN health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN contact text,
  ADD COLUMN location text;

ALTER TABLE public.visits
  ADD COLUMN health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN assigned_doctor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN ai_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN referral_required boolean NOT NULL DEFAULT false,
  ADD COLUMN emergency_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN finalized_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

DROP POLICY IF EXISTS patients_read ON public.patients;
DROP POLICY IF EXISTS patients_insert ON public.patients;
DROP POLICY IF EXISTS patients_update ON public.patients;
DROP POLICY IF EXISTS visits_read ON public.visits;
DROP POLICY IF EXISTS visits_insert ON public.visits;
DROP POLICY IF EXISTS visits_update ON public.visits;
DROP POLICY IF EXISTS protocols_read ON public.first_aid_protocols;

REVOKE ALL ON public.patients FROM anon;
REVOKE ALL ON public.visits FROM anon;
REVOKE ALL ON public.first_aid_protocols FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.visits TO authenticated;
GRANT SELECT ON public.first_aid_protocols TO authenticated;

CREATE POLICY patients_select ON public.patients FOR SELECT TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY patients_insert ON public.patients FOR INSERT TO authenticated
  WITH CHECK (health_centre = public.my_centre());
CREATE POLICY patients_update ON public.patients FOR UPDATE TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre())
  WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

CREATE POLICY visits_select ON public.visits FOR SELECT TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY visits_insert ON public.visits FOR INSERT TO authenticated
  WITH CHECK (health_centre = public.my_centre());
CREATE POLICY visits_update ON public.visits FOR UPDATE TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre())
  WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

CREATE POLICY protocols_select ON public.first_aid_protocols FOR SELECT TO authenticated USING (true);

-- ============ consultations ============
CREATE TABLE public.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  health_worker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_doctor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'routine',
  status text NOT NULL DEFAULT 'requested',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.consultations TO authenticated;
GRANT ALL ON public.consultations TO service_role;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY consultations_select ON public.consultations FOR SELECT TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY consultations_insert ON public.consultations FOR INSERT TO authenticated
  WITH CHECK (health_centre = public.my_centre());
CREATE POLICY consultations_update ON public.consultations FOR UPDATE TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre())
  WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

-- ============ referrals ============
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  risk_tier text,
  reason text NOT NULL,
  facility text,
  doctor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'recommended',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY referrals_select ON public.referrals FOR SELECT TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY referrals_insert ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (health_centre = public.my_centre());
CREATE POLICY referrals_update ON public.referrals FOR UPDATE TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre())
  WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

-- ============ follow ups ============
CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  due_date date NOT NULL,
  instructions text,
  reason text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'scheduled',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY follow_ups_select ON public.follow_ups FOR SELECT TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY follow_ups_insert ON public.follow_ups FOR INSERT TO authenticated
  WITH CHECK (health_centre = public.my_centre());
CREATE POLICY follow_ups_update ON public.follow_ups FOR UPDATE TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre())
  WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  health_centre text,
  audience text NOT NULL DEFAULT 'all',
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info',
  visit_id uuid REFERENCES public.visits(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND (audience = 'all'
      OR (audience = 'doctor' AND public.is_doctor())
      OR (audience = 'health_worker' AND health_centre = public.my_centre())))
  );
CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (true);

-- ============ audit log ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  health_centre text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============ indexes ============
CREATE INDEX idx_visits_risk_tier ON public.visits(risk_tier);
CREATE INDEX idx_visits_status ON public.visits(status);
CREATE INDEX idx_visits_patient_id ON public.visits(patient_id);
CREATE INDEX idx_visits_created_at ON public.visits(created_at DESC);
CREATE INDEX idx_consultations_status ON public.consultations(status);
CREATE INDEX idx_consultations_visit ON public.consultations(visit_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_follow_ups_due ON public.follow_ups(due_date);
CREATE INDEX idx_audit_visit ON public.audit_logs(visit_id, created_at DESC);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- ============ storage: signed-in staff only ============
CREATE POLICY "clinic uploads readable by staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'clinic-uploads');
CREATE POLICY "clinic uploads writable by staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinic-uploads');

-- ============ demo data ============
INSERT INTO public.patients (id, name, age, preferred_language, contact, location, created_at) VALUES
  ('11111111-1111-4111-8111-000000000001', 'Demo — Sunita Rani', 28, 'Hindi', '+91 90000 00001', 'Rampur village, ward 3', now() - interval '5 hours'),
  ('11111111-1111-4111-8111-000000000002', 'Demo — Imran Sheikh', 34, 'Bangla', '+91 90000 00002', 'Rampur village, ward 1', now() - interval '4 hours'),
  ('11111111-1111-4111-8111-000000000003', 'Demo — Kamla Devi', 67, 'Hindi', '+91 90000 00003', 'Rampur village, ward 5', now() - interval '3 hours'),
  ('11111111-1111-4111-8111-000000000004', 'Demo — Ravi Kumar', 45, 'English', '+91 90000 00004', 'Barwa hamlet', now() - interval '2 hours'),
  ('11111111-1111-4111-8111-000000000005', 'Demo — Farida Begum', 58, 'Arabic', '+91 90000 00005', 'Rampur village, ward 2', now() - interval '90 minutes'),
  ('11111111-1111-4111-8111-000000000006', 'Demo — Mohan Lal', 71, 'Hindi', '+91 90000 00006', 'Barwa hamlet', now() - interval '35 minutes');

INSERT INTO public.visits (patient_id, symptoms_text, duration, history_text, vitals, structured_summary, preliminary_assessment, confirmation_message, risk_tier, triggering_rules, protocol_text, status, created_at) VALUES
  ('11111111-1111-4111-8111-000000000001', 'Small cut on the left hand from a sickle while cutting grass. Slight bleeding, cleaned with water.', '1 day', 'No known conditions', '{"temp":36.9,"bp":"118/76","pulse":78,"spo2":98}', '{"symptoms":["minor cut","slight bleeding"],"duration":"1 day","age":28,"vitals":{"temp":36.9,"bp":"118/76","pulse":78,"spo2":98},"history":"No known conditions","detected_language":"Hindi"}', 'Findings are consistent with a superficial laceration of the left hand. Vitals are within normal ranges and no systemic signs are reported.', 'आपकी जानकारी दर्ज हो गई है। हाथ के छोटे कट के लिए प्राथमिक उपचार सुझाया गया है।', 'GREEN', '["No emergency indicators","Vitals within safe ranges","Symptom duration under 3 days"]', 'Minor cuts and bandaging

1. Wash hands and wear clean gloves if available.
2. Rinse the cut under clean running water for 1-2 minutes.
3. Apply gentle pressure with a clean cloth until bleeding stops.
4. Cover with a sterile dressing and change it daily.
5. Return immediately if the wound becomes red, swollen, or discharges pus.', 'pending_review', now() - interval '5 hours'),
  ('11111111-1111-4111-8111-000000000002', 'Mild fever since yesterday evening with body ache. Eating normally, no breathing difficulty.', '1 day', 'No chronic illness', '{"temp":38.1,"bp":"120/80","pulse":88,"spo2":98}', '{"symptoms":["mild fever","body ache"],"duration":"1 day","age":34,"vitals":{"temp":38.1,"bp":"120/80","pulse":88,"spo2":98},"history":"No chronic illness","detected_language":"Bangla"}', 'The pattern is consistent with a self-limiting febrile illness. No red-flag features are reported and oxygen saturation is normal.', 'আপনার তথ্য রেকর্ড করা হয়েছে। হালকা জ্বরের জন্য প্রাথমিক পরামর্শ দেওয়া হয়েছে।', 'GREEN', '["No emergency indicators","SpO2 within safe range","Symptom duration under 3 days"]', 'Mild fever management

1. Encourage fluids every hour.
2. Rest and light meals.
3. Tepid sponging if the patient feels very hot.
4. Monitor temperature twice daily.
5. Escalate if fever crosses 39C, lasts beyond 3 days, or breathing becomes difficult.', 'finalized', now() - interval '4 hours'),
  ('11111111-1111-4111-8111-000000000003', 'Fever on and off for five days with cough and weakness. Appetite reduced.', '5 days', 'Type 2 diabetes for 10 years', '{"temp":38.9,"bp":"134/86","pulse":98,"spo2":95}', '{"symptoms":["persistent fever","cough","weakness"],"duration":"5 days","age":67,"vitals":{"temp":38.9,"bp":"134/86","pulse":98,"spo2":95},"history":"Type 2 diabetes","detected_language":"Hindi"}', 'Findings may indicate a persistent febrile illness in an older adult with diabetes. Duration and comorbidity warrant clinician review; this is not a diagnosis.', 'आपकी जानकारी दर्ज हो गई है। डॉक्टर की समीक्षा आवश्यक है।', 'YELLOW', '["Symptoms persisting 5 days — beyond 3-day threshold","Temperature 38.9C — moderate fever","Age over 60 with ongoing fever"]', NULL, 'pending_review', now() - interval '3 hours'),
  ('11111111-1111-4111-8111-000000000004', 'Loose motions and vomiting for four days, feeling weak and dizzy when standing.', '4 days', 'Nil significant', '{"temp":37.8,"bp":"104/68","pulse":104,"spo2":97}', '{"symptoms":["diarrhoea","vomiting","dizziness"],"duration":"4 days","age":45,"vitals":{"temp":37.8,"bp":"104/68","pulse":104,"spo2":97},"history":"Nil significant","detected_language":"English"}', 'The picture is consistent with moderate dehydration following a gastrointestinal illness. Postural dizziness suggests volume depletion and should be reviewed by a clinician.', 'Your information has been recorded. A doctor review has been requested.', 'YELLOW', '["Symptoms persisting 4 days — beyond 3-day threshold","Pulse 104 bpm — mild tachycardia","Postural dizziness reported"]', NULL, 'pending_review', now() - interval '2 hours'),
  ('11111111-1111-4111-8111-000000000005', 'Breathless since morning, cannot complete a sentence, lips look bluish.', '1 day', 'Asthma since childhood', '{"temp":37.4,"bp":"128/84","pulse":118,"spo2":89}', '{"symptoms":["breathlessness","cyanosis"],"duration":"1 day","age":58,"vitals":{"temp":37.4,"bp":"128/84","pulse":118,"spo2":89},"history":"Asthma","detected_language":"Arabic"}', 'Reported features are consistent with acute respiratory compromise. Emergency indicators are present and were determined by deterministic rules, not by this assessment.', 'تم تسجيل المعلومات. هذه حالة طارئة وتتطلب إحالة فورية.', 'RED', '["SpO2 89% — below the 92% emergency threshold","Difficulty breathing detected in symptoms","Pulse 118 bpm — elevated"]', NULL, 'pending_review', now() - interval '90 minutes'),
  ('11111111-1111-4111-8111-000000000006', 'Sudden chest pain radiating to the left arm with sweating, started one hour ago.', '1 hour', 'Hypertension, smoker', '{"temp":36.8,"bp":"156/96","pulse":112,"spo2":93}', '{"symptoms":["chest pain","sweating"],"duration":"1 hour","age":71,"vitals":{"temp":36.8,"bp":"156/96","pulse":112,"spo2":93},"history":"Hypertension, smoker","detected_language":"Hindi"}', 'Reported features are consistent with an acute cardiac presentation and require emergency evaluation. This is a pattern description, not a diagnosis.', 'जानकारी दर्ज हो गई है। तुरंत अस्पताल रेफर करें।', 'RED', '["Chest pain reported — emergency rule","Age over 60 with acute chest symptoms","Blood pressure 156/96 — elevated"]', NULL, 'pending_review', now() - interval '35 minutes');

UPDATE public.visits SET referral_required = true WHERE risk_tier = 'RED';
UPDATE public.visits SET doctor_decision = 'approve', doctor_notes = 'Agree with supportive care. Advised return if fever persists beyond 3 days.', finalized_at = now() - interval '3 hours' WHERE status = 'finalized';