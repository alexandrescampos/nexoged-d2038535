
ALTER FUNCTION public.check_password_is_not_repeated(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.check_user_has_history(uuid) SET search_path = public;
ALTER FUNCTION public.handle_password_change() SET search_path = public;
ALTER FUNCTION public.is_password_in_history(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.record_password_change(uuid, text) SET search_path = public, extensions;

-- Revoke EXECUTE from anon on sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.merge_epis(uuid, uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_job_functions(uuid, uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_password_is_not_repeated(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_password_in_history(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_password_change(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_user_has_history(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_api_usage_log() FROM anon, authenticated, PUBLIC;
