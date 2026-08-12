-- audit_logs: actor must be self, centre must match
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (health_centre IS NULL OR health_centre = public.my_centre() OR public.is_doctor())
  );

-- notifications: scoped creation
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR health_centre = public.my_centre()
    OR public.is_doctor()
  );

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND (health_centre = public.my_centre() OR public.is_doctor()))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND (health_centre = public.my_centre() OR public.is_doctor()))
  );

-- medicine_inventory: scope to own centre (doctors/admins see all)
DROP POLICY IF EXISTS medicine_select ON public.medicine_inventory;
DROP POLICY IF EXISTS medicine_insert ON public.medicine_inventory;
DROP POLICY IF EXISTS medicine_update ON public.medicine_inventory;

CREATE POLICY medicine_select ON public.medicine_inventory
  FOR SELECT TO authenticated
  USING (health_centre = public.my_centre() OR public.is_doctor());

CREATE POLICY medicine_insert ON public.medicine_inventory
  FOR INSERT TO authenticated
  WITH CHECK (health_centre = public.my_centre());

CREATE POLICY medicine_update ON public.medicine_inventory
  FOR UPDATE TO authenticated
  USING (health_centre = public.my_centre())
  WITH CHECK (health_centre = public.my_centre());

-- default health_centre so client inserts stay scoped
ALTER TABLE public.medicine_inventory ALTER COLUMN health_centre SET DEFAULT public.my_centre();

-- user_roles: only own rows
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- storage: remove public + unscoped policies, add centre-scoped authenticated policies
DROP POLICY IF EXISTS clinic_uploads_read ON storage.objects;
DROP POLICY IF EXISTS clinic_uploads_insert ON storage.objects;
DROP POLICY IF EXISTS "clinic uploads readable by staff" ON storage.objects;
DROP POLICY IF EXISTS "clinic uploads writable by staff" ON storage.objects;

CREATE POLICY clinic_uploads_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'clinic-uploads'
    AND (
      owner = auth.uid()
      OR public.is_doctor()
      OR (storage.foldername(name))[1] = public.my_centre()
    )
  );

CREATE POLICY clinic_uploads_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinic-uploads'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = public.my_centre()
  );

CREATE POLICY clinic_uploads_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'clinic-uploads' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'clinic-uploads' AND owner = auth.uid());

CREATE POLICY clinic_uploads_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clinic-uploads' AND owner = auth.uid());

-- internal helper: not directly callable by app users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_doctor() FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_centre() FROM anon;
