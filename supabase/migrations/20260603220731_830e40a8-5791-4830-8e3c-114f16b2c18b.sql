-- 1) Cleanup orphan manager_cnpjs (cnpj belongs to a different org than user's profile)
DELETE FROM public.manager_cnpjs mc
USING public.profiles p, public.organization_cnpjs oc
WHERE mc.user_id = p.id
  AND mc.organization_cnpj_id = oc.id
  AND oc.organization_id IS DISTINCT FROM p.organization_id;

-- 2) Cleanup orphan manager_sectors (sector belongs to a different org than user's profile)
DELETE FROM public.manager_sectors ms
USING public.profiles p, public.sectors s
WHERE ms.user_id = p.id
  AND ms.sector_id = s.id
  AND s.organization_id IS DISTINCT FROM p.organization_id;

-- 3) Validation trigger for manager_cnpjs
CREATE OR REPLACE FUNCTION public.validate_manager_cnpj_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org uuid;
  cnpj_org uuid;
BEGIN
  SELECT organization_id INTO user_org FROM public.profiles WHERE id = NEW.user_id;
  SELECT organization_id INTO cnpj_org FROM public.organization_cnpjs WHERE id = NEW.organization_cnpj_id;
  IF user_org IS NULL OR cnpj_org IS NULL OR user_org <> cnpj_org THEN
    RAISE EXCEPTION 'CNPJ não pertence à mesma organização do usuário';
  END IF;
  -- Ensure the stored organization_id matches
  NEW.organization_id := user_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_manager_cnpj_org ON public.manager_cnpjs;
CREATE TRIGGER trg_validate_manager_cnpj_org
BEFORE INSERT OR UPDATE ON public.manager_cnpjs
FOR EACH ROW EXECUTE FUNCTION public.validate_manager_cnpj_org();

-- 4) Validation trigger for manager_sectors
CREATE OR REPLACE FUNCTION public.validate_manager_sector_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org uuid;
  sector_org uuid;
BEGIN
  SELECT organization_id INTO user_org FROM public.profiles WHERE id = NEW.user_id;
  SELECT organization_id INTO sector_org FROM public.sectors WHERE id = NEW.sector_id;
  IF user_org IS NULL OR sector_org IS NULL OR user_org <> sector_org THEN
    RAISE EXCEPTION 'Setor não pertence à mesma organização do usuário';
  END IF;
  NEW.organization_id := user_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_manager_sector_org ON public.manager_sectors;
CREATE TRIGGER trg_validate_manager_sector_org
BEFORE INSERT OR UPDATE ON public.manager_sectors
FOR EACH ROW EXECUTE FUNCTION public.validate_manager_sector_org();