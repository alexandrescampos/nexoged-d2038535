ALTER TABLE public.epis ADD COLUMN code TEXT;
UPDATE public.epis SET code = '' WHERE code IS NULL;
ALTER TABLE public.epis ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX epis_org_code_unique ON public.epis(organization_id, code);