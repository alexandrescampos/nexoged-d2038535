
-- =============================================
-- 1. Tabela SECTORS
-- =============================================
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_sectors_updated_at
  BEFORE UPDATE ON public.sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "SuperAdmins podem gerenciar sectors" ON public.sectors FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver setores da org" ON public.sectors FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar setores" ON public.sectors FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar setores" ON public.sectors FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem criar setores" ON public.sectors FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers podem atualizar setores" ON public.sectors FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar setores" ON public.sectors FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- =============================================
-- 2. Tabela JOB_FUNCTIONS
-- =============================================
CREATE TABLE public.job_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  sector_id UUID REFERENCES public.sectors(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_functions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_job_functions_updated_at
  BEFORE UPDATE ON public.job_functions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "SuperAdmins podem gerenciar job_functions" ON public.job_functions FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver funções da org" ON public.job_functions FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar funções" ON public.job_functions FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar funções" ON public.job_functions FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem criar funções" ON public.job_functions FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers podem atualizar funções" ON public.job_functions FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar funções" ON public.job_functions FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- =============================================
-- 3. Tabela EMPLOYEES
-- =============================================
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  cpf TEXT,
  admission_date DATE,
  sector_id UUID REFERENCES public.sectors(id),
  job_function_id UUID REFERENCES public.job_functions(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "SuperAdmins podem gerenciar employees" ON public.employees FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver funcionários da org" ON public.employees FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar funcionários" ON public.employees FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar funcionários" ON public.employees FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem criar funcionários" ON public.employees FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers podem atualizar funcionários" ON public.employees FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "OrgAdmins podem deletar funcionários" ON public.employees FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- =============================================
-- 4. Adicionar coluna employee_record_id em epi_deliveries
-- =============================================
ALTER TABLE public.epi_deliveries 
  ADD COLUMN employee_record_id UUID REFERENCES public.employees(id);
