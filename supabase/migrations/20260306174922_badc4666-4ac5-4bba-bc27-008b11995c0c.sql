
-- Create organization_cnpjs table
CREATE TABLE public.organization_cnpjs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  company_name TEXT NOT NULL,
  is_main BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_cnpjs_cnpj_unique UNIQUE (cnpj)
);

-- Enable RLS
ALTER TABLE public.organization_cnpjs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Usuários podem ver CNPJs da org"
  ON public.organization_cnpjs FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar CNPJs"
  ON public.organization_cnpjs FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar CNPJs"
  ON public.organization_cnpjs FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar CNPJs"
  ON public.organization_cnpjs FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem gerenciar organization_cnpjs"
  ON public.organization_cnpjs FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_organization_cnpjs_updated_at
  BEFORE UPDATE ON public.organization_cnpjs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add organization_cnpj_id to employees
ALTER TABLE public.employees ADD COLUMN organization_cnpj_id UUID REFERENCES public.organization_cnpjs(id);

-- Migrate existing CNPJs from organizations to organization_cnpjs
INSERT INTO public.organization_cnpjs (organization_id, cnpj, company_name, is_main)
SELECT id, cnpj, name, true
FROM public.organizations
WHERE cnpj IS NOT NULL AND cnpj != '';
