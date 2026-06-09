CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_auth_role text;
BEGIN
  -- Tenta obter o role do auth
  BEGIN
    current_auth_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    current_auth_role := NULL;
  END;

  -- Permite se for super_admin, org_admin ou service_role
  IF has_role(auth.uid(), 'super_admin') OR 
     has_role(auth.uid(), 'org_admin') OR 
     current_auth_role = 'service_role' OR
     current_user = 'service_role' OR
     current_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  -- Preserva campos protegidos para usuários comuns
  NEW.organization_id := OLD.organization_id;
  NEW.created_by := OLD.created_by;
  NEW.is_active := OLD.is_active;
  NEW.must_reset_password := OLD.must_reset_password;
  NEW.email := OLD.email;

  RETURN NEW;
END;
$function$;