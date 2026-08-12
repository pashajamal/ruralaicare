REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_doctor() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_centre() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_doctor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_centre() TO authenticated;