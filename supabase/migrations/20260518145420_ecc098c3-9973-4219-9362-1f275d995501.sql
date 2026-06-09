CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Permite que super_admin, org_admin ou o service_role atualizem os campos
  IF has_role(auth.uid(), 'super_admin') OR 
     has_role(auth.uid(), 'org_admin') OR 
     auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Para outros usuários, preserva os valores antigos nos campos protegidos
  NEW.organization_id := OLD.organization_id;
  NEW.created_by := OLD.created_by;
  NEW.is_active := OLD.is_active;
  NEW.must_reset_password := OLD.must_reset_password;
  NEW.email := OLD.email;

  RETURN NEW;
END;
$function$;