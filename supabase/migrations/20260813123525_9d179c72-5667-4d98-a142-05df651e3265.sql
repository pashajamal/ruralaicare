
CREATE OR REPLACE FUNCTION public.enforce_doctor_only_visit_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_doctor() OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.doctor_decision IS DISTINCT FROM OLD.doctor_decision
     OR NEW.doctor_notes IS DISTINCT FROM OLD.doctor_notes
     OR NEW.assigned_doctor IS DISTINCT FROM OLD.assigned_doctor
     OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
     OR NEW.risk_tier IS DISTINCT FROM OLD.risk_tier
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'finalized') THEN
    RAISE EXCEPTION 'Only a doctor can change the doctor decision fields on a visit';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS visits_doctor_fields_guard ON public.visits;
CREATE TRIGGER visits_doctor_fields_guard BEFORE UPDATE ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.enforce_doctor_only_visit_fields();

CREATE OR REPLACE FUNCTION public.enforce_doctor_only_care_plan_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_doctor() OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
     OR NEW.medication_instructions IS DISTINCT FROM OLD.medication_instructions
     OR NEW.monitoring_instructions IS DISTINCT FROM OLD.monitoring_instructions
     OR NEW.follow_up_date IS DISTINCT FROM OLD.follow_up_date
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only a doctor can change care plan clinical fields';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS care_plans_doctor_fields_guard ON public.care_plans;
CREATE TRIGGER care_plans_doctor_fields_guard BEFORE UPDATE ON public.care_plans
FOR EACH ROW EXECUTE FUNCTION public.enforce_doctor_only_care_plan_fields();

CREATE OR REPLACE FUNCTION public.enforce_doctor_only_referral_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_doctor() OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
     OR NEW.risk_tier IS DISTINCT FROM OLD.risk_tier
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only a doctor can change referral decision fields';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS referrals_doctor_fields_guard ON public.referrals;
CREATE TRIGGER referrals_doctor_fields_guard BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.enforce_doctor_only_referral_fields();

CREATE OR REPLACE FUNCTION public.enforce_doctor_only_follow_up_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_doctor() OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.instructions IS DISTINCT FROM OLD.instructions THEN
    RAISE EXCEPTION 'Only a doctor can change follow-up clinical fields';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS follow_ups_doctor_fields_guard ON public.follow_ups;
CREATE TRIGGER follow_ups_doctor_fields_guard BEFORE UPDATE ON public.follow_ups
FOR EACH ROW EXECUTE FUNCTION public.enforce_doctor_only_follow_up_fields();
