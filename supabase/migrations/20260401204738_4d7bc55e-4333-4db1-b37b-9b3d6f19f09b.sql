
CREATE TABLE public.manager_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sector_id)
);

ALTER TABLE public.manager_sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers podem ver seus próprios setores"
  ON public.manager_sectors FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "OrgAdmins podem ver manager_sectors da org"
  ON public.manager_sectors FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem inserir manager_sectors"
  ON public.manager_sectors FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar manager_sectors"
  ON public.manager_sectors FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem gerenciar manager_sectors"
  ON public.manager_sectors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
