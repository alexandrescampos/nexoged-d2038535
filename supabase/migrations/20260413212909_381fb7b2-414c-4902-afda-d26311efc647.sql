
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'org_admin') THEN
    RETURN NEW;
  END IF;

  NEW.organization_id := OLD.organization_id;
  NEW.created_by := OLD.created_by;
  NEW.is_active := OLD.is_active;
  NEW.must_reset_password := OLD.must_reset_password;
  NEW.email := OLD.email;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();
