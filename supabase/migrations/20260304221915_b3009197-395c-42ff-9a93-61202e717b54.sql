
CREATE TABLE public.sector_function_epis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  job_function_id uuid NOT NULL REFERENCES job_functions(id) ON DELETE CASCADE,
  epi_id uuid NOT NULL REFERENCES epis(id) ON DELETE CASCADE,
  validity_months integer NOT NULL DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, sector_id, job_function_id, epi_id)
);

ALTER TABLE sector_function_epis ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_sector_function_epis_updated_at
  BEFORE UPDATE ON sector_function_epis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Usuários podem ver associações da org" ON sector_function_epis FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar associações" ON sector_function_epis FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar associações" ON sector_function_epis FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar associações" ON sector_function_epis FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "SuperAdmins podem gerenciar sector_function_epis" ON sector_function_epis FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
