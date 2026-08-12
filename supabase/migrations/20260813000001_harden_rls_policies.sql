-- ============================================================
-- Security hardening: tighten RLS policies and remove anon write access.
--
-- BEFORE: all tables used USING (true) — any user could read/modify all
-- patient data across all health centres.
-- AFTER:  policies enforce health-centre isolation and require authentication.
-- ============================================================

-- 1. Revoke write access from anon on sensitive tables.
REVOKE INSERT, UPDATE ON public.patients FROM anon;
REVOKE INSERT, UPDATE ON public.visits FROM anon;

-- 2. Drop the wide-open policies on patients.
DROP POLICY IF EXISTS "patients_read" ON public.patients;
DROP POLICY IF EXISTS "patients_insert" ON public.patients;
DROP POLICY IF EXISTS "patients_update" ON public.patients;

-- 3. Create health-centre-scoped policies on patients.
-- Users can only see patients at their own health centre.
CREATE POLICY "patients_read_own_centre" ON public.patients
  FOR SELECT
  USING (
    health_centre = (
      SELECT p.health_centre FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Health workers can only create patients at their own centre.
CREATE POLICY "patients_insert_own_centre" ON public.patients
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND health_centre = (
      SELECT p.health_centre FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Workers/doctors can only update patients at their own centre.
CREATE POLICY "patients_update_own_centre" ON public.patients
  FOR UPDATE
  USING (
    health_centre = (
      SELECT p.health_centre FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    health_centre = (
      SELECT p.health_centre FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- 4. Drop the wide-open policies on visits.
DROP POLICY IF EXISTS "visits_read" ON public.visits;
DROP POLICY IF EXISTS "visits_insert" ON public.visits;
DROP POLICY IF EXISTS "visits_update" ON public.visits;

-- 5. Create health-centre-scoped policies on visits.
CREATE POLICY "visits_read_own_centre" ON public.visits
  FOR SELECT
  USING (
    health_centre = (
      SELECT p.health_centre FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "visits_insert_own_centre" ON public.visits
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND health_centre = (
      SELECT p.health_centre FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "visits_update_own_centre" ON public.visits
  FOR UPDATE
  USING (
    health_centre = (
      SELECT p.health_centre FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    health_centre = (
      SELECT p.health_centre FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- 6. service_role bypasses RLS by default, so the server-side pipeline
--    (which uses supabaseAdmin with the service_role key) is unaffected.
