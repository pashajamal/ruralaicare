ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS hospital_specialty_tag text;

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_finalized_requires_decision;
ALTER TABLE public.visits ADD CONSTRAINT visits_finalized_requires_decision
  CHECK (status <> 'finalized' OR doctor_decision IS NOT NULL) NOT VALID;

CREATE TABLE public.care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  doctor_id uuid REFERENCES auth.users(id),
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  medication_instructions text,
  monitoring_instructions text,
  watch_symptoms jsonb NOT NULL DEFAULT '[]'::jsonb,
  monitoring_days integer NOT NULL DEFAULT 7,
  follow_up_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.care_plans TO authenticated;
GRANT ALL ON public.care_plans TO service_role;
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY care_plans_select ON public.care_plans FOR SELECT TO authenticated USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY care_plans_insert ON public.care_plans FOR INSERT TO authenticated WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY care_plans_update ON public.care_plans FOR UPDATE TO authenticated USING (public.is_doctor() OR health_centre = public.my_centre()) WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

CREATE TABLE public.daily_tracker_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  care_plan_id uuid REFERENCES public.care_plans(id),
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  entry_date date NOT NULL DEFAULT current_date,
  temperature numeric,
  pulse integer,
  spo2 integer,
  severity_score integer NOT NULL DEFAULT 1,
  note text,
  escalation_flag boolean NOT NULL DEFAULT false,
  logged_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, entry_date)
);
GRANT SELECT, INSERT, UPDATE ON public.daily_tracker_entries TO authenticated;
GRANT ALL ON public.daily_tracker_entries TO service_role;
ALTER TABLE public.daily_tracker_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY dte_select ON public.daily_tracker_entries FOR SELECT TO authenticated USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY dte_insert ON public.daily_tracker_entries FOR INSERT TO authenticated WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY dte_update ON public.daily_tracker_entries FOR UPDATE TO authenticated USING (public.is_doctor() OR health_centre = public.my_centre()) WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

CREATE TABLE public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  care_plan_id uuid REFERENCES public.care_plans(id),
  daily_tracker_entry_id uuid REFERENCES public.daily_tracker_entries(id),
  visit_id uuid REFERENCES public.visits(id),
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  reason text NOT NULL,
  tier text NOT NULL DEFAULT 'YELLOW',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.escalations TO authenticated;
GRANT ALL ON public.escalations TO service_role;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY esc_select ON public.escalations FOR SELECT TO authenticated USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY esc_insert ON public.escalations FOR INSERT TO authenticated WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY esc_update ON public.escalations FOR UPDATE TO authenticated USING (public.is_doctor() OR health_centre = public.my_centre()) WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  care_plan_id uuid REFERENCES public.care_plans(id),
  health_centre text NOT NULL DEFAULT 'Rampur Health Centre',
  type text NOT NULL DEFAULT 'daily_log',
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY rem_select ON public.reminders FOR SELECT TO authenticated USING (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY rem_insert ON public.reminders FOR INSERT TO authenticated WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());
CREATE POLICY rem_update ON public.reminders FOR UPDATE TO authenticated USING (public.is_doctor() OR health_centre = public.my_centre()) WITH CHECK (public.is_doctor() OR health_centre = public.my_centre());

CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY hospitals_select ON public.hospitals FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_dte_patient_date ON public.daily_tracker_entries(patient_id, entry_date DESC);
CREATE INDEX idx_care_plans_patient ON public.care_plans(patient_id);
CREATE INDEX idx_escalations_status ON public.escalations(status, created_at DESC);
CREATE INDEX idx_reminders_due ON public.reminders(due_date, status);

INSERT INTO public.hospitals (name, specialty_tags, latitude, longitude, phone, address) VALUES
('Rampur Community Health Centre', '["General Medicine","Pediatrics"]', 26.8467, 80.9462, '+91 522 100 2001', 'Main Road, Rampur'),
('Sitapur District Hospital', '["General Medicine","Emergency","Surgery"]', 26.9124, 80.8901, '+91 522 100 2002', 'Hospital Road, Sitapur'),
('Lakshmi Multispeciality Hospital', '["Cardiology","Pulmonology","Emergency"]', 26.8891, 81.0122, '+91 522 100 2003', 'Civil Lines, Barabanki'),
('Shanti Maternal & Child Care', '["Obstetrics","Pediatrics"]', 26.8203, 80.9955, '+91 522 100 2004', 'Station Road, Mohanlalganj'),
('Ganga Chest & Lung Clinic', '["Pulmonology","General Medicine"]', 26.8712, 80.9011, '+91 522 100 2005', 'Ganga Nagar, Rampur'),
('Aarogya Trauma & Emergency Centre', '["Emergency","Orthopaedics","Surgery"]', 26.9330, 80.9700, '+91 522 100 2006', 'Bypass Road, Sitapur'),
('Nandini Skin & Wound Care Clinic', '["Dermatology","General Medicine"]', 26.8390, 80.9280, '+91 522 100 2007', 'Bazaar Chowk, Rampur'),
('Sunrise Cardiac Institute', '["Cardiology","Emergency"]', 26.9601, 81.0450, '+91 522 100 2008', 'Ring Road, Lucknow Outer'),
('Prakash Eye & ENT Hospital', '["ENT","Ophthalmology"]', 26.8555, 80.9611, '+91 522 100 2009', 'Temple Street, Rampur'),
('Jeevan Rural Referral Hospital', '["General Medicine","Emergency","Pediatrics"]', 26.7988, 80.8844, '+91 522 100 2010', 'NH-30, Kakori');