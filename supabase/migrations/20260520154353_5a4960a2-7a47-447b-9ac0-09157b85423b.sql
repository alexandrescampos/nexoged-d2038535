
CREATE TABLE public.cnpj_stock_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  consumer_cnpj_id uuid NOT NULL,
  source_cnpj_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cnpj_stock_sources_unique UNIQUE (consumer_cnpj_id, source_cnpj_id),
  CONSTRAINT cnpj_stock_sources_distinct CHECK (consumer_cnpj_id <> source_cnpj_id)
);

CREATE INDEX idx_cnpj_stock_sources_org ON public.cnpj_stock_sources(organization_id);
CREATE INDEX idx_cnpj_stock_sources_consumer ON public.cnpj_stock_sources(consumer_cnpj_id, priority);

ALTER TABLE public.cnpj_stock_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver fontes de estoque da org"
ON public.cnpj_stock_sources FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem inserir fontes de estoque"
ON public.cnpj_stock_sources FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar fontes de estoque"
ON public.cnpj_stock_sources FOR UPDATE
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar fontes de estoque"
ON public.cnpj_stock_sources FOR DELETE
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem gerenciar cnpj_stock_sources"
ON public.cnpj_stock_sources FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.validate_cnpj_stock_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  consumer_org uuid;
  source_org uuid;
BEGIN
  SELECT organization_id INTO consumer_org FROM organization_cnpjs WHERE id = NEW.consumer_cnpj_id;
  SELECT organization_id INTO source_org FROM organization_cnpjs WHERE id = NEW.source_cnpj_id;

  IF consumer_org IS NULL OR source_org IS NULL THEN
    RAISE EXCEPTION 'CNPJ inválido';
  END IF;

  IF consumer_org <> NEW.organization_id OR source_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Ambos os CNPJs precisam pertencer à mesma organização';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_cnpj_stock_source_trg
BEFORE INSERT OR UPDATE ON public.cnpj_stock_sources
FOR EACH ROW EXECUTE FUNCTION public.validate_cnpj_stock_source();
