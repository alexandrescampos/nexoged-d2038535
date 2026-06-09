
-- Create manager_cnpjs junction table
CREATE TABLE public.manager_cnpjs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_cnpj_id UUID NOT NULL REFERENCES public.organization_cnpjs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_cnpj_id)
);

-- Enable RLS
ALTER TABLE public.manager_cnpjs ENABLE ROW LEVEL SECURITY;

-- SELECT: org_admin, super_admin can see all; manager can see own
CREATE POLICY "SuperAdmins podem gerenciar manager_cnpjs"
  ON public.manager_cnpjs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem ver manager_cnpjs da org"
  ON public.manager_cnpjs FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem inserir manager_cnpjs"
  ON public.manager_cnpjs FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar manager_cnpjs"
  ON public.manager_cnpjs FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem ver seus próprios CNPJs"
  ON public.manager_cnpjs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Helper function to get manager's CNPJ IDs
CREATE OR REPLACE FUNCTION public.get_manager_cnpj_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_cnpj_id FROM public.manager_cnpjs WHERE user_id = _user_id
$$;
