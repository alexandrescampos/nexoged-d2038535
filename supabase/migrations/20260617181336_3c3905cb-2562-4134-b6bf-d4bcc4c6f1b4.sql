
-- Backfill organization_id on versions from parent document
UPDATE public.ged_document_versions v
SET organization_id = d.organization_id
FROM public.ged_documents d
WHERE v.document_id = d.id AND v.organization_id IS NULL;

-- Trigger to always set organization_id from parent document
CREATE OR REPLACE FUNCTION public.ged_versions_set_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.ged_documents WHERE id = NEW.document_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ged_versions_set_org ON public.ged_document_versions;
CREATE TRIGGER trg_ged_versions_set_org
BEFORE INSERT ON public.ged_document_versions
FOR EACH ROW EXECUTE FUNCTION public.ged_versions_set_org();
